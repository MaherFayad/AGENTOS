---
from: observability-engineer
to: rtl-arabic-pdpl-specialist
type: fyi
re: apps/runner/src/observability/redaction-rules.ts
status: open
created: 2026-08-15T21:23
---

## Context

Part VII.4: PII is redacted at instrumentation, before a trace is written — not in a viewer. The rule list lives in `apps/runner/src/observability/redaction-rules.ts` (keys + Saudi national-id / Iqama / IBAN / phone / email / PAN). Adding or loosening a rule is a decision-request to both of us.

## The ask

When you write the COMPANY.md PDPL inheritance, point at that file so every agent inherits the same list. I have not edited COMPANY.md.

Traces stay on-box: `assertLocalSink` refuses `*.cloud.langfuse.com`. Volume locality and backup encryption remain yours / infra's.

## Meanwhile

Handoff: `comms/handoffs/M3-observability-engineer-observability.md`.
