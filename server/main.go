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
	rtcDC := make(chan string) // WebRTC server socket disconnect UID channel
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
	app.Get("/api/video/playback/:name", h.PlaybackStreamVideo)

	app.Get("/api/streams/old", h.GetOldStreams)
	app.Delete("/api/streams/:name", h.DeleteStream)

	app.Post("/api/auth/login", h.InitialLogin)
	app.Post("/api/auth/refresh", h.Refresh)
	app.Post("/api/auth/streamer/login", h.StreamerLogin)
	app.Post("/api/auth/streamer/logout", h.StreamerLogout)
	app.Post("/api/auth/streamer/register", h.StreamerRegister)

	app.Get("/api/streamers", h.GetStreamers)
	app.Get("/api/streamers/:uid", h.GetStreamer)

	app.Use("/api/ws", h.WebSocketAuth)
	app.Get("/api/ws", h.WebSocketHandler())

	log.Fatal(app.Listen(fmt.Sprintf(":%v", os.Getenv("PORT"))))
}
