package socketmessages

// TYPE: WEBRTC_JOINED
type WebRTCUserJoined struct {
	Signal   string `json:"signal"`
	CallerID string `json:"caller_id"`
}

// TYPE: WEBRTC_LEFT
type WebRTCUserLeft struct {
	Uid string `json:"uid"`
}

// TYPE: WEBRTC_RETURN_SIGNAL_OUT
type WebRTCReturnSignal struct {
	Uid    string `json:"uid"`
	Signal string `json:"signal"`
}

// TYPE: WEBRTC_ALL_USERS
type WebRTCAllUsers struct {
	Users []WebRTCOutUser `json:"users"`
}
type WebRTCOutUser struct {
	Uid string `json:"uid"`
}
