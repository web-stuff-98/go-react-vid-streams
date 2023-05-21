package socketvalidation

// WEBRTC_SENDING_SIGNAL
type WebRTCSendingSignal struct {
	Signal string `json:"signal" validation:"required,lte=4000"`
	Uid    string `json:"to_uid"`
}

// WEBRTC_RETURNING_SIGNAL
type WebRTCReturningSignal struct {
	Signal   string `json:"signal" validation:"required,lte=4000"`
	CallerID string `json:"caller_id"`
}

// WEBRTC_JOIN
type WebRTCJoin struct {
	ChannelID string `json:"channel_id"`
}

// WEBRTC_LEAVE
type WebRTCLeave struct {
	ChannelID string `json:"channel_id"`
}
