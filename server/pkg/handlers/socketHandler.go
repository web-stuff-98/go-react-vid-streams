package handlers

import (
	"encoding/json"
	"fmt"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/websocket/v2"
	socketValidation "github.com/web-stuff-98/go-react-vid-streams/pkg/socketValidation"
	webRTCserver "github.com/web-stuff-98/go-react-vid-streams/pkg/webRTCserver"
)

func handleSocketEvent(data map[string]interface{}, event string, h handler, uid string, c *websocket.Conn) error {
	var err error

	switch event {
	case "WEBRTC_JOIN":
		err = webRTCJoin(data, h, uid, c)
	case "WEBRTC_LEAVE":
		err = webRTCLeave(data, h, uid, c)
	case "WEBRTC_SENDING_SIGNAL":
		err = webRTCSendingSignal(data, h, uid, c)
	case "WEBRTC_RETURNING_SIGNAL":
		err = webRTCReturningSignal(data, h, uid, c)
	case "WEBRTC_MOTION_UPDATE":
		err = webRTCMotionUpdate(data, h, uid, c)
	default:
		return fmt.Errorf("Unrecognized socket event")
	}

	return err
}

func UnmarshalMap(m map[string]interface{}, s interface{}) error {
	b, err := json.Marshal(m)
	if err != nil {
		return fmt.Errorf("Bad request")
	}
	err = json.Unmarshal(b, s)
	if err != nil {
		return fmt.Errorf("Bad request")
	}
	v := validator.New()
	if err := v.Struct(s); err != nil {
		return fmt.Errorf("Bad request")
	}
	return nil
}

func webRTCJoin(inData map[string]interface{}, h handler, uid string, c *websocket.Conn) error {
	data := &socketValidation.WebRTCJoin{}
	var err error
	if err = UnmarshalMap(inData, data); err != nil {
		return err
	}

	h.WebRTCServer.JoinWebRTC <- webRTCserver.JoinWebRTC{
		Uid:         uid,
		StreamsInfo: data.StreamsInfo,
	}

	return nil
}

func webRTCLeave(inData map[string]interface{}, h handler, uid string, c *websocket.Conn) error {
	data := &socketValidation.WebRTCLeave{}
	var err error
	if err = UnmarshalMap(inData, data); err != nil {
		return err
	}

	h.WebRTCServer.LeaveWebRTC <- webRTCserver.LeaveWebRTC{
		Uid: uid,
	}

	return nil
}

func webRTCSendingSignal(inData map[string]interface{}, h handler, uid string, c *websocket.Conn) error {
	data := &socketValidation.WebRTCSendingSignal{}
	var err error
	if err = UnmarshalMap(inData, data); err != nil {
		return err
	}

	h.WebRTCServer.SignalWebRTC <- webRTCserver.SignalWebRTC{
		Signal:      data.Signal,
		ToUid:       data.Uid,
		Uid:         uid,
		StreamsInfo: data.StreamsInfo,
	}

	return nil
}

func webRTCReturningSignal(inData map[string]interface{}, h handler, uid string, c *websocket.Conn) error {
	data := &socketValidation.WebRTCReturningSignal{}
	var err error
	if err = UnmarshalMap(inData, data); err != nil {
		return err
	}

	h.WebRTCServer.ReturnSignalWebRTC <- webRTCserver.ReturnSignalWebRTC{
		Signal:      data.Signal,
		CallerID:    data.CallerID,
		Uid:         uid,
		StreamsInfo: data.StreamsInfo,
	}

	return nil
}

func webRTCMotionUpdate(inData map[string]interface{}, h handler, uid string, c *websocket.Conn) error {
	data := &socketValidation.WebRTCMotionUpdate{}
	var err error
	if err = UnmarshalMap(inData, data); err != nil {
		return err
	}

	h.WebRTCServer.MotionUpdate <- webRTCserver.MotionUpdate{
		Uid:           uid,
		MediaStreamId: data.MediaStreamID,
		Motion:        data.Motion,
	}

	return nil
}
