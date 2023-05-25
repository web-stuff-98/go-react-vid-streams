package handlers

import (
	"context"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

type OutStreamer struct {
	Uid  string `json:"uid"`
	Name string `json:"name"`
}

func (h handler) GetStreamers(ctx *fiber.Ctx) error {
	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	var streamers []OutStreamer

	if rows, err := h.Pool.Query(rctx, `
		SELECT id,name FROM streamers;
	`); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	} else {
		defer rows.Close()
		for rows.Next() {
			var id, name string
			if err = rows.Scan(&id, &name); err != nil {
				return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
			}
			streamers = append(streamers, OutStreamer{
				Uid:  id,
				Name: name,
			})
		}
	}

	if b, err := json.Marshal(streamers); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	} else {
		ctx.Response().Header.Add("Content-Type", "application/json")
		ctx.Write(b)
	}

	return nil
}

func (h handler) GetStreamer(ctx *fiber.Ctx) error {
	uid := ctx.Params("uid")

	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	conn, err := h.Pool.Acquire(rctx)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}
	defer conn.Release()

	var name string

	if selectStmt, err := conn.Conn().Prepare(rctx, "get_streamer_select_stmt", `
		SELECT name FROM streamers WHERE id = $1;
	`); err != nil {
		if err != pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
		} else {
			return fiber.NewError(fiber.StatusNotFound, "Not found")
		}
	} else {
		if err = conn.QueryRow(rctx, selectStmt.Name, uid).Scan(&name); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
		}
	}

	ctx.WriteString(name)

	return nil
}
