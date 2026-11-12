#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
phase_dir=$(mktemp -d "${TMPDIR:-/tmp}/promptizer-bench.XXXXXX")
token_file="$phase_dir/token"
mock_log="$phase_dir/mock.log"
service_log="$phase_dir/service.log"
times_file="$phase_dir/times.txt"
concurrent_file="$phase_dir/concurrent.txt"
mock_pid=""
service_pid=""

cleanup() {
  [ -z "$service_pid" ] || kill "$service_pid" 2>/dev/null || true
  [ -z "$mock_pid" ] || kill "$mock_pid" 2>/dev/null || true
  [ -z "$service_pid" ] || wait "$service_pid" 2>/dev/null || true
  [ -z "$mock_pid" ] || wait "$mock_pid" 2>/dev/null || true
  rm -rf "${phase_dir:?}"
}
trap cleanup EXIT INT TERM

cd "$root_dir"
GOCACHE="${TMPDIR:-/tmp}/promptizer-go-cache" go build -trimpath -ldflags='-s -w' -o ./bin/promptrefine ./cmd/promptrefine
GOCACHE="${TMPDIR:-/tmp}/promptizer-go-cache" go run ./scripts/mock-groq/main.go >"$mock_log" 2>&1 &
mock_pid=$!

attempt=0
until curl --silent --fail -H 'Authorization: Bearer mock-key' http://127.0.0.1:18765/openai/v1/models >/dev/null; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 100 ] || { echo "mock failed to start" >&2; exit 1; }
  sleep 0.1
done

PROMPTREFINE_TOKEN_FILE="$token_file" ./bin/promptrefine pair >"$phase_dir/token.out"
token=$(tr -d '\n' <"$phase_dir/token.out")
GROQ_API_KEY=mock-key \
GROQ_BASE_URL=http://127.0.0.1:18765/openai/v1 \
PROMPTREFINE_MODEL=mock-refiner-small \
PROMPTREFINE_TOKEN_FILE="$token_file" \
./bin/promptrefine serve >"$service_log" 2>&1 &
service_pid=$!

attempt=0
until curl --silent --fail http://127.0.0.1:8765/healthz >/dev/null; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 100 ] || { echo "service failed to start" >&2; exit 1; }
  sleep 0.1
done

index=1
while [ "$index" -le 100 ]; do
  curl --silent --fail --output /dev/null --write-out '%{time_total}\n' \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data "{\"request_id\":\"sequential-$index\",\"prompt\":\"Improve this valid benchmark prompt number $index without changing intent.\"}" \
    http://127.0.0.1:8765/v1/refine >>"$times_file"
  index=$((index + 1))
done

index=1
concurrent_pids=""
while [ "$index" -le 20 ]; do
  (
    curl --silent --output /dev/null --write-out '%{http_code}\n' \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      --data "{\"request_id\":\"concurrent-$index\",\"prompt\":\"Improve this concurrent benchmark prompt number $index without changing intent.\"}" \
      http://127.0.0.1:8765/v1/refine >>"$concurrent_file"
  ) &
  concurrent_pids="$concurrent_pids $!"
  index=$((index + 1))
done
for concurrent_pid in $concurrent_pids; do
  wait "$concurrent_pid"
done

sorted="$phase_dir/sorted.txt"
sort -n "$times_file" >"$sorted"
p50=$(awk 'NR==50 {printf "%.3f", $1*1000}' "$sorted")
p95=$(awk 'NR==95 {printf "%.3f", $1*1000}' "$sorted")
maximum=$(awk 'END {printf "%.3f", $1*1000}' "$sorted")
rss_kib=$(ps -o rss= -p "$service_pid" | tr -d ' ')
cpu_pct=$(ps -o %cpu= -p "$service_pid" | tr -d ' ')
ok_count=$(awk '$1==200 {count++} END {print count+0}' "$concurrent_file")
busy_count=$(awk '$1==429 {count++} END {print count+0}' "$concurrent_file")

printf 'sequential_count=100\n'
printf 'local_p50_ms=%s\n' "$p50"
printf 'local_p95_ms=%s\n' "$p95"
printf 'local_max_ms=%s\n' "$maximum"
printf 'service_rss_kib=%s\n' "$rss_kib"
printf 'service_cpu_pct_snapshot=%s\n' "$cpu_pct"
printf 'concurrent_http_200=%s\n' "$ok_count"
printf 'concurrent_http_429=%s\n' "$busy_count"

