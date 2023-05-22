package validation

type StreamerLoginRegister struct {
	Name string `json:"name" validate:"required,gte=2,lte=16"`
}

type InitialLogin struct {
	StreamerName   string `json:"streamer_name" validate:"required,gte=2,lte=16"`
	ServerPassword string `json:"server_password" validate:"required,gte=8,lte=72"`
}

type CreateStream struct {
	Name string `json:"name" validate:"required,gte=2,lte=16"`
}
