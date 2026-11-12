package provider

import (
	"context"
	"errors"
	"fmt"
	"time"
)

var (
	ErrMissingCredential = errors.New("provider credential is missing")
	ErrUnavailable       = errors.New("provider is unavailable")
	ErrInvalidResponse   = errors.New("provider returned an invalid response")
)

type Request struct {
	SystemPrompt string
	UserPrompt   string
}

type Response struct {
	Decision         string
	RefinedPrompt    string
	Model            string
	PromptTokens     int
	CompletionTokens int
}

type Provider interface {
	Refine(ctx context.Context, request Request) (Response, error)
	Model() string
}

type HTTPError struct {
	StatusCode int
	RetryAfter time.Duration
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("provider returned HTTP %d", e.StatusCode)
}

func (e *HTTPError) Temporary() bool {
	return e.StatusCode == 429 || e.StatusCode >= 500
}
