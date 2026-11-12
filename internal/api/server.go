package api

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"strings"
	"time"

	"promptizer/internal/cache"
	"promptizer/internal/provider"
	"promptizer/internal/refine"
)

const MaxRequestBodyBytes = 8 << 10

type Refiner interface {
	Refine(context.Context, refine.Request) (refine.Result, error)
	Model() string
}

type Config struct {
	Address       string
	Token         string
	AllowedOrigin string
	ProviderName  string
}

type Server struct {
	refiner       Refiner
	expectedHost  string
	token         []byte
	allowedOrigin string
	providerName  string
	active        chan struct{}
	cache         *cache.Cache[string, refine.Result]
}

type refineRequest struct {
	RequestID   string   `json:"request_id"`
	Prompt      string   `json:"prompt"`
	TaskContext string   `json:"task_context,omitempty"`
	Constraints []string `json:"constraints,omitempty"`
	Mode        string   `json:"mode,omitempty"`
	Source      string   `json:"source,omitempty"`
	Trigger     string   `json:"trigger,omitempty"`
}

type refineResponse struct {
	RequestID     string `json:"request_id"`
	Decision      string `json:"decision"`
	RefinedPrompt string `json:"refined_prompt"`
	Model         string `json:"model"`
	Cached        bool   `json:"cached"`
}

type errorEnvelope struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func NewServer(refiner Refiner, config Config) (*Server, error) {
	if err := ValidateLoopbackAddress(config.Address); err != nil {
		return nil, err
	}
	if config.Token == "" {
		return nil, errors.New("pairing token is required")
	}
	providerName := config.ProviderName
	if providerName == "" {
		providerName = "groq"
	}
	return &Server{
		refiner:       refiner,
		expectedHost:  config.Address,
		token:         []byte(config.Token),
		allowedOrigin: config.AllowedOrigin,
		providerName:  providerName,
		active:        make(chan struct{}, 1),
		cache:         cache.New[string, refine.Result](50, 10*time.Minute),
	}, nil
}

func ValidateLoopbackAddress(address string) error {
	host, port, err := net.SplitHostPort(address)
	if err != nil || port == "" {
		return errors.New("listen address must include host and port")
	}
	if host != "127.0.0.1" {
		return errors.New("service must bind exactly to 127.0.0.1")
	}
	return nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.health)
	mux.HandleFunc("/v1/refine", s.handleRefine)
	return s.securityHeaders(mux)
}

func (s *Server) health(w http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		s.writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "provider": s.providerName})
}

func (s *Server) handleRefine(w http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		s.writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed.")
		return
	}
	mediaType, _, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		s.writeError(w, http.StatusUnsupportedMediaType, "INVALID_INPUT", "Content-Type must be application/json.")
		return
	}
	if !s.authorized(request.Header.Get("Authorization")) {
		s.writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Pairing is required.")
		return
	}
	body := http.MaxBytesReader(w, request.Body, MaxRequestBodyBytes)
	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()
	var input refineRequest
	if err := decoder.Decode(&input); err != nil {
		status := http.StatusBadRequest
		code := "INVALID_INPUT"
		if strings.Contains(err.Error(), "request body too large") {
			status, code = http.StatusRequestEntityTooLarge, "TOO_LARGE"
		}
		s.writeError(w, status, code, "Request body is invalid.")
		return
	}
	if err := ensureEOF(decoder); err != nil {
		s.writeError(w, http.StatusBadRequest, "INVALID_INPUT", "Request body must contain one JSON object.")
		return
	}
	if input.RequestID == "" || len(input.RequestID) > 128 || (input.Mode != "" && input.Mode != "rewrite") || (input.Trigger != "" && input.Trigger != "manual" && input.Trigger != "live") {
		s.writeError(w, http.StatusBadRequest, "INVALID_INPUT", "Request metadata is invalid.")
		return
	}
	refineInput := refine.Request{Prompt: input.Prompt, TaskContext: input.TaskContext, Constraints: input.Constraints, AllowRetry: input.Trigger != "live"}
	if _, err := refine.Validate(refineInput); err != nil {
		s.writeRefineError(w, err)
		return
	}
	key := s.cacheKey(refineInput)
	if result, ok := s.cache.Get(key); ok {
		s.writeResult(w, input.RequestID, result, true)
		return
	}
	select {
	case s.active <- struct{}{}:
		defer func() { <-s.active }()
	default:
		s.writeError(w, http.StatusTooManyRequests, "BUSY", "Another refinement is already running.")
		return
	}
	result, err := s.refiner.Refine(request.Context(), refineInput)
	if err != nil {
		s.writeRefineError(w, err)
		return
	}
	s.cache.Set(key, result)
	s.writeResult(w, input.RequestID, result, false)
}

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if request.Host != s.expectedHost {
			s.writeError(w, http.StatusBadRequest, "INVALID_HOST", "Request host is not allowed.")
			return
		}
		if origin := request.Header.Get("Origin"); origin != "" && (s.allowedOrigin == "" || origin != s.allowedOrigin) {
			s.writeError(w, http.StatusForbidden, "INVALID_ORIGIN", "Request origin is not allowed.")
			return
		}
		next.ServeHTTP(w, request)
	})
}

func (s *Server) authorized(header string) bool {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	provided := []byte(strings.TrimPrefix(header, prefix))
	return len(provided) == len(s.token) && subtle.ConstantTimeCompare(provided, s.token) == 1
}

func (s *Server) cacheKey(request refine.Request) string {
	data, _ := json.Marshal(struct {
		Request refine.Request `json:"request"`
		Model   string         `json:"model"`
	}{Request: request, Model: s.refiner.Model()})
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func (s *Server) writeResult(w http.ResponseWriter, requestID string, result refine.Result, cached bool) {
	writeJSON(w, http.StatusOK, refineResponse{RequestID: requestID, Decision: result.Decision, RefinedPrompt: result.RefinedPrompt, Model: result.Model, Cached: cached})
}

func (s *Server) writeRefineError(w http.ResponseWriter, err error) {
	var httpError *provider.HTTPError
	switch {
	case errors.Is(err, refine.ErrTooLarge):
		s.writeError(w, http.StatusRequestEntityTooLarge, "TOO_LARGE", "The selected text is too large.")
	case errors.Is(err, refine.ErrInvalidInput):
		s.writeError(w, http.StatusBadRequest, "INVALID_INPUT", "Enter a longer prompt before refining.")
	case errors.Is(err, context.DeadlineExceeded):
		s.writeError(w, http.StatusGatewayTimeout, "TIMEOUT", "Refinement timed out. Your draft has not been changed.")
	case errors.As(err, &httpError) && httpError.StatusCode == http.StatusTooManyRequests:
		s.writeError(w, http.StatusServiceUnavailable, "PROVIDER_UNAVAILABLE", "Refinement is temporarily rate limited. Your draft has not been changed.")
	case errors.As(err, &httpError), errors.Is(err, provider.ErrUnavailable):
		s.writeError(w, http.StatusBadGateway, "PROVIDER_UNAVAILABLE", "Refinement is unavailable. Your draft has not been changed.")
	default:
		s.writeError(w, http.StatusBadGateway, "PROVIDER_UNAVAILABLE", "Refinement returned an unusable result. Your draft has not been changed.")
	}
}

func (s *Server) writeError(w http.ResponseWriter, status int, code, message string) {
	value := errorEnvelope{}
	value.Error.Code = code
	value.Error.Message = message
	writeJSON(w, status, value)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func ensureEOF(decoder *json.Decoder) error {
	var extra any
	err := decoder.Decode(&extra)
	if errors.Is(err, io.EOF) {
		return nil
	}
	if err == nil {
		return fmt.Errorf("unexpected extra JSON value")
	}
	return err
}
