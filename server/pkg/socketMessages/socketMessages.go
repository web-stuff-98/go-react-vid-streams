package socketmessages

import socketValidation "github.com/web-stuff-98/go-react-vid-streams/pkg/socketValidation"

// TYPE: WEBRTC_JOINED_SIGNAL
type WebRTCUserJoined struct {
	Signal      string                        `json:"signal"`
	CallerID    string                        `json:"caller_id"`
	StreamsInfo []socketValidation.StreamInfo `json:"streams_info"`
}

// TYPE: WEBRTC_USER_LEFT/WEBRTC_USER_JOINED
type WebRTCUserJoinedLeft struct {
	Uid string `json:"uid"`
}

// TYPE: WEBRTC_RETURN_SIGNAL_OUT
type WebRTCReturnSignal struct {
	Uid         string                        `json:"uid"`
	Signal      string                        `json:"signal"`
	StreamsInfo []socketValidation.StreamInfo `json:"streams_info"`
}

// TYPE: WEBRTC_ALL_USERS
type WebRTCAllUsers struct {
	Users []WebRTCOutUser `json:"users"`
}
type WebRTCOutUser struct {
	Uid         string                        `json:"uid"`
	StreamsInfo []socketValidation.StreamInfo `json:"streams_info"`
}

// TYPE: WEBRTC_MOTION_UPDATE
type WebRTCMotionUpdate struct {
	MediaStreamID string `json:"media_stream_id"`
	Motion        bool   `json:"motion"`
	StreamerID    string `json:"streamer_id"`
}
