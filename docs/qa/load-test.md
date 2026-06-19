# Load Test Evidence

Status: Pass.

Run date: 2026-06-17.

The bounded load test uses an in-memory MongoDB instance and the Express app directly. It is intended to catch obvious local regressions, not certify production capacity.

Run:

```bash
npm run test:load
```

Pass criteria:

- No failed requests.
- Average latency under the configured threshold.
- p95 latency under the configured threshold.

Latest result:

```json
{
  "iterations": 40,
  "requests": 200,
  "average_ms": 2,
  "p95_ms": 3,
  "max_ms": 9,
  "thresholds": {
    "average_ms": 250,
    "p95_ms": 750
  }
}
```
