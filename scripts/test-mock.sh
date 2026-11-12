#!/bin/sh
set -eu

mock_log="${TMPDIR:-/tmp}/promptizer-mock-groq.log"
GOCACHE="${TMPDIR:-/tmp}/promptizer-go-cache" go run ./scripts/mock-groq/main.go >"$mock_log" 2>&1 &
mock_pid=$!
trap 'kill "$mock_pid" 2>/dev/null || true; wait "$mock_pid" 2>/dev/null || true' EXIT INT TERM

attempt=0
while ! curl --fail --silent \
  -H 'Authorization: Bearer mock-key' \
  http://127.0.0.1:18765/openai/v1/models >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 150 ]; then
    echo "mock did not start; see $mock_log" >&2
    exit 1
  fi
  sleep 0.1
done

models=$(curl --fail --silent --show-error \
  -H 'Authorization: Bearer mock-key' \
  http://127.0.0.1:18765/openai/v1/models)
completion=$(curl --fail --silent --show-error \
  -H 'Authorization: Bearer mock-key' \
  -H 'Content-Type: application/json' \
  --data '{"model":"mock-refiner-small","messages":[{"role":"user","content":"test"}]}' \
  http://127.0.0.1:18765/openai/v1/chat/completions)

printf '%s\n' "$models" | grep -q 'mock-refiner-small'
printf '%s\n' "$completion" | grep -q 'refined_prompt'
echo 'mock Groq responder: PASS'

