package webrtcserver

import (
	"sync"

	socketmessages "github.com/web-stuff-98/go-react-vid-streams/pkg/socketMessages"
	socketserver "github.com/web-stuff-98/go-react-vid-streams/pkg/socketServer"
)

type WebRTCServer struct {
	Connections        Connections
	JoinWebRTC         chan JoinWebRTC
	LeaveWebRTC        chan LeaveWebRTC
	SignalWebRTC       chan SignalWebRTC
	ReturnSignalWebRTC chan ReturnSignalWebRTC
}

// ------ Mutex protected ------ //

type Connections struct {
	data  map[string]struct{}
	mutex sync.RWMutex
}

// ------ Channels ------ //

type JoinWebRTC struct {
	Uid string
}

type LeaveWebRTC struct {
	Uid string
}

type SignalWebRTC struct {
	Signal string
	ToUid  string
	Uid    string
}

type ReturnSignalWebRTC struct {
	Signal   string
	CallerID string
	Uid      string
}

func Init(ss *socketserver.SocketServer) *WebRTCServer {
	rtc := &WebRTCServer{
		Connections: Connections{
			data: make(map[string]struct{}),
		},
		JoinWebRTC:         make(chan JoinWebRTC),
		LeaveWebRTC:        make(chan LeaveWebRTC),
		SignalWebRTC:       make(chan SignalWebRTC),
		ReturnSignalWebRTC: make(chan ReturnSignalWebRTC),
	}
	runServer(rtc, ss)
	return rtc
}

func runServer(rtc *WebRTCServer, ss *socketserver.SocketServer) {
	go joinWebRTC(rtc, ss)
	go leaveWebRTC(rtc, ss)
	go sendWebRTCSignals(rtc, ss)
}

func joinWebRTC(rtc *WebRTCServer, ss *socketserver.SocketServer) {
	for {
		data := <-rtc.JoinWebRTC

		rtc.Connections.mutex.Lock()

		rtc.Connections.data[data.Uid] = struct{}{}

		rtc.Connections.mutex.Unlock()
	}
}

func leaveWebRTC(rtc *WebRTCServer, ss *socketserver.SocketServer) {
	for {
		data := <-rtc.LeaveWebRTC

		rtc.Connections.mutex.Lock()

		delete(rtc.Connections.data, data.Uid)

		rtc.Connections.mutex.Unlock()
	}
}

func sendWebRTCSignals(rtc *WebRTCServer, ss *socketserver.SocketServer) {
	for {
		data := <-rtc.SignalWebRTC

		ss.SendDataToUid <- socketserver.SendDataToUid{
			Uid:       data.ToUid,
			EventName: "WEBRTC_JOINED",
			Data: socketmessages.WebRTCUserJoined{
				CallerID: data.Uid,
				Signal:   data.Signal,
			},
		}
	}
}
