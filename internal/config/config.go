package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

const DefaultModel = "openai/gpt-oss-120b"

type Config struct {
	APIKey          string
	Model           string
	GroqBaseURL     string
	Timeout         time.Duration
	Address         string
	ExtensionOrigin string
	TokenFile       string
}

func Load() (Config, error) {
	timeout := 6 * time.Second
	if raw := os.Getenv("PROMPTREFINE_TIMEOUT"); raw != "" {
		parsed, err := time.ParseDuration(raw)
		if err != nil || parsed <= 0 {
			return Config{}, fmt.Errorf("invalid PROMPTREFINE_TIMEOUT")
		}
		timeout = parsed
	}
	model := os.Getenv("PROMPTREFINE_MODEL")
	if model == "" {
		model = DefaultModel
	}
	address := os.Getenv("PROMPTREFINE_ADDR")
	if address == "" {
		address = "127.0.0.1:8765"
	}
	return Config{
		APIKey:          os.Getenv("GROQ_API_KEY"),
		Model:           model,
		GroqBaseURL:     os.Getenv("GROQ_BASE_URL"),
		Timeout:         timeout,
		Address:         address,
		ExtensionOrigin: os.Getenv("PROMPTREFINE_EXTENSION_ORIGIN"),
		TokenFile:       os.Getenv("PROMPTREFINE_TOKEN_FILE"),
	}, nil
}

func BoolEnv(name string, fallback bool) bool {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}
