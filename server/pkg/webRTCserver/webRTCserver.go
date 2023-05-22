package webrtcserver

import (
	"log"
	"sync"

	socketMessages "github.com/web-stuff-98/go-react-vid-streams/pkg/socketMessages"
	socketServer "github.com/web-stuff-98/go-react-vid-streams/pkg/socketServer"
	socketValidation "github.com/web-stuff-98/go-react-vid-streams/pkg/socketValidation"
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
	Uid         string
	StreamsInfo []socketValidation.StreamInfo
}

type LeaveWebRTC struct {
	Uid string
}

type SignalWebRTC struct {
	Signal      string
	ToUid       string
	Uid         string
	StreamsInfo []socketValidation.StreamInfo
}

type ReturnSignalWebRTC struct {
	Signal      string
	CallerID    string
	Uid         string
	StreamsInfo []socketValidation.StreamInfo
}

func Init(ss *socketServer.SocketServer, rtcDC chan string) *WebRTCServer {
	rtc := &WebRTCServer{
		Connections: Connections{
			data: make(map[string]struct{}),
		},
		JoinWebRTC:         make(chan JoinWebRTC),
		LeaveWebRTC:        make(chan LeaveWebRTC),
		SignalWebRTC:       make(chan SignalWebRTC),
		ReturnSignalWebRTC: make(chan ReturnSignalWebRTC),
	}
	runServer(rtc, ss, rtcDC)
	return rtc
}

func runServer(rtc *WebRTCServer, ss *socketServer.SocketServer, rtcDC chan string) {
	go joinWebRTC(rtc, ss)
	go leaveWebRTC(rtc, ss)
	go sendWebRTCSignals(rtc, ss)
	go returningWebRTCSignals(rtc, ss)
	go watchForSocketDisconnect(rtc, rtcDC)
}

func watchForSocketDisconnect(rtc *WebRTCServer, rtcDC chan string) {
	for {
		uid := <-rtcDC
		rtc.LeaveWebRTC <- LeaveWebRTC{
			Uid: uid,
		}
	}
}

func joinWebRTC(rtc *WebRTCServer, ss *socketServer.SocketServer) {
	for {
		data := <-rtc.JoinWebRTC

		rtc.Connections.mutex.Lock()

		uids := []socketMessages.WebRTCOutUser{}
		for uid := range rtc.Connections.data {
			uids = append(uids, socketMessages.WebRTCOutUser{
				Uid: uid,
			})
		}

		uidsMap := make(map[string]struct{})
		for _, wru := range uids {
			uidsMap[wru.Uid] = struct{}{}
		}

		ss.SendDataToUids <- socketServer.SendDataToUids{
			Uids: uidsMap,
			Data: socketMessages.WebRTCUserJoinedLeft{
				Uid: data.Uid,
			},
			EventName: "WEBRTC_USER_JOINED",
		}

		ss.SendDataToUid <- socketServer.SendDataToUid{
			Uid: data.Uid,
			Data: socketMessages.WebRTCAllUsers{
				Users: uids,
			},
			EventName: "WEBRTC_ALL_USERS",
		}

		log.Printf("User joined - all users: %v", uids)

		rtc.Connections.data[data.Uid] = struct{}{}

		rtc.Connections.mutex.Unlock()
	}
}

func leaveWebRTC(rtc *WebRTCServer, ss *socketServer.SocketServer) {
	for {
		data := <-rtc.LeaveWebRTC

		rtc.Connections.mutex.Lock()

		uids := make(map[string]struct{})
		for uid := range rtc.Connections.data {
			if uid != data.Uid {
				uids[uid] = struct{}{}
			}
		}

		ss.SendDataToUids <- socketServer.SendDataToUids{
			Uids: uids,
			Data: socketMessages.WebRTCUserJoinedLeft{
				Uid: data.Uid,
			},
			EventName: "WEBRTC_USER_LEFT",
		}

		delete(rtc.Connections.data, data.Uid)

		rtc.Connections.mutex.Unlock()
	}
}

func sendWebRTCSignals(rtc *WebRTCServer, ss *socketServer.SocketServer) {
	for {
		data := <-rtc.SignalWebRTC

		ss.SendDataToUid <- socketServer.SendDataToUid{
			Uid:       data.ToUid,
			EventName: "WEBRTC_JOINED_SIGNAL",
			Data: socketMessages.WebRTCUserJoined{
				CallerID:    data.Uid,
				Signal:      data.Signal,
				StreamsInfo: data.StreamsInfo,
			},
		}
	}
}

func returningWebRTCSignals(rtc *WebRTCServer, ss *socketServer.SocketServer) {
	for {
		data := <-rtc.ReturnSignalWebRTC

		ss.SendDataToUid <- socketServer.SendDataToUid{
			Uid:       data.CallerID,
			EventName: "WEBRTC_RETURN_SIGNAL_OUT",
			Data: socketMessages.WebRTCReturnSignal{
				Signal:      data.Signal,
				Uid:         data.Uid,
				StreamsInfo: data.StreamsInfo,
			},
		}
	}
}
