package handlers

import (
	"fmt"

	"github.com/gofiber/websocket/v2"
)

func handleSocketEvent(data map[string]interface{}, event string, h handler, uid string, c *websocket.Conn) error {
	var err error

	switch event {
	case "WEBRTC_JOIN":
		err = webRTCJoin(data, h, c)
	case "WEBRTC_LEAVE":
		err = webRTCLeave(data, h, c)
	case "WEBRTC_SENDING_SIGNAL":
		err = webRTCSendingSignal(data, h, c)
	case "WEBRTC_RETURNING_SIGNAL":
		err = webRTCReturningSignal(data, h, c)
	default:
		return fmt.Errorf("Unrecognized socket event")
	}

	return err
}
