package provider

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGroqSuccessAndContract(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer secret" {
			t.Error("missing authorization")
		}
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if got := int(payload["max_completion_tokens"].(float64)); got != MaxCompletionTokens {
			t.Fatalf("max_completion_tokens=%d", got)
		}
		format := payload["response_format"].(map[string]any)
		if format["type"] != "json_schema" {
			t.Fatalf("response format=%v", format)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"model":"test-model","choices":[{"message":{"content":"{\"decision\":\"refine\",\"refined_prompt\":\"A clearer prompt.\"}"}}],"usage":{"prompt_tokens":10,"completion_tokens":4}}`))
	}))
	defer server.Close()
	groq, err := NewGroq(GroqConfig{APIKey: "secret", ModelID: "test-model", BaseURL: server.URL, Client: server.Client()})
	if err != nil {
		t.Fatal(err)
	}
	result, err := groq.Refine(context.Background(), Request{SystemPrompt: "system", UserPrompt: "user"})
	if err != nil {
		t.Fatal(err)
	}
	if result.RefinedPrompt != "A clearer prompt." || result.PromptTokens != 10 {
		t.Fatalf("result=%+v", result)
	}
}

func TestGroqHTTPFailures(t *testing.T) {
	for _, status := range []int{http.StatusUnauthorized, http.StatusTooManyRequests, http.StatusInternalServerError} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Retry-After", "2")
				w.WriteHeader(status)
			}))
			defer server.Close()
			groq, _ := NewGroq(GroqConfig{APIKey: "secret", ModelID: "model", BaseURL: server.URL, Client: server.Client()})
			_, err := groq.Refine(context.Background(), Request{})
			var httpError *HTTPError
			if !errors.As(err, &httpError) || httpError.StatusCode != status {
				t.Fatalf("error=%v", err)
			}
			if status == http.StatusTooManyRequests && httpError.RetryAfter != 2*time.Second {
				t.Fatalf("retry after=%v", httpError.RetryAfter)
			}
		})
	}
}

func TestGroqMalformedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"not json"}}]}`))
	}))
	defer server.Close()
	groq, _ := NewGroq(GroqConfig{APIKey: "secret", ModelID: "model", BaseURL: server.URL, Client: server.Client()})
	_, err := groq.Refine(context.Background(), Request{})
	if !errors.Is(err, ErrInvalidResponse) {
		t.Fatalf("error=%v", err)
	}
}

func TestGroqCancellation(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		<-release
		_, _ = w.Write([]byte(`{"choices":[]}`))
	}))
	defer func() {
		close(release)
		server.Close()
	}()
	groq, _ := NewGroq(GroqConfig{APIKey: "secret", ModelID: "model", BaseURL: server.URL, Client: server.Client()})
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	started := time.Now()
	_, err := groq.Refine(ctx, Request{})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("error=%v", err)
	}
	if elapsed := time.Since(started); elapsed > 150*time.Millisecond {
		t.Fatalf("cancellation took %v", elapsed)
	}
}

func TestMissingCredential(t *testing.T) {
	if _, err := NewGroq(GroqConfig{ModelID: "model"}); !errors.Is(err, ErrMissingCredential) {
		t.Fatalf("error=%v", err)
	}
}
