package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/pgtype"
	"github.com/jackc/pgx/v5"
	"github.com/web-stuff-98/go-react-vid-streams/pkg/helpers/authHelpers"
	socketMessages "github.com/web-stuff-98/go-react-vid-streams/pkg/socketMessages"
	socketServer "github.com/web-stuff-98/go-react-vid-streams/pkg/socketServer"
	socketvalidation "github.com/web-stuff-98/go-react-vid-streams/pkg/socketValidation"
	videoServer "github.com/web-stuff-98/go-react-vid-streams/pkg/videoServer"
	webRTCserver "github.com/web-stuff-98/go-react-vid-streams/pkg/webRTCserver"
)

// doesn't download the entire video stream for >2g, downloads a video stream 256mb section
// since javascript fix-webm-duration wont work with larger than 256mb files....
// the index of the 256mb section needs to be present in the URL param or it will default
// to the first 256mbs of the video (index 0)
var SectionSize int = 256 * 1024 * 1024

func (h handler) DownloadStreamVideo(ctx *fiber.Ctx) error {
	name := ctx.Params("name")
	if name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Bad request")
	}
	iRaw := ctx.Query("i", "0")
	i, err := strconv.Atoi(iRaw)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid 256mbs section index query param")
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

	if i*SectionSize > size {
		return fiber.NewError(fiber.StatusBadRequest, "Requested section index exceeds video size")
	}

	ctx.Response().Header.SetContentType("video/webm")
	ctx.Response().Header.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%v-%v-%v.webm"`, url.PathEscape(name), "section", iRaw))
	if size <= SectionSize {
		ctx.Response().Header.Add("Content-Length", strconv.Itoa(size))
	} else {
		if size-(i*SectionSize) < SectionSize {
			ctx.Response().Header.Add("Content-Length", strconv.Itoa(size-(i*SectionSize)))
		} else {
			ctx.Response().Header.Add("Content-Length", strconv.Itoa(SectionSize))
		}
	}

	DBChunkSize, err := strconv.Atoi(os.Getenv("VID_CHUNK_SIZE"))
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to parse VID_CHUNK_SIZE environment variable")
	}

	var index, bytesDone int
	var chunkBytes pgtype.Bytea

	// db chunk index will start off depending on the 256mb section index from the query params
	index = (i * (SectionSize)) / DBChunkSize

	recursivelyWriteChunksToResponse := func() error {
	WRITE:
		if err = conn.QueryRow(rctx, `
			SELECT bytes FROM vid_chunks WHERE vid_id = $1 AND index = $2;
		`, id, index).Scan(&chunkBytes); err != nil {
			if err == pgx.ErrNoRows || bytesDone >= size || bytesDone >= (SectionSize) {
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

backup for API handler that sends the entire stream video without using the
index query param to select which section to download

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
	ctx.Response().Header.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%v.webm"`, url.PathEscape(name),))

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
*/

type OutVideoMeta struct {
	Size    int `json:"size"`
	Seconds int `json:"seconds"`
}

func (h handler) GetVideoMeta(ctx *fiber.Ctx) error {
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

	var size, seconds int
	if err = conn.QueryRow(rctx, `
		SELECT size,seconds FROM vid_meta WHERE name = $1;
	`, name).Scan(&size, &seconds); err != nil {
		if err != pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
		} else {
			return fiber.NewError(fiber.StatusNotFound, "Recording not found")
		}
	}

	if b, err := json.Marshal(OutVideoMeta{
		Size:    size,
		Seconds: seconds,
	}); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	} else {
		ctx.Response().Header.Add("Content-Type", "application/json")
		ctx.Write(b)
	}

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

/*func (h handler) GetVideoNames(ctx *fiber.Ctx) error {
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
}*/

type OutOldStream struct {
	Name string `json:"name"`
	Uid  string `json:"streamer_id"`
}

func (h handler) GetOldStreams(ctx *fiber.Ctx) error {
	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	if _, _, err := authHelpers.GetUidAndSid(h.RedisClient, ctx, rctx, h.Pool); err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Unauthorized")
	}

	recvChan := make(chan []socketvalidation.StreamInfo, 1)
	h.WebRTCServer.GetActiveStreams <- webRTCserver.GetActiveStreams{
		RecvChan: recvChan,
	}
	activeStreams := <-recvChan

	close(recvChan)

	var outOldStreams []OutOldStream

	if rows, err := h.Pool.Query(rctx, `
		SELECT name,streamer FROM vid_meta;
	`); err != nil {
		if err != pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
		} else {
			if b, err := json.Marshal(outOldStreams); err != nil {
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
			var streamer_id string
			if err = rows.Scan(&name, &streamer_id); err != nil {
				return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
			}
			var found bool
			for _, si := range activeStreams {
				if si.StreamName == name {
					found = true
				}
			}
			if !found {
				outOldStreams = append(outOldStreams, OutOldStream{
					Name: name,
					Uid:  streamer_id,
				})
			}
		}
	}

	if b, err := json.Marshal(outOldStreams); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	} else {
		ctx.Response().Header.Add("Content-Type", "application/json")
		ctx.Write(b)
		return nil
	}
}

func (h handler) DeleteStream(ctx *fiber.Ctx) error {
	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	uid, _, err := authHelpers.GetUidAndSid(h.RedisClient, ctx, rctx, h.Pool)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Unauthorized")
	}

	conn, err := h.Pool.Acquire(rctx)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}
	defer conn.Release()

	h.WebRTCServer.DeleteStream <- webRTCserver.DeleteStream{
		Uid:        uid,
		StreamName: ctx.Params("name"),
	}

	var id string

	if deleteStmt, err := conn.Conn().Prepare(rctx, "delete_stream_delete_stmt", `
		DELETE FROM vid_meta WHERE LOWER(name) = LOWER($1) RETURNING id;
	`); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	} else {
		if err = conn.Conn().QueryRow(rctx, deleteStmt.Name, ctx.Params("name")).Scan(&id); err != nil {
			if err != pgx.ErrNoRows {
				return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
			}
			return fiber.NewError(fiber.StatusNotFound, "Not found")
		}
	}

	outData := make(map[string]interface{})
	outData["name"] = ctx.Params("name")
	outData["id"] = id

	h.SocketServer.SendDataToAll <- socketServer.SendDataToAll{
		Data: socketMessages.ChangeData{
			Entity: "STREAM",
			Method: "DELETE",
			Data:   outData,
		},
		EventName: "CHANGE",
	}

	return nil
}
