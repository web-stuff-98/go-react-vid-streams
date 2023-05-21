package videoserver

import (
	"context"
	"fmt"
	"log"
	"math"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type VideoServer struct {
	Streamers Streamers

	HandleChunk chan HandleChunk
}

// ------ Mutex locked ------ //
type Streamers struct {
	// outer map key is streamer uid, inner map key is stream name.
	// waitgroup is used to wait for chunks being written to complete
	data  map[string]map[string]*sync.WaitGroup
	mutex sync.RWMutex
}

// ------ Channel structs ------ //

type HandleChunk struct {
	Data      []byte
	Name      string
	Uid       string
	ErrorChan chan error
}

// ------ General structs ------ //

type CloseStream struct {
	Name string
	Uid  string
}

// ------ Initialization ------ //

func Init(db *pgxpool.Pool) *VideoServer {
	vs := &VideoServer{
		Streamers: Streamers{
			data: make(map[string]map[string]*sync.WaitGroup),
		},

		HandleChunk: make(chan HandleChunk),
	}
	runServer(vs, db)
	return vs
}

func runServer(vs *VideoServer, db *pgxpool.Pool) {
	go handleChunk(vs, db)
}

// ------ Loops ------ //

func handleChunk(vs *VideoServer, db *pgxpool.Pool) {
	chunkSize, err := strconv.Atoi(os.Getenv("VID_CHUNK_SIZE"))
	if err != nil {
		log.Fatalln("Failed to parse VID_CHUNK_SIZE environment variable")
	}
	DBChunkSize := int64(chunkSize)

	for {
		data := <-vs.HandleChunk

		vs.Streamers.mutex.RLock()

		// acquire a database connection from the pool
		ctx, cancel := context.WithTimeout(context.Background(), time.Second*3)
		conn, err := db.Acquire(ctx)
		errored := func(err string) {
			cancel()
			conn.Release()
			data.ErrorChan <- fmt.Errorf(err)
		}
		if err != nil {
			errored("Failed to acquire pool connection")
			continue
		}

		// check if the metadata exists (also functions as an auth check by including
		// streamer ID in where clause)
		selectStmt, err := conn.Conn().Prepare(ctx, "handle_chunk_select_stmt", `
			SELECT EXISTS(SELECT 1 FROM vid_meta WHERE LOWER(name) = LOWER($1) AND streamer = $2);
		`)
		if err != nil {
			errored("Failed to prepare handle chunk select statement")
			continue
		}
		var exists bool
		if err = conn.QueryRow(ctx, selectStmt.Name, data.Name, data.Uid).Scan(&exists); err != nil {
			errored("Failed in execution of handle chunk select meta statement")
			continue
		}

		// now update/create the metadata and scan the ID
		var id string
		var preSavedSize, index int
		if exists {
			err = db.QueryRow(ctx, `
				UPDATE vid_meta SET size = size + $1 WHERE (name = $2 AND streamer = $3) RETURNING id,size - $1;
			`, len(data.Data), data.Name, data.Uid).Scan(&id, &preSavedSize)
			if err != nil {
				errored("Failed in execution of handle chunk update meta size statement")
				continue
			}
		} else {
			err = conn.QueryRow(ctx, `
				INSERT INTO vid_meta (size,name,streamer) VALUES($1,$2,$3) RETURNING id;
			`, len(data.Data), data.Name, data.Uid).Scan(&id)
			if err != nil {
				errored("Failed in execution of handle chunk insert meta statement")
				continue
			}
		}
		index = int(math.Floor(float64(preSavedSize) / float64(DBChunkSize)))

		// first check if any chunks have been written yet
		var chunkExists bool
		if err = conn.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM vid_chunks WHERE vid_id = $1);
		`, id).Scan(&chunkExists); err != nil {
			errored("Failed in execution of handle chunk select chunk exists statement")
			continue
		}

		if !chunkExists {
			// if no chunks exist then save the received data as the first chunk(s)
			chunks := splitIntoChunks(data.Data, int(DBChunkSize))
			for _, b := range chunks {
				if _, err := conn.Exec(ctx, `
					INSERT INTO vid_chunks (bytes,vid_id,index) VALUES($1,$2,$3);
				`, b, id, index); err != nil {
					errored("Failed in execution of handle chunk insert chunk statement")
					continue
				}
				index++
			}
		} else {
			// need to retreive the bytes from the chunk at the current index
			var currentChunkBytes []byte
			err = conn.QueryRow(ctx, `
			SELECT bytes FROM vid_chunks WHERE vid_id = $1 AND index = $2;
		`, id, index).Scan(&currentChunkBytes)
			if err != nil {
				if err != pgx.ErrNoRows {
					errored("Failed in execution of handle chunk update partial chunk select bytes statement")
					continue
				}
			}

			// the chunk is not full and the all the received bytes can fit into it, so save the bytes into it
			if len(data.Data)+preSavedSize <= int(DBChunkSize) {
				_, err = conn.Exec(ctx, `
				UPDATE vid_chunks SET bytes = $1 WHERE vid_id = $2 AND index = $3;
			`, append(currentChunkBytes, data.Data...), id, index)
				if err != nil {
					errored("Failed in execution of handle chunk update partial chunk statement")
					continue
				}
			} else {
				// the bytes received will overflow the chunk - so fill in any remaining space in the chunk
				// then write the extra chunk(s)

				// first fill in the current chunk then increment the index
				dataRange := int(DBChunkSize) - len(currentChunkBytes)
				if dataRange > len(data.Data) {
					dataRange = len(data.Data)
				}
				_, err = conn.Exec(ctx, `
				UPDATE vid_chunks SET bytes = $1 WHERE vid_id = $2 AND index = $3;
			`, append(currentChunkBytes, data.Data[:dataRange]...), id, index)
				if err != nil {
					errored("Failed in execution of handle chunk update partial chunk statement")
					continue
				}
				index++

				// save the remaining chunks
				chunks := splitIntoChunks(data.Data[dataRange:], int(DBChunkSize))
				for _, b := range chunks {
					if len(b) != 0 {
						_, err = conn.Exec(ctx, `
					INSERT INTO vid_chunks (vid_id,index,bytes) VALUES($1,$2,$3);
				`, id, index, b)
						if err != nil {
							errored("Failed in execution of handle chunk insert chunk statement")
							continue
						}
					}
					index++
				}
			}
		}

		conn.Release()
		ctx.Done()
		data.ErrorChan <- nil
	}
}

// ------ Helper functions ------ //
/*func splitIntoChunkss(input []byte, DBChunkSize int) [][]byte {
	numChunks := int(math.Ceil(float64(len(input)) / float64(DBChunkSize)))
	remaining := input
	var output [][]byte
	for i := 0; i < numChunks; i++ {
		remainingLength := len(remaining)
		end := int(DBChunkSize)
		if end > remainingLength {
			end = remainingLength
		}
		if remainingLength > 0 {
			output[i] = remaining[0:end]
		}
		remaining = remaining[end:]
	}
	return output
}*/

// https://gist.github.com/xlab/6e204ef96b4433a697b3
func splitIntoChunks(buf []byte, lim int) [][]byte {
	var chunk []byte
	chunks := make([][]byte, 0, len(buf)/lim+1)
	for len(buf) >= lim {
		chunk, buf = buf[:lim], buf[lim:]
		chunks = append(chunks, chunk)
	}
	if len(buf) > 0 {
		chunks = append(chunks, buf[:])
	}
	return chunks
}
