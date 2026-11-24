# Release checklist

Releases are tag-driven. Pushing a `v*` tag runs
[`.github/workflows/release.yml`](../.github/workflows/release.yml), which builds the extension zip
and publishes the GitHub release. Nothing is created by hand in the GitHub UI.

## Before tagging

- [ ] On `main`, up to date, working tree clean — `git status`
- [ ] Everything shipping is merged through a pull request (the changelog is generated from PR titles)
- [ ] Full check suite passes — `make verify`
- [ ] Install steps in [`.github/RELEASE.md`](../.github/RELEASE.md) still accurate

## Tag and push

```bash
pnpm -C apps/chrome-extension version 0.2.0  # bumps the version, commits, creates tag v0.2.0
git push origin main --follow-tags
```

First release only, where `apps/chrome-extension/package.json` already holds the version:

```bash
git tag -a v0.1.0 -m "Promptizer v0.1.0"
git push origin v0.1.0
```

## After pushing

- [ ] Watch the build — `gh run watch`
- [ ] Open the release — `gh release view v0.2.0 --web`
- [ ] Confirm assets: `promptizer-<version>-chrome.zip` and `checksums.txt`
- [ ] Install the zip on a clean profile and run one refine end to end

## If the build fails

| Failure                            | Cause                                     | Fix                                                                       |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `tag vX does not match the extension package version` | Tagged without bumping | Delete the tag, use `pnpm -C apps/chrome-extension version`             |
| `assert-manifest` fails            | Manifest drifted from the shipped contract | Fix `wxt.config.ts`, retag                                                |
| Release published with bad assets  | —                                         | `gh release delete v0.2.0 --cleanup-tag`, fix, retag                      |

Delete a tag that never shipped:

```bash
git tag -d v0.2.0 && git push origin :refs/tags/v0.2.0
```
