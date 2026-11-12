package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"time"
)

const mockKey = "mock-key"

func main() {
	addr := flag.String("addr", "127.0.0.1:18765", "loopback listen address")
	flag.Parse()

	mux := http.NewServeMux()
	mux.HandleFunc("/openai/v1/models", authenticated(models))
	mux.HandleFunc("/openai/v1/chat/completions", authenticated(completions))
	server := &http.Server{
		Addr:              *addr,
		Handler:           mux,
		ReadHeaderTimeout: 2 * time.Second,
		ReadTimeout:       2 * time.Second,
		WriteTimeout:      2 * time.Second,
		IdleTimeout:       5 * time.Second,
	}
	log.Printf("mock Groq listening on %s", *addr)
	log.Fatal(server.ListenAndServe())
}

func authenticated(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+mockKey {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": map[string]string{"message": "invalid test credential"}})
			return
		}
		next(w, r)
	}
}

func models(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"object": "list", "data": []map[string]any{
		{"id": "mock-refiner-small", "object": "model", "active": true},
		{"id": "mock-refiner-large", "object": "model", "active": true},
	}})
}

func completions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	defer r.Body.Close()
	var request map[string]any
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
	if err := decoder.Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]string{"message": "invalid JSON"}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":     "mock-completion-1",
		"object": "chat.completion",
		"model":  "mock-refiner-small",
		"choices": []map[string]any{{
			"index":         0,
			"message":       map[string]string{"role": "assistant", "content": `{"decision":"refine","refined_prompt":"Make the existing Contact button remain visible while scrolling. Preserve the current design and do not modify unrelated components."}`},
			"finish_reason": "stop",
		}},
		"usage": map[string]int{"prompt_tokens": 24, "completion_tokens": 26, "total_tokens": 50},
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
