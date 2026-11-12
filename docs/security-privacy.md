# Security and privacy checklist

## Verified automatically or by code audit

- [x] Service address validation accepts only `127.0.0.1`, never `0.0.0.0` or a public interface.
- [x] `/v1/refine` uses a cryptographically random 256-bit bearer token and constant-time comparison.
- [x] Pairing-token file is created with owner-only `0600` permissions; rerunning `pair` revokes the previous token.
- [x] Exact Host and configured Origin checks run before handlers; no wildcard CORS header is emitted.
- [x] Methods, content type, unknown JSON fields, request metadata, and 8 KiB body size are validated.
- [x] Extension permissions are limited to storage, active-tab messaging, ChatGPT/Claude content-script matches, and the loopback API host; Prompt API needs no extra manifest permission.
- [x] No `externally_connectable`, broad tab-host permission, clipboard permission, file permission, or remote script is declared.
- [x] The Groq key is read only by the Go process and never enters extension code, page storage, URLs, or logs.
- [x] Raw prompts, context, and completions are not logged by the service or benchmark reports.
- [x] Provider and API errors are redacted and never echo prompt text or credentials.
- [x] Preview UI uses a closed shadow root; the pairing token remains in the extension service worker/options storage, not the page DOM.
- [x] Original editor content changes only after **Replace**, is verified afterward, and restoration is attempted if insertion fails.
- [x] No code path clicks or invokes the host site's send control.
- [x] Requests are bounded by size, concurrency, timeout, cache count/TTL, live debounce, and request spacing.
- [x] Gemini Nano sessions use structured output, are destroyed after each request, and never trigger a cloud fallback after user cancellation.
- [x] Provider identity is shown in every preview; cloud fallback can be disabled or bypassed with Groq-only compatibility mode.

## Manual acceptance

- [ ] Inspect Chrome DevTools on both sites for unexpected prompt/token console or storage exposure.
- [ ] Confirm the extension origin configured on the service exactly matches the loaded unpacked extension.
- [ ] Review Groq account retention settings; Zero Data Retention is not assumed.
- [ ] Test current ChatGPT and Claude editors for safe failure after site DOM changes.
- [ ] Verify network requests contain only the current prompt and explicitly consented context.
- [ ] Verify Nano-ready refinement creates no loopback or Groq request, and Groq fallback creates exactly one bounded loopback request.

