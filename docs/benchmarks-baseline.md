# Phase 0 host baseline

Captured 2026-11-12 before any Promptizer process was running.

| Item | Observation |
|---|---|
| Host | Mac mini `Mac14,3`, Apple M2, 8 cores |
| Installed memory | 16 GB (does not match the roadmap's target 8 GB host) |
| OS | macOS 27.2.1 (build 26B131), Darwin arm64 |
| Go | go1.26.3 darwin/arm64 |
| Chrome | 157.0.8103.52 |
| Promptizer processes | none; application code is not implemented in Phase 0 |
| 60-second process-table observation | 12 samples at 5-second spacing; aggregate CPU average 100.85% (50.90–181.60%); aggregate RSS average 11,986.2 MiB (11,900.3–12,156.0 MiB) |

The process-table figures come from `ps -A -o %cpu=,rss=` over 55 elapsed seconds (12 observations spanning approximately 60 seconds). They are contextual only: other applications were present, aggregate RSS double-counts shared pages, and aggregate process `%CPU` is not equivalent to Promptizer CPU. Phase 2 and Phase 5 must measure the Promptizer PID separately and compare representative before/after windows. `vm_stat` was also captured during the audit, but it is not converted into an application footprint.

## Outstanding gate evidence

- Reproduce the baseline and final resource suite on an 8 GB Mac mini.
- Collect a 60-second idle CPU window for the Promptizer service after it exists.
- Measure Promptizer RSS/cold start only after the Phase 1/2 binaries exist.

