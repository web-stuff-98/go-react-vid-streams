package handlers

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/web-stuff-98/go-react-vid-streams/pkg/helpers/authHelpers"
	"github.com/web-stuff-98/go-react-vid-streams/pkg/validation"
	"golang.org/x/crypto/bcrypt"
)

func (h handler) StreamerLogin(ctx *fiber.Ctx) error {
	v := validator.New()
	body := &validation.StreamerLoginRegister{}
	if err := json.Unmarshal(ctx.Body(), &body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Bad request")
	}
	if err := v.Struct(body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Bad request")
	}

	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	conn, err := h.Pool.Acquire(rctx)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}
	defer conn.Release()

	stmt, err := conn.Conn().Prepare(rctx, "streamer_login_stmt", `
	SELECT id FROM streamers WHERE LOWER(name) = LOWER($1);
	`)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}

	var id string
	if err = conn.QueryRow(rctx, stmt.Name, strings.TrimSpace(body.Name)).Scan(&id); err != nil {
		if err == pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusNotFound, "Not found")
		} else {
			return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
		}
	}

	if cookie, err := authHelpers.AuthorizeLogin(h.RedisClient, rctx, id); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	} else {
		ctx.Locals("uid", id)
		ctx.Cookie(cookie)
		ctx.Response().Header.Add("Content-Type", "application/json")
		ctx.WriteString(id)
	}

	return nil
}

func (h handler) StreamerRegister(ctx *fiber.Ctx) error {
	v := validator.New()
	body := &validation.StreamerLoginRegister{}
	if err := json.Unmarshal(ctx.Body(), &body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Bad request")
	}
	if err := v.Struct(body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Bad request")
	}

	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	conn, err := h.Pool.Acquire(rctx)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}
	defer conn.Release()

	existsStmt, err := conn.Conn().Prepare(rctx, "register_exists_stmt", `
	SELECT EXISTS(SELECT 1 FROM streamers WHERE LOWER(name) = LOWER($1));
	`)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}

	exists := false
	if err := conn.QueryRow(rctx, existsStmt.Name, strings.TrimSpace(body.Name)).Scan(&exists); err != nil {
		if err != pgx.ErrNoRows {
			return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
		}
	}
	if exists {
		return fiber.NewError(fiber.StatusBadRequest, "There is already another streamer with that name")
	}

	var id string

	insertStmt, err := conn.Conn().Prepare(rctx, "register_streamer_insert_stmt", `
		INSERT INTO streamers (name) VALUES ($1) RETURNING id;
	`)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}

	if err := conn.QueryRow(rctx, insertStmt.Name, body.Name).Scan(&id); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}

	if cookie, err := authHelpers.AuthorizeLogin(h.RedisClient, rctx, id); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	} else {
		ctx.Locals("uid", id)
		ctx.Response().Header.Add("Content-Type", "text/plain")
		ctx.Cookie(cookie)
		ctx.WriteString(id)
	}

	return nil
}

func (h handler) StreamerLogout(ctx *fiber.Ctx) error {
	ctx.Locals("uid", nil)
	return nil
}

func (h handler) ServerLogout(ctx *fiber.Ctx) error {
	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	if _, sid, err := authHelpers.GetUidAndSid(h.RedisClient, ctx, rctx, h.Pool); err != nil {
		ctx.Cookie(authHelpers.GetClearedCookie())
		return fiber.NewError(fiber.StatusForbidden, "You are not logged in")
	} else {
		authHelpers.DeleteSession(h.RedisClient, rctx, sid)
		ctx.Cookie(authHelpers.GetClearedCookie())
	}

	ctx.Locals("uid", nil)

	return nil
}

func (h handler) Refresh(ctx *fiber.Ctx) error {
	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	if cookie, err := authHelpers.RefreshToken(h.RedisClient, ctx, rctx, h.Pool); err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Unauthorized. Your session most likely expired.")
	} else {
		ctx.Cookie(cookie)
	}

	return nil
}

// if the streamer name provided for the initial login doesn't exist,
// then the streamer will be created.
func (h handler) InitialLogin(ctx *fiber.Ctx) error {
	v := validator.New()
	body := &validation.InitialLogin{}
	if err := json.Unmarshal(ctx.Body(), &body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Bad request")
	}
	if err := v.Struct(body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Bad request")
	}

	rctx, cancel := context.WithTimeout(context.Background(), time.Second*8)
	defer cancel()

	if os.Getenv("ENVIRONMENT") == "PRODUCTION" {
		if err := bcrypt.CompareHashAndPassword([]byte(os.Getenv("SERVER_PASSWORD_HASH")), []byte(body.ServerPassword)); err != nil {
			if err == bcrypt.ErrMismatchedHashAndPassword {
				return fiber.NewError(fiber.StatusUnauthorized, "Invalid credentials")
			} else {
				return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
			}
		}
	} else {
		if body.ServerPassword != os.Getenv("SERVER_PASSWORD_HASH") {
			return fiber.NewError(fiber.StatusUnauthorized, "Invalid credentials")
		}
	}

	conn, err := h.Pool.Acquire(rctx)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	}
	defer conn.Release()

	var id string
	if selectStreamerStmt, err := conn.Conn().Prepare(rctx, "initial_login_select_streamer_stmt", `
		SELECT id FROM streamers WHERE LOWER(name) = LOWER($1);
	`); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	} else {
		if err = conn.Conn().QueryRow(rctx, selectStreamerStmt.Name, body.StreamerName).Scan(&id); err != nil {
			if err != pgx.ErrNoRows {
				return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
			}
		}
	}

	// if id is empty that means a streamer by the name provided was not found, so it must be created
	if id == "" {
		if createStreamerStmt, err := conn.Conn().Prepare(rctx, "initial_login_create_streamer_stmt", `
			INSERT INTO streamers (name) VALUES($1) RETURNING id;
		`); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
		} else {
			if err = conn.Conn().QueryRow(rctx, createStreamerStmt.Name, body.StreamerName).Scan(&id); err != nil {
				return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
			}
		}
	}

	if cookie, err := authHelpers.AuthorizeLogin(h.RedisClient, rctx, id); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Internal error")
	} else {
		ctx.Response().Header.Add("Content-Type", "text/plain")
		ctx.Cookie(cookie)
		ctx.WriteString(id)
	}

	return nil
}
