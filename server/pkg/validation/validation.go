package validation

type StreamerRegister struct {
	Name     string `json:"name" validate:"required,gte=2,lte=16"`
	Password string `json:"password" validate:"required,gte=8,lte=72"`
}

type StreamerLogin struct {
	Name     string `json:"name" validate:"required,gte=2,lte=16"`
	Password string `json:"password" validate:"required,gte=8,lte=72"`
}

type ServerLogin struct {
	Password string `json:"password" validate:"required,gte=8,lte=72"`
}

type CreateStream struct {
	Name string `json:"name" validate:"required,gte=2,lte=16"`
}
