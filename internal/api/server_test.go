package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"promptizer/internal/refine"
)

type fakeRefiner struct {
	mu      sync.Mutex
	calls   int
	block   chan struct{}
	started chan struct{}
	result  refine.Result
	err     error
}

func (f *fakeRefiner) Refine(ctx context.Context, _ refine.Request) (refine.Result, error) {
	f.mu.Lock()
	f.calls++
	f.mu.Unlock()
	if f.started != nil {
		select {
		case f.started <- struct{}{}:
		default:
		}
	}
	if f.block != nil {
		select {
		case <-f.block:
		case <-ctx.Done():
			return refine.Result{}, ctx.Err()
		}
	}
	return f.result, f.err
}

func (f *fakeRefiner) Model() string { return "fake-model" }

func newTestServer(t *testing.T, refiner Refiner) *Server {
	t.Helper()
	server, err := NewServer(refiner, Config{Address: "127.0.0.1:8765", Token: "pair-token", AllowedOrigin: "chrome-extension://test"})
	if err != nil {
		t.Fatal(err)
	}
	return server
}

func request(t *testing.T, server *Server, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, "http://127.0.0.1:8765"+path, strings.NewReader(body))
	req.Host = "127.0.0.1:8765"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer pair-token")
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, req)
	return recorder
}

func TestHealthAndSecurity(t *testing.T) {
	server := newTestServer(t, &fakeRefiner{})
	recorder := request(t, server, http.MethodGet, "/healthz", "")
	if recorder.Code != http.StatusOK || strings.Contains(recorder.Header().Get("Access-Control-Allow-Origin"), "*") {
		t.Fatalf("status=%d headers=%v", recorder.Code, recorder.Header())
	}
	badHost := httptest.NewRequest(http.MethodGet, "http://evil/healthz", nil)
	badHost.Host = "evil:8765"
	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, badHost)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("bad host status=%d", recorder.Code)
	}
	badOrigin := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8765/healthz", nil)
	badOrigin.Host = "127.0.0.1:8765"
	badOrigin.Header.Set("Origin", "https://evil.example")
	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, badOrigin)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("bad origin status=%d", recorder.Code)
	}
}

func TestRefineAuthValidationAndCache(t *testing.T) {
	refiner := &fakeRefiner{result: refine.Result{Decision: "refine", RefinedPrompt: "A clearer valid prompt.", Model: "fake-model"}}
	server := newTestServer(t, refiner)
	body := `{"request_id":"one","prompt":"a valid prompt","mode":"rewrite","source":"browser"}`

	unauthorized := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8765/v1/refine", strings.NewReader(body))
	unauthorized.Host = "127.0.0.1:8765"
	unauthorized.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, unauthorized)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status=%d", recorder.Code)
	}

	first := request(t, server, http.MethodPost, "/v1/refine", body)
	if first.Code != http.StatusOK {
		t.Fatalf("first status=%d body=%s", first.Code, first.Body.String())
	}
	second := request(t, server, http.MethodPost, "/v1/refine", strings.Replace(body, "one", "two", 1))
	if second.Code != http.StatusOK {
		t.Fatalf("second status=%d", second.Code)
	}
	var response refineResponse
	if err := json.NewDecoder(second.Body).Decode(&response); err != nil || !response.Cached || response.RequestID != "two" {
		t.Fatalf("response=%+v error=%v", response, err)
	}
	if refiner.calls != 1 {
		t.Fatalf("calls=%d", refiner.calls)
	}
}

func TestRefineRejectsBodyAndMethod(t *testing.T) {
	server := newTestServer(t, &fakeRefiner{})
	if got := request(t, server, http.MethodGet, "/v1/refine", "").Code; got != http.StatusMethodNotAllowed {
		t.Fatalf("method status=%d", got)
	}
	if got := request(t, server, http.MethodPost, "/v1/refine", `{broken`).Code; got != http.StatusBadRequest {
		t.Fatalf("malformed status=%d", got)
	}
	large := `{"request_id":"one","prompt":"` + string(bytes.Repeat([]byte("x"), MaxRequestBodyBytes)) + `"}`
	if got := request(t, server, http.MethodPost, "/v1/refine", large).Code; got != http.StatusRequestEntityTooLarge {
		t.Fatalf("large status=%d", got)
	}
	unknown := `{"request_id":"one","prompt":"a valid prompt","unknown":true}`
	if got := request(t, server, http.MethodPost, "/v1/refine", unknown).Code; got != http.StatusBadRequest {
		t.Fatalf("unknown status=%d", got)
	}
}

func TestBusyAndCancellation(t *testing.T) {
	block := make(chan struct{})
	started := make(chan struct{}, 1)
	refiner := &fakeRefiner{block: block, started: started, result: refine.Result{Decision: "keep", RefinedPrompt: "a valid prompt", Model: "fake"}}
	server := newTestServer(t, refiner)
	body := `{"request_id":"one","prompt":"a valid prompt"}`
	done := make(chan *httptest.ResponseRecorder, 1)
	go func() { done <- request(t, server, http.MethodPost, "/v1/refine", body) }()
	<-started
	busy := request(t, server, http.MethodPost, "/v1/refine", strings.Replace(body, "one", "two", 1))
	if busy.Code != http.StatusTooManyRequests {
		t.Fatalf("busy status=%d body=%s", busy.Code, busy.Body.String())
	}
	close(block)
	if result := <-done; result.Code != http.StatusOK {
		t.Fatalf("first status=%d", result.Code)
	}

	cancelRefiner := &fakeRefiner{block: make(chan struct{}), started: make(chan struct{}, 1)}
	cancelServer := newTestServer(t, cancelRefiner)
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8765/v1/refine", strings.NewReader(body))
	req.Host = "127.0.0.1:8765"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer pair-token")
	ctx, cancel := context.WithCancel(req.Context())
	req = req.WithContext(ctx)
	recorder := httptest.NewRecorder()
	doneRequest := make(chan struct{})
	go func() {
		cancelServer.Handler().ServeHTTP(recorder, req)
		close(doneRequest)
	}()
	<-cancelRefiner.started
	cancel()
	<-doneRequest
	if recorder.Code != http.StatusBadGateway && recorder.Code != http.StatusGatewayTimeout {
		t.Fatalf("canceled status=%d", recorder.Code)
	}
}

func TestLoopbackAddress(t *testing.T) {
	if err := ValidateLoopbackAddress("0.0.0.0:8765"); err == nil {
		t.Fatal("non-loopback address accepted")
	}
	if err := ValidateLoopbackAddress("127.0.0.1:8765"); err != nil {
		t.Fatal(err)
	}
}

func TestProviderErrorDoesNotLeak(t *testing.T) {
	server := newTestServer(t, &fakeRefiner{err: errors.New("secret prompt value")})
	recorder := request(t, server, http.MethodPost, "/v1/refine", `{"request_id":"one","prompt":"a valid prompt"}`)
	if strings.Contains(recorder.Body.String(), "secret") {
		t.Fatalf("error leaked: %s", recorder.Body.String())
	}
}
