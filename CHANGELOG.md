# Changelog

All notable changes to Promptizer. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The GitHub release notes for each tag are generated from merged pull-request titles; this file is the
curated, human-written history.

## [Unreleased]

### Added

- Dependabot configuration for npm and GitHub Actions updates.
- `docs/architecture.md`, `docs/features.md`, `docs/README.md` and `CONTRIBUTING.md`.

### Fixed

- README and release notes documented a `Ctrl`/`Cmd`+`Shift`+`Y` shortcut and an 8-character minimum,
  neither of which exists in the build.
- The popup's Help link pointed at a README anchor that was never there.

## [0.1.2] - 2026-11-21

### Added

- Popup nav rail layout with provider logos and compact controls.

### Changed

- Serena TypeScript language server enabled for local development.
- Vendored agent skills excluded from Prettier and from version control.

## [0.1.1] - 2026-11-20

### Added

- On-demand Gemini Nano download with progress reporting on the chip, plus a six-step setup guide
  screen with screenshots.

### Changed

- Every raw colour replaced with a semantic `--pz-*` design token, enforced by a unit test.
- The unsupported-site main screen no longer offers an add-site button.

### Fixed

- Non-prose fields — passwords, one-time codes, card numbers, usernames, short inputs — no longer get
  a chip.
- The chip is sized and placed inside the editor's padding box instead of overlapping its border.

## [0.1.0] - 2026-11-19

First tagged release.

### Added

- WXT-built Chrome MV3 extension, no background worker, no runtime dependencies.
- Floating chip in a closed shadow root, anchored inside the focused prose editor.
- Nine actions: refine, improve, grammar, shorten, Vietnamese, English, professional, friendly,
  direct — all answered by on-device Gemini Nano through Chrome's Prompt API.
- Editable result preview with copy, inline edit, tweak, regenerate, history (10 entries) and a
  6-second undo window after replace.
- Popup settings: global on/off, platforms, model slots, providers, suggestions, Nano setup guide.
- Design-token stylesheet, build-time SVG icon inliner, Vitest unit suite and a Puppeteer e2e suite
  running against a real unpacked build.
- Tag-driven release workflow that builds the zip, writes `checksums.txt` and publishes the GitHub
  release, plus a manifest contract assertion in CI.

### Removed

- The Go backend and the Groq cloud fallback that preceded the on-device-only design.

[Unreleased]: https://github.com/PhongLee1210/promptizer/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/PhongLee1210/promptizer/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/PhongLee1210/promptizer/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/PhongLee1210/promptizer/releases/tag/v0.1.0
