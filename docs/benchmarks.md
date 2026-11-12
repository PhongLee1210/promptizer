# MVP benchmark report

Measured 2026-11-12 on an Apple M2 Mac mini with 16 GB RAM, macOS 27.2.1, Go 1.26.3, and Chrome 157. The approved final target is an 8 GB Mac mini, so target-device reproduction remains outstanding.

## CLI with deterministic local provider

| Metric | Result |
|---|---:|
| Cold command wall time | 30 ms |
| Maximum resident set size | 11,747,328 bytes (~11.2 MiB) |
| Ten mock refinements | 25.899–28.794 ms |
| Process after exit | None |

The CLI invoked the compiled binary once per sample and contacted only the loopback mock provider.

## Local service with deterministic provider

| Metric | Result |
|---|---:|
| 100 sequential requests, P50 | 0.519 ms |
| 100 sequential requests, P95 | 0.815 ms |
| 100 sequential requests, maximum | 2.557 ms |
| RSS snapshot after load | 16,640 KiB (~16.3 MiB) |
| CPU snapshot during/after load | 4.4% of one core |
| 20 short concurrent attempts | 14 HTTP 200, 6 bounded HTTP 429 |

The mock completes very quickly, so multiple concurrent attempts can run serially between overlaps; the important invariant is that overlapping work is bounded and excess work receives `BUSY` rather than accumulating.

## Service idle window

Twelve samples at five-second spacing over approximately 60 seconds:

- CPU: 0.0% in every `ps` sample.
- RSS: 11,216 KiB for the first two samples, then 7,584 KiB for ten samples.
- Settled RSS: ~7.4 MiB; maximum observed: ~11.0 MiB.
- No provider call occurred during startup, health checks, or the idle window.

## Live Groq timing

Thirty sequential GPT-OSS 120B requests used the fixed ten-case evaluation set repeated three times with 2.1-second spacing. The metrics file contained IDs, decisions, timing, token counts, and redacted errors only—no prompt or completion text.

| Metric | Result |
|---|---:|
| Successful responses | 28/30 |
| P50 | 558 ms |
| P95 | 1,633 ms |
| Maximum | 3,967 ms |
| Expected decision matches | 26/30 |
| Paragraph-format passes | 28/30 |
| Prompt tokens | 9,406 |
| Completion tokens | 3,541 |

Both failures were Groq `json_validate_failed` responses for the Vietnamese case. The P50 and P95 targets were met on this tested network, but reliability and the worst sample remain known limitations. These are engineering observations, not latency guarantees.

## Gates

- Go idle RSS target `<100 MiB`: pass on this host.
- Go measured peak target `<200 MiB`: pass on this host.
- Local P95 target `<50 ms`: pass with the mock provider.
- Idle CPU target `<1%`: pass in the sampled service window.
- Absolute `<2 GB`: pass for the measured Go process; aggregate Chrome-extension measurement still requires the user's Chrome Task Manager test.
- Final 8 GB Mac reproduction: pending.

