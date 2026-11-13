GOCACHE ?= $(TMPDIR)/promptizer-go-cache

.PHONY: build test test-race test-js lint verify clean

build:
	mkdir -p bin
	GOCACHE="$(GOCACHE)" go build -trimpath -ldflags='-s -w' -o ./bin/promptrefine ./cmd/promptrefine

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

lint:
	./node_modules/.bin/eslint extension

verify: test test-race test-js lint build

clean:
	rm -f ./bin/promptrefine
