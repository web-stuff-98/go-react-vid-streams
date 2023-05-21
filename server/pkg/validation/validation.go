package validation

type StreamerLoginRegister struct {
	Name string `json:"name" validate:"required,gte=2,lte=16"`
}

type ServerLogin struct {
	Password string `json:"password" validate:"required,gte=8,lte=72"`
}

type CreateStream struct {
	Name string `json:"name" validate:"required,gte=2,lte=16"`
}
