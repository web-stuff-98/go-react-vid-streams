package handlers

import (
	"sync"

	"github.com/gofiber/websocket/v2"
)

type SocketServer struct {
	Connections Connections

	SendData      chan SendData
	SendDataMulti chan SendDataMulti
	SendDataToAll chan SendDataToAll

	RegisterConn   chan ConnectionData
	UnregisterConn chan *websocket.Conn
}

// ------ Channels ------ //

type SendData struct {
	Data      map[string]interface{}
	Conn      *websocket.Conn
	EventName string
}

type SendDataMulti struct {
	Data      map[string]interface{}
	Conns     map[*websocket.Conn]struct{}
	EventName string
}

type SendDataToAll struct {
	Data      map[string]interface{}
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
	go registerConn(ss)
	go unregisterConn(ss)
}

// ------ Loops ------ //

func sendData(ss *SocketServer) {
	for {
		data := <-ss.SendData

		outMsg := data.Data
		outMsg["event"] = data.EventName

		data.Conn.WriteJSON(outMsg)
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

		outMsg := data.Data
		outMsg["event"] = data.EventName

		ss.Connections.mutex.Lock()

		for c := range ss.Connections.data {
			c.WriteJSON(outMsg)
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
