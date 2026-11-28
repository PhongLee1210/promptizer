#!/usr/bin/env bash
set -euo pipefail

manifest="${1:-.output/chrome-mv3/manifest.json}"

if [ ! -f "$manifest" ]; then
  echo "assert-manifest: $manifest not found; run 'pnpm exec wxt build' first" >&2
  exit 1
fi

jq -e '
  .manifest_version == 3
  and (.minimum_chrome_version | tonumber) >= 138
  and (.host_permissions // [] | length == 0)
  and ((.permissions // []) | sort == ["activeTab", "storage"])
' "$manifest" > /dev/null

echo "assert-manifest: $manifest ok"
