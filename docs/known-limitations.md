# Known limitations

- Gemini Nano requires Chrome 138+ and Chrome-supported hardware. Chrome's documented CPU path requires at least 16 GB RAM and four CPU cores, so the original 8 GB target should be expected to use Groq fallback rather than Nano.
- Gemini Nano's documented text languages are currently English, Spanish, Japanese, German, and French. Promptizer routes recognizable Vietnamese and other unsupported scripts to Groq; ambiguous Latin-only language detection remains best-effort.
- Chrome's Prompt API has no direct maximum-output-token setting. Promptizer uses a JSON Schema character cap plus an independent UTF-8 byte/paragraph validator instead.
- The Prompt API path is covered by mocked contract and routing tests, but real model download, inference quality, latency, and worker-context availability still require the manual Chrome checklist.
- ChatGPT and Claude change their editor DOMs without notice. The adapters use narrow current selectors and refuse unsupported editors, but real-site acceptance is still required on the user's Chrome installation.
- The 30-run GPT-OSS 120B timing sample had two `json_validate_failed` responses, both on the Vietnamese case. Errors preserve the draft and can be retried manually.
- The curated set contains 51 cases, not the final 100 human-reviewed held-out cases. Current model results are an engineering screen, not the Phase 5 quality guarantee.
- Extension memory and CPU must be measured in Chrome Task Manager after manual installation; only the Go process has been measured automatically.
- Measurements were collected on a 16 GB Apple M2 Mac mini. Final reproduction on the approved 8 GB target remains outstanding.
- Unpacked-extension IDs can change when the directory is reloaded or moved. Copy the current origin from options and restart the service with the matching `PROMPTREFINE_EXTENSION_ORIGIN`.
- Pairing is local and manual; there is no Keychain integration, automatic service launch, menu-bar application, or account sync.
- Context selection is limited to explicitly selected visible text from up to two detected turns; unsupported page structures fall back to selected text and still require confirmation.
- Live mode is best-effort and intentionally conservative. It is disabled by default and may skip refinements during rapid typing, IME composition, focus changes, rate limits, or provider failures.

