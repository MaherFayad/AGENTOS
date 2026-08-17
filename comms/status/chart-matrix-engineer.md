# status — chart-matrix-engineer

**Updated:** 2026-08-17T17:57
**Milestone:** M15
**State:** idle

## Now
Done: `chart-matrix.md`'s four M15 coverage FAILs are closed — REQ-CHT-42 repointed at
`(views)/p/[project]/chart/…` after reading all four files, and the two behaviours M15
actually introduced are now asserted (REQ-CHT-43 project-preserving redirect, REQ-CHT-44
no `/p/` literal written by CHART) instead of being invisible. `validate:coverage` reports
zero `chart-matrix.md` FAILs and zero new warnings; 13 FAILs remain, all other owners'.

## Blocked on
nothing

## Last handoff
comms/handoffs/M15-chart-matrix-engineer-coverage-repoint.md

## Next
1. Price the §2.6.1 tab bar for an eighth department with `map-galaxy-engineer`, so
   `agent-library-curator` can file the ADR-001 amendment (BOARD, M15 scope note).
2. When `GET /api/agents` (list) lands, drop the disk projection in `fromDisk.ts`.
