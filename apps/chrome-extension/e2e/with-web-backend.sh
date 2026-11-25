#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

SHIM_DEST="src/entrypoints/e2e-fake-nano.content.ts"
WEB_PORT=3303

cleanup() {
  rm -f "$SHIM_DEST"
  pnpm build >/dev/null
}
trap cleanup EXIT

cp e2e/shim/e2e-fake-nano.content.ts "$SHIM_DEST"

WXT_API_ORIGIN="http://localhost:${WEB_PORT}" pnpm build
pnpm -C ../web build
WEB_PORT="$WEB_PORT" node --env-file=../web/.env e2e/web-link/auth-link.mjs
