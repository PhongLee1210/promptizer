#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

SHIM_DEST="src/entrypoints/e2e-fake-nano.content.ts"

cleanup() {
  rm -f "$SHIM_DEST"
  pnpm build >/dev/null
}
trap cleanup EXIT

cp e2e/shim/e2e-fake-nano.content.ts "$SHIM_DEST"

pnpm build
node e2e/run-all.mjs
