package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const MaxCompletionTokens = 192

type GroqConfig struct {
	APIKey  string
	ModelID string
	BaseURL string
	Client  *http.Client
}

type Groq struct {
	apiKey  string
	modelID string
	url     string
	client  *http.Client
}

func NewGroq(config GroqConfig) (*Groq, error) {
	if strings.TrimSpace(config.APIKey) == "" {
		return nil, ErrMissingCredential
	}
	if strings.TrimSpace(config.ModelID) == "" {
		return nil, errors.New("provider model is required")
	}
	baseURL := strings.TrimRight(config.BaseURL, "/")
	if baseURL == "" {
		baseURL = "https://api.groq.com/openai/v1"
	}
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, errors.New("provider base URL is invalid")
	}
	client := config.Client
	if client == nil {
		client = &http.Client{Timeout: 6 * time.Second}
	}
	return &Groq{
		apiKey:  config.APIKey,
		modelID: config.ModelID,
		url:     baseURL + "/chat/completions",
		client:  client,
	}, nil
}

func (g *Groq) Model() string { return g.modelID }

func (g *Groq) Refine(ctx context.Context, request Request) (Response, error) {
	payload := map[string]any{
		"model":                 g.modelID,
		"messages":              []map[string]string{{"role": "system", "content": request.SystemPrompt}, {"role": "user", "content": request.UserPrompt}},
		"temperature":           0.2,
		"max_completion_tokens": MaxCompletionTokens,
		"stream":                false,
		"reasoning_effort":      "low",
		"reasoning_format":      "hidden",
		"response_format": map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "prompt_refinement",
				"strict": true,
				"schema": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"decision":       map[string]any{"type": "string", "enum": []string{"refine", "keep"}},
						"refined_prompt": map[string]string{"type": "string"},
					},
					"required":             []string{"decision", "refined_prompt"},
					"additionalProperties": false,
				},
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return Response{}, fmt.Errorf("encode provider request: %w", err)
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, g.url, bytes.NewReader(body))
	if err != nil {
		return Response{}, fmt.Errorf("create provider request: %w", err)
	}
	httpRequest.Header.Set("Authorization", "Bearer "+g.apiKey)
	httpRequest.Header.Set("Content-Type", "application/json")

	httpResponse, err := g.client.Do(httpRequest)
	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return Response{}, err
		}
		return Response{}, ErrUnavailable
	}
	defer httpResponse.Body.Close()
	if httpResponse.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(httpResponse.Body, 16<<10))
		return Response{}, &HTTPError{StatusCode: httpResponse.StatusCode, RetryAfter: parseRetryAfter(httpResponse.Header.Get("Retry-After"))}
	}

	var wire struct {
		Model   string `json:"model"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}
	decoder := json.NewDecoder(io.LimitReader(httpResponse.Body, 64<<10))
	if err := decoder.Decode(&wire); err != nil || len(wire.Choices) != 1 {
		return Response{}, ErrInvalidResponse
	}
	var result struct {
		Decision      string `json:"decision"`
		RefinedPrompt string `json:"refined_prompt"`
	}
	if err := json.Unmarshal([]byte(wire.Choices[0].Message.Content), &result); err != nil {
		return Response{}, ErrInvalidResponse
	}
	return Response{
		Decision:         result.Decision,
		RefinedPrompt:    result.RefinedPrompt,
		Model:            firstNonempty(wire.Model, g.modelID),
		PromptTokens:     wire.Usage.PromptTokens,
		CompletionTokens: wire.Usage.CompletionTokens,
	}, nil
}

func parseRetryAfter(value string) time.Duration {
	seconds, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || seconds < 0 {
		return 0
	}
	return time.Duration(seconds) * time.Second
}

func firstNonempty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
