.PHONY: icons typecheck test-ext build-ext format format-check verify clean

icons:
	pnpm -C apps/chrome-extension exec bash scripts/generate-icons.sh

typecheck:
	pnpm run typecheck

test-ext:
	pnpm run test

build-ext:
	pnpm run build

format:
	pnpm run format

format-check:
	pnpm run format:check

verify: typecheck test-ext format-check build-ext

clean:
	rm -rf ./dist
