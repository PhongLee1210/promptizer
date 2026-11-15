GOCACHE ?= $(TMPDIR)/promptizer-go-cache

.PHONY: build build-ext icons test test-race test-js test-ext typecheck lint format format-check verify clean

build:
	mkdir -p bin
	GOCACHE="$(GOCACHE)" go build -trimpath -ldflags='-s -w' -o ./bin/promptrefine ./cmd/promptrefine

icons:
	bash scripts/generate-icons.sh

test:
	GOCACHE="$(GOCACHE)" go test ./...

test-race:
	GOCACHE="$(GOCACHE)" go test -race ./...

test-js:
	node --check extension/core.js
	node --check extension/nano.js
	node --check extension/provider-router.js
	node --check extension/background.js
	node --check extension/content.js
	node --check extension/options.js
	node --check extension/adapters/chatgpt.js
	node --check extension/adapters/claude.js
	node --test extension/tests/*.test.js
	jq -e '.manifest_version == 3 and (.minimum_chrome_version | tonumber) >= 138 and (.host_permissions == ["http://127.0.0.1:8765/*"]) and (.permissions | index("offscreen") | not)' extension/manifest.json

typecheck:
	pnpm exec wxt prepare
	pnpm exec tsc --noEmit

test-ext:
	pnpm exec vitest run

build-ext:
	pnpm exec wxt build
	bash scripts/assert-manifest.sh

format:
	pnpm exec prettier --write .

format-check:
	pnpm exec prettier --check .

lint:
	pnpm exec eslint extension

verify: test test-race test-js typecheck test-ext format-check lint build build-ext

clean:
	rm -f ./bin/promptrefine
