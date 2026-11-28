#!/usr/bin/env bash
set -euo pipefail

manifest="${1:-.output/chrome-mv3/manifest.json}"

if [ ! -f "$manifest" ]; then
  echo "assert-manifest: $manifest not found; run 'pnpm exec wxt build' first" >&2
  exit 1
fi

failures="$(jq -r '
  def require(passes; message): if passes then empty else message end;
  require(.manifest_version == 3; "manifest_version must be 3, got \(.manifest_version)"),
  require((.minimum_chrome_version // "0" | tonumber) >= 138; "minimum_chrome_version must be at least 138, got \(.minimum_chrome_version)"),
  require(.host_permissions // [] | length == 0; "host_permissions must be empty, got \(.host_permissions)"),
  require(.optional_permissions // [] | length == 0; "optional_permissions must be empty, got \(.optional_permissions)"),
  require(.optional_host_permissions // [] | length == 0; "optional_host_permissions must be empty, got \(.optional_host_permissions)"),
  require((.permissions // []) | sort == ["activeTab", "storage"]; "permissions must be exactly [\"activeTab\",\"storage\"], got \(.permissions // [] | tojson)")
' "$manifest")"

if [ -n "$failures" ]; then
  while IFS= read -r failure; do
    echo "assert-manifest: $manifest: $failure" >&2
  done <<< "$failures"
  exit 1
fi

echo "assert-manifest: $manifest ok"
