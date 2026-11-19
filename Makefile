.PHONY: icons test-ext typecheck format format-check verify clean

icons:
	bash scripts/generate-icons.sh

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

verify: typecheck test-ext format-check build-ext

clean:
	rm -rf ./dist
