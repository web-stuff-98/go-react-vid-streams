package handlers

import (
	"encoding/json"
	"sync"

	"github.com/gofiber/websocket/v2"
)

type SocketServer struct {
	Connections Connections

	SendData      chan SendData
	SendDataToUid chan SendDataToUid
	SendDataMulti chan SendDataMulti
	SendDataToAll chan SendDataToAll

	MessageLoop chan Message

	RegisterConn   chan ConnectionData
	UnregisterConn chan *websocket.Conn
}

// ------ Channels ------ //

type Message struct {
	Conn *websocket.Conn
	Data []byte
}

type SendData struct {
	Data      interface{}
	Conn      *websocket.Conn
	EventName string
}

type SendDataToUid struct {
	Data      interface{}
	Uid       string
	EventName string
}

type SendDataMulti struct {
	Data      interface{}
	Conns     map[*websocket.Conn]struct{}
	EventName string
}

type SendDataToAll struct {
	Data      interface{}
	EventName string
}

// ------ Mutex protected ------ //

type Connections struct {
	data  map[*websocket.Conn]string
	mutex sync.RWMutex
}

// ------ General structs ------ //

type ConnectionData struct {
	Uid  string
	Conn *websocket.Conn
}

func Init() *SocketServer {
	ss := &SocketServer{
		Connections: Connections{
			data: make(map[*websocket.Conn]string),
		},

		SendData:      make(chan SendData),
		SendDataToUid: make(chan SendDataToUid),
		SendDataMulti: make(chan SendDataMulti),
		SendDataToAll: make(chan SendDataToAll),

		RegisterConn:   make(chan ConnectionData),
		UnregisterConn: make(chan *websocket.Conn),
	}
	runServer(ss)
	return ss
}

func runServer(ss *SocketServer) {
	go sendData(ss)
	go sendDataMulti(ss)
	go sendDataToAll(ss)
	go messageLoop(ss)
	go registerConn(ss)
	go unregisterConn(ss)
}

func WriteMessage(t string, m interface{}, c *websocket.Conn, ss *SocketServer) {
	withType := make(map[string]interface{})
	withType["event_type"] = t
	withType["data"] = m

	if c == nil {
		return
	}

	if b, err := json.Marshal(withType); err == nil {
		ss.MessageLoop <- Message{
			Conn: c,
			Data: b,
		}
	}
}

// ------ Loops ------ //

func messageLoop(ss *SocketServer) {
	for {
		data := <-ss.MessageLoop

		data.Conn.WriteMessage(1, data.Data)
	}
}

func sendData(ss *SocketServer) {
	for {
		data := <-ss.SendData

		WriteMessage(data.EventName, data.Data, data.Conn, ss)
	}
}

func sendDataToUid(ss *SocketServer) {
	for {
		data := <-ss.SendDataToUid

		ss.Connections.mutex.Lock()

		for conn, uid := range ss.Connections.data {
			if uid == data.Uid {
				WriteMessage(data.EventName, data.Data, conn, ss)
				break
			}
		}

		ss.Connections.mutex.Unlock()
	}
}

func sendDataMulti(ss *SocketServer) {
	for {
		data := <-ss.SendDataMulti

		for c := range data.Conns {
			ss.SendData <- SendData{
				Conn:      c,
				Data:      data.Data,
				EventName: data.EventName,
			}
		}
	}
}

func sendDataToAll(ss *SocketServer) {
	for {
		data := <-ss.SendDataToAll

		ss.Connections.mutex.Lock()

		for c := range ss.Connections.data {
			WriteMessage(data.EventName, data.Data, c, ss)
		}

		ss.Connections.mutex.Unlock()
	}
}

func registerConn(ss *SocketServer) {
	for {
		data := <-ss.RegisterConn

		ss.Connections.mutex.Lock()

		ss.Connections.data[data.Conn] = data.Uid

		ss.Connections.mutex.Unlock()
	}
}

func unregisterConn(ss *SocketServer) {
	for {
		conn := <-ss.UnregisterConn

		ss.Connections.mutex.Lock()

		delete(ss.Connections.data, conn)

		ss.Connections.mutex.Unlock()
	}
}
