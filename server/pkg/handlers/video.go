package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/pgtype"
	"github.com/jackc/pgx/v5"
	"github.com/web-stuff-98/go-react-vid-streams/pkg/helpers/authHelpers"
	videoServer "github.com/web-stuff-98/go-react-vid-streams/pkg/videoServer"
)

// Will retrieve the LAST chunk if range header is not present,
// since that's where it needs to start from, the video player
// trackbar will contain the full range of the video
// up to the present moment
func (h handler) PlaybackStreamVideo(ctx *fiber.Ctx) error {
	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	_, _, err := authHelpers.GetUidAndSid(h.RedisClient, ctx, rctx, h.Pool)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Unauthorized")
	}

	chunkSize, err := strconv.Atoi(os.Getenv("VID_CHUNK_SIZE"))
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to parse VID_CHUNK_SIZE environment variable")
	}
	DBChunkSize := int64(chunkSize)

	conn, err := h.Pool.Acquire(rctx)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}
	defer conn.Release()

	streamName := ctx.Params("name", "")
	if streamName == "" || len(streamName) > 24 {
		return fiber.NewError(fiber.StatusBadRequest, "Bad request")
	}

	var size int
	var id string
	if selectMetaStmt, err := conn.Conn().Prepare(rctx, "get_video_select_meta_stmt", `
		SELECT size,id FROM vid_meta WHERE LOWER(name) = LOWER($1);
	`); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	} else {
		if err = conn.Conn().QueryRow(rctx, selectMetaStmt.Name, streamName).Scan(&size, &id); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
		}
	}

	// get the start and end byte positions from the range header
	// I used GPT to shorten this since it was like 50 lines before
	var maxLength int64 = DBChunkSize
	var start, end int64
	if rangeHeader := ctx.Get("Range"); rangeHeader != "" {
		if _, err = fmt.Sscanf(rangeHeader, "bytes=%d-", &start); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid range header")
		}
		if start+DBChunkSize > int64(size) {
			maxLength = int64(size) - start
		}
		if i := strings.Index(rangeHeader, "-"); i != -1 {
			if end, err = strconv.ParseInt(rangeHeader[i+1:], 10, 64); err != nil {
				end = start + maxLength
			}
		} else {
			end = start + maxLength
		}
	} else {
		// if theres no range header, send the end
		end = int64(size)
		start = end - DBChunkSize
		if start < 0 {
			start = 0
		}
	}

	// query the db for relevant chunks
	chunksStart := int(math.Floor(float64(start) / float64(DBChunkSize)))
	chunksEnd := int(math.Ceil(float64(end) / float64(DBChunkSize)))
	var allChunkBytes []byte
	for i := chunksStart; i < chunksEnd; i++ {
		var bytes pgtype.Bytea
		if err := conn.QueryRow(rctx, `
			SELECT bytes FROM vid_chunks WHERE vid_id = $1 AND index = $2; 
		`, id, i).Scan(&bytes); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
		} else {
			allChunkBytes = append(allChunkBytes, bytes.Bytes...)
		}
	}

	ctx.Response().Header.Add("Content-Type", "video/webm")
	ctx.Response().Header.Add("Content-Length", fmt.Sprintf("%v", size))
	ctx.Response().Header.Add("Accept-Ranges", "bytes")
	ctx.Response().Header.Add("Content-Range", fmt.Sprintf("%v-%v/%v", start, end, size))
	// send back the bytes that were requested
	ctx.Write(allChunkBytes[int(start)-(chunksStart*int(DBChunkSize)) : int(end)-(chunksStart*int(DBChunkSize))])

	return nil
}

// send the video back as an octet stream starting from the first chunk
// but only send the bytes that were present when the HTTP request was received,
// so that the video the user will get back is the recording up to roughly the point
// where they clicked the download button
func (h handler) DownloadStreamVideo(ctx *fiber.Ctx) error {
	name := ctx.Params("name")
	if name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Bad request")
	}

	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	conn, err := h.Pool.Acquire(rctx)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}
	defer conn.Release()

	var size int
	var id string
	if err = conn.QueryRow(rctx, `
		SELECT size,id FROM vid_meta WHERE name = $1;
	`, name).Scan(&size, &id); err != nil {
		if err != pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
		} else {
			return fiber.NewError(fiber.StatusNotFound, "Recording not found")
		}
	}

	ctx.Response().Header.SetContentType("video/webm")
	ctx.Response().Header.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%v.webm"`, url.PathEscape(name)))

	var index, bytesDone int
	var chunkBytes pgtype.Bytea
	recursivelyWriteChunksToResponse := func() error {
	WRITE:
		if err = conn.QueryRow(rctx, `
			SELECT bytes FROM vid_chunks WHERE vid_id = $1 AND index = $2;
		`, id, index).Scan(&chunkBytes); err != nil {
			if err == pgx.ErrNoRows || bytesDone >= size {
				rctx.Done()
				return nil
			}
			return err
		} else {
			index++
			bytesDone += len(chunkBytes.Bytes)
			if _, err = ctx.Write(chunkBytes.Bytes); err != nil {
				return err
			}
		}
		goto WRITE
	}

	if err = recursivelyWriteChunksToResponse(); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}

	rctx.Done()
	return nil
}

/*
func (h handler) TestGetVideo(ctx *fiber.Ctx) error {
	if b, err := ioutil.ReadFile("testvid.mp4"); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error - failed to locate file")
	} else {
		ctx.Response().Header.Add("Content-Type", "video/webm")
		ctx.Response().Header.Add("Content-Length", fmt.Sprintf("%v", len(b)))
		ctx.Response().Header.Add("Accept-Ranges", "bytes")

		chunkSize, err := strconv.Atoi(os.Getenv("VID_CHUNK_SIZE"))
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "Failed to parse VID_CHUNK_SIZE environment variable")
		}
		DBChunkSize := int64(chunkSize)

		var maxLength int64 = DBChunkSize
		var start, end int64
		if rangeHeader := ctx.Get("Range"); rangeHeader != "" {
			size := int64(len(b))
			if _, err = fmt.Sscanf(rangeHeader, "bytes=%d-", &start); err != nil {
				return fiber.NewError(fiber.StatusBadRequest, "Invalid range header")
			}
			if start+DBChunkSize > size {
				maxLength = size - start
			}
			if i := strings.Index(rangeHeader, "-"); i != -1 {
				if end, err = strconv.ParseInt(rangeHeader[i+1:], 10, 64); err != nil {
					end = start + maxLength
				}
			} else {
				end = start + maxLength
			}

			ctx.Response().Header.Add("Content-Range", fmt.Sprintf("%v-%v/%v", start, end, size))
			ctx.Write(b[start:end])
		} else {
			ctx.Write(b[0:DBChunkSize])
		}

		return nil
	}
}
*/

func (h handler) HandleChunk(ctx *fiber.Ctx) error {
	data := ctx.Body()
	numBytes := len(data)

	streamName := ctx.Query("name", "")
	if numBytes == 0 || streamName == "" || len(streamName) > 24 {
		return fiber.NewError(fiber.StatusBadRequest, "Bad request")
	}

	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	uid, _, err := authHelpers.GetUidAndSid(h.RedisClient, ctx, rctx, h.Pool)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Unauthorized")
	}

	errorChan := make(chan error, 1)
	h.VideoServer.HandleChunk <- videoServer.HandleChunk{
		Data:      data,
		Name:      streamName,
		Uid:       uid,
		ErrorChan: errorChan,
	}
	err = <-errorChan
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}

	close(errorChan)

	return nil
}

func (h handler) GetVideoNames(ctx *fiber.Ctx) error {
	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	if _, _, err := authHelpers.GetUidAndSid(h.RedisClient, ctx, rctx, h.Pool); err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Unauthorized")
	}

	var out []string

	if rows, err := h.Pool.Query(rctx, `
		SELECT name FROM vid_meta;
	`); err != nil {
		if err != pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
		} else {
			if b, err := json.Marshal(out); err != nil {
				return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
			} else {
				ctx.Response().Header.Add("Content-Type", "application/json")
				ctx.Write(b)
				return nil
			}
		}
	} else {
		for rows.Next() {
			var name string
			if err = rows.Scan(&name); err != nil {
				return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
			}
			out = append(out, name)
		}
	}

	if b, err := json.Marshal(out); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	} else {
		ctx.Response().Header.Add("Content-Type", "application/json")
		ctx.Write(b)
		return nil
	}
}
