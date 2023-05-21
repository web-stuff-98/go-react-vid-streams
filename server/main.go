package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
	"github.com/web-stuff-98/go-react-vid-streams/pkg/db"
	"github.com/web-stuff-98/go-react-vid-streams/pkg/handlers"
	rdb "github.com/web-stuff-98/go-react-vid-streams/pkg/redis"
	socketServer "github.com/web-stuff-98/go-react-vid-streams/pkg/socketServer"
	videoServer "github.com/web-stuff-98/go-react-vid-streams/pkg/videoServer"
	webRTCserver "github.com/web-stuff-98/go-react-vid-streams/pkg/webRTCserver"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatal("Failed to load environment variables")
	}

	app := fiber.New()
	db := db.Init()
	rd := rdb.Init()
	vs := videoServer.Init(db)
	rtcDC := make(chan string)
	ss := socketServer.Init(rtcDC)
	rtc := webRTCserver.Init(ss, rtcDC)
	h := handlers.New(vs, db, rd, ss, rtc)

	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:5173",
		AllowMethods:     "POST, PATCH, PUT, GET, OPTIONS, DELETE",
		AllowCredentials: true,
	}))

	app.Post("/api/video/chunk", h.HandleChunk)
	app.Get("/api/video/:name", h.DownloadStreamVideo)

	app.Get("/api/videos", h.GetVideoNames)

	app.Post("/api/auth/login", h.ServerLogin)
	app.Post("/api/auth/refresh", h.Refresh)
	app.Post("/api/auth/streamer/login", h.StreamerLogin)
	app.Post("/api/auth/streamer/logout", h.StreamerLogout)
	app.Post("/api/auth/streamer/register", h.StreamerRegister)

	log.Fatal(app.Listen(fmt.Sprintf(":%v", os.Getenv("PORT"))))
}
