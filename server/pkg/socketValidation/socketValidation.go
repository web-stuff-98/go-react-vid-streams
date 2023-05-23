package socketvalidation

type StreamInfo struct {
	MediaStreamID string `json:"media_stream_id"`
	StreamName    string `json:"name"`
	Motion        bool   `json:"motion"`
}

// WEBRTC_SENDING_SIGNAL
type WebRTCSendingSignal struct {
	Signal      string       `json:"signal" validation:"required,lte=4000"`
	Uid         string       `json:"to_uid"`
	StreamsInfo []StreamInfo `json:"streams_info"`
}

// WEBRTC_RETURNING_SIGNAL
type WebRTCReturningSignal struct {
	Signal      string       `json:"signal" validation:"required,lte=4000"`
	CallerID    string       `json:"caller_id"`
	StreamsInfo []StreamInfo `json:"streams_info"`
}

// WEBRTC_JOIN
type WebRTCJoin struct {
	StreamsInfo []StreamInfo `json:"streams_info"`
}

// WEBRTC_LEAVE
type WebRTCLeave struct{}

// WEBRTC_MOTION_UPDATE
type WebRTCMotionUpdate struct {
	MediaStreamID string `json:"media_stream_id"`
	Motion        bool   `json:"motion"`
}
