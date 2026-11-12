package refine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"promptizer/internal/provider"
)

const (
	MinPromptRunes     = 8
	MaxPromptBytes     = 4000
	MaxContextBytes    = 2000
	MaxConstraints     = 8
	MaxConstraintBytes = 200
	MaxOutputBytes     = 4000
	ApproxInputBytes   = 4096
	inputOverheadBytes = 256
)

var (
	ErrInvalidInput  = errors.New("invalid input")
	ErrTooLarge      = errors.New("input is too large")
	ErrInvalidOutput = errors.New("invalid provider output")
)

type Request struct {
	Prompt      string   `json:"prompt"`
	TaskContext string   `json:"task_context,omitempty"`
	Constraints []string `json:"constraints,omitempty"`
	AllowRetry  bool     `json:"-"`
}

type Result struct {
	Decision         string `json:"decision"`
	RefinedPrompt    string `json:"refined_prompt"`
	Model            string `json:"model"`
	PromptTokens     int    `json:"-"`
	CompletionTokens int    `json:"-"`
}

type Service struct {
	provider provider.Provider
}

func NewService(p provider.Provider) *Service { return &Service{provider: p} }

func (s *Service) Model() string { return s.provider.Model() }

func (s *Service) Refine(ctx context.Context, request Request) (Result, error) {
	normalized, err := Validate(request)
	if err != nil {
		return Result{}, err
	}
	userPrompt, err := json.Marshal(map[string]any{
		"current_prompt": normalized.Prompt,
		"task_context":   normalized.TaskContext,
		"constraints":    normalized.Constraints,
	})
	if err != nil {
		return Result{}, fmt.Errorf("encode refinement request: %w", err)
	}
	providerRequest := provider.Request{SystemPrompt: systemPrompt, UserPrompt: string(userPrompt)}
	response, err := s.provider.Refine(ctx, providerRequest)
	if err != nil && normalized.AllowRetry && isTransient(err) {
		var httpError *provider.HTTPError
		if errors.As(err, &httpError) && httpError.RetryAfter > 0 {
			timer := time.NewTimer(httpError.RetryAfter)
			select {
			case <-ctx.Done():
				timer.Stop()
				return Result{}, ctx.Err()
			case <-timer.C:
			}
		}
		response, err = s.provider.Refine(ctx, providerRequest)
	}
	if err != nil {
		return Result{}, err
	}
	if err := validateOutput(normalized.Prompt, response.Decision, response.RefinedPrompt); err != nil {
		return Result{}, err
	}
	return Result{
		Decision:         response.Decision,
		RefinedPrompt:    response.RefinedPrompt,
		Model:            response.Model,
		PromptTokens:     response.PromptTokens,
		CompletionTokens: response.CompletionTokens,
	}, nil
}

func isTransient(err error) bool {
	var httpError *provider.HTTPError
	return errors.As(err, &httpError) && httpError.Temporary()
}

func Validate(request Request) (Request, error) {
	request.Prompt = strings.TrimSpace(request.Prompt)
	request.TaskContext = strings.TrimSpace(request.TaskContext)
	if utf8.RuneCountInString(request.Prompt) < MinPromptRunes {
		return Request{}, fmt.Errorf("%w: prompt must contain at least %d characters", ErrInvalidInput, MinPromptRunes)
	}
	if len([]byte(request.Prompt)) > MaxPromptBytes {
		return Request{}, fmt.Errorf("%w: prompt exceeds %d bytes", ErrTooLarge, MaxPromptBytes)
	}
	if len([]byte(request.TaskContext)) > MaxContextBytes {
		return Request{}, fmt.Errorf("%w: context exceeds %d bytes", ErrTooLarge, MaxContextBytes)
	}
	if len(request.Constraints) > MaxConstraints {
		return Request{}, fmt.Errorf("%w: too many constraints", ErrTooLarge)
	}
	for index, constraint := range request.Constraints {
		request.Constraints[index] = strings.TrimSpace(constraint)
		if len([]byte(request.Constraints[index])) > MaxConstraintBytes {
			return Request{}, fmt.Errorf("%w: constraint %d exceeds %d bytes", ErrTooLarge, index+1, MaxConstraintBytes)
		}
	}
	remaining := ApproxInputBytes - inputOverheadBytes - len([]byte(request.Prompt))
	for _, constraint := range request.Constraints {
		remaining -= len([]byte(constraint))
	}
	if remaining < 0 {
		remaining = 0
	}
	if len([]byte(request.TaskContext)) > remaining {
		request.TaskContext = trimUTF8(request.TaskContext, remaining)
	}
	return request, nil
}

func trimUTF8(value string, maximum int) string {
	if maximum <= 0 {
		return ""
	}
	bytes := []byte(value)
	if len(bytes) <= maximum {
		return value
	}
	bytes = bytes[:maximum]
	for len(bytes) > 0 && !utf8.Valid(bytes) {
		bytes = bytes[:len(bytes)-1]
	}
	return strings.TrimSpace(string(bytes))
}

func validateOutput(originalPrompt, decision, refinedPrompt string) error {
	if decision != "keep" && decision != "refine" {
		return fmt.Errorf("%w: unknown decision", ErrInvalidOutput)
	}
	if len([]byte(refinedPrompt)) > MaxOutputBytes {
		return fmt.Errorf("%w: refined prompt exceeds %d bytes", ErrInvalidOutput, MaxOutputBytes)
	}
	trimmed := strings.TrimSpace(refinedPrompt)
	if trimmed == "" || trimmed != refinedPrompt || strings.ContainsAny(refinedPrompt, "\r\n") {
		return fmt.Errorf("%w: refined prompt must be one trimmed paragraph", ErrInvalidOutput)
	}
	for _, prefix := range []string{"#", "- ", "* ", "• ", "1. ", "1) "} {
		if strings.HasPrefix(refinedPrompt, prefix) {
			return fmt.Errorf("%w: refined prompt must not be a heading or list", ErrInvalidOutput)
		}
	}
	if decision == "keep" && refinedPrompt != originalPrompt {
		return fmt.Errorf("%w: keep result changed the prompt", ErrInvalidOutput)
	}
	return nil
}
