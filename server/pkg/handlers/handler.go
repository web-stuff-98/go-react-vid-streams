package handlers

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	socketserver "github.com/web-stuff-98/go-react-vid-streams/pkg/socketServer"
	videoserver "github.com/web-stuff-98/go-react-vid-streams/pkg/videoServer"
	webRTCserver "github.com/web-stuff-98/go-react-vid-streams/pkg/webRTCserver"
)

type handler struct {
	VideoServer  *videoserver.VideoServer
	Pool         *pgxpool.Pool
	RedisClient  *redis.Client
	SocketServer *socketserver.SocketServer
	WebRTCServer *webRTCserver.WebRTCServer
}

func New(
	vs *videoserver.VideoServer,
	db *pgxpool.Pool,
	rd *redis.Client,
	ss *socketserver.SocketServer,
	rtc *webRTCserver.WebRTCServer,
) handler {
	return handler{
		VideoServer:  vs,
		Pool:         db,
		RedisClient:  rd,
		SocketServer: ss,
		WebRTCServer: rtc,
	}
}
