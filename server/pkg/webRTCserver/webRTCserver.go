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
	MotionUpdate       chan MotionUpdate
	GetActiveStreams   chan GetActiveStreams
	DeleteStream       chan DeleteStream
}

// ------ Mutex protected ------ //

type Connections struct {
	data  map[string]Connection
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

type MotionUpdate struct {
	MediaStreamId string
	Uid           string
	Motion        bool
}

type DeleteStream struct {
	Uid        string
	StreamName string
}

type GetActiveStreams struct {
	RecvChan chan []socketValidation.StreamInfo
}

// ------ General structs ------ //

type Connection struct {
	StreamsInfo []socketValidation.StreamInfo
}

func Init(ss *socketServer.SocketServer, rtcDC chan string) *WebRTCServer {
	rtc := &WebRTCServer{
		Connections: Connections{
			data: make(map[string]Connection),
		},
		JoinWebRTC:         make(chan JoinWebRTC),
		LeaveWebRTC:        make(chan LeaveWebRTC),
		SignalWebRTC:       make(chan SignalWebRTC),
		ReturnSignalWebRTC: make(chan ReturnSignalWebRTC),
		MotionUpdate:       make(chan MotionUpdate),
		GetActiveStreams:   make(chan GetActiveStreams),
		DeleteStream:       make(chan DeleteStream),
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
	go motionUpdate(rtc, ss)
	go getActiveStreams(rtc)
	go deleteStream(rtc, ss)
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

		users := []socketMessages.WebRTCOutUser{}
		for uid, connectionInfo := range rtc.Connections.data {
			if uid != data.Uid {
				users = append(users, socketMessages.WebRTCOutUser{
					Uid:         uid,
					StreamsInfo: connectionInfo.StreamsInfo,
				})
			}
		}

		uidsMap := make(map[string]struct{})
		for _, wru := range users {
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
				Users: users,
			},
			EventName: "WEBRTC_ALL_USERS",
		}

		log.Printf("User joined - all users: %v", users)

		rtc.Connections.data[data.Uid] = Connection{
			StreamsInfo: data.StreamsInfo,
		}

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

func motionUpdate(rtc *WebRTCServer, ss *socketServer.SocketServer) {
	for {
		data := <-rtc.MotionUpdate

		rtc.Connections.mutex.Lock()

		if info, ok := rtc.Connections.data[data.Uid]; ok {
			newStreamsInfo := info.StreamsInfo

			for i, si := range newStreamsInfo {
				if si.MediaStreamID == data.MediaStreamId {
					newStreamsInfo[i].Motion = data.Motion
					break
				}
			}

			rtc.Connections.data[data.Uid] = Connection{
				StreamsInfo: newStreamsInfo,
			}
		}

		ss.SendDataToAllExcept <- socketServer.SendDataToAllExcept{
			Exclude: data.Uid,
			Data: socketMessages.WebRTCMotionUpdate{
				Motion:        true,
				MediaStreamID: data.MediaStreamId,
				StreamerID:    data.Uid,
			},
			EventName: "WEBRTC_MOTION_UPDATE",
		}

		rtc.Connections.mutex.Unlock()
	}
}

func getActiveStreams(rtc *WebRTCServer) {
	for {
		data := <-rtc.GetActiveStreams

		rtc.Connections.mutex.RLock()

		streamsInfo := []socketValidation.StreamInfo{}

		for _, c := range rtc.Connections.data {
			streamsInfo = append(streamsInfo, c.StreamsInfo...)
		}

		data.RecvChan <- streamsInfo

		rtc.Connections.mutex.RUnlock()
	}
}

func deleteStream(rtc *WebRTCServer, ss *socketServer.SocketServer) {
	for {
		data := <-rtc.DeleteStream

		rtc.Connections.mutex.Lock()

		if connData, ok := rtc.Connections.data[data.Uid]; ok {
			var index int
			for i, si := range connData.StreamsInfo {
				if si.StreamName == data.StreamName {
					index = i
					break
				}
			}
			newStreamsInfo := connData.StreamsInfo
			// Theres no array splice method in golang???
			// Remove the element at index i from a.
			newStreamsInfo[index] = newStreamsInfo[len(newStreamsInfo)-1] // Copy last element to index i.
			newStreamsInfo = newStreamsInfo[:len(newStreamsInfo)-1]       // Truncate slice.
			rtc.Connections.data[data.Uid] = Connection{
				StreamsInfo: newStreamsInfo,
			}
		}

		outData := make(map[string]interface{})
		outData["name"] = data.StreamName

		ss.SendDataToAll <- socketServer.SendDataToAll{
			Data: socketMessages.ChangeData{
				Entity: "STREAM",
				Method: "DELETE",
				Data:   outData,
			},
			EventName: "CHANGE",
		}

		rtc.Connections.mutex.Unlock()
	}
}
