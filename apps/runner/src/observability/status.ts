/**
 * Node status derivation (§3.4 audit engine, §2.0/§2.2 LIVE counter, Part VII.3).
 *
 * The single rule this file exists to enforce:
 *
 *   An agent is `live` because it ran successfully. Not because a YAML file says so.
 *
 * Their map advertises 137 agents. Ours advertises real runs. That only holds if
 * `status` is a function of evidence, so this module takes run aggregates in and
 * returns a status out — there is no branch anywhere that reads frontmatter `status`
 * and believes it.
 *
 * Pure. No I/O. The SQL that produces `AgentEvidence` lives in db/queries.ts.
 */

export type AgentStatus = 'live' | 'draft' | 'failing';

export type AgentEvidence = {
  agent: string;
  department: string;
  /** Non-dry runs, all time. */
  totalRuns: number;
  /** Runs that finished `ok`, all time. The promotion gate. */
  successfulRuns: number;
  /** Runs inside the recency window (see THRESHOLDS). */
  recentRuns: number;
  /** Runs inside the recency window that finished `error`. */
  recentErrors: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
};

export type DerivedStatus = {
  agent: string;
  department: string;
  status: AgentStatus;
  /** 0..1 over the recency window; null when the window holds too few runs to mean anything. */
  errorRate: number | null;
  /** Plain-English reason, surfaced in the drawer and consumed by `agent-auditor`. */
  reason: string;
  evidence: AgentEvidence;
};

export const THRESHOLDS = {
  /** Runs considered "recent". A window of runs, not of wall-clock time: a weekly
   *  agent should not look healthy purely because it has been idle. */
  window: 20,
  /** Below this many recent runs we decline to compute an error rate at all. Two
   *  failures out of two is noise, and amber haloes that flap are worse than none. */
  minRunsForErrorRate: 3,
  /** At or above this recent error rate the agent is `failing` (amber halo). */
  failingErrorRate: 0.25,
} as const;

/**
 * Precedence: failing > live > draft.
 *
 * `failing` does not require prior success. An agent whose every run has errored is
 * broken and should wear the amber halo — but it is still not `live`, so it can never
 * inflate the LIVE counter on its way through.
 */
export function deriveStatus(evidence: AgentEvidence): DerivedStatus {
  const { agent, department, recentRuns, recentErrors, successfulRuns, totalRuns } = evidence;

  const errorRate = recentRuns >= THRESHOLDS.minRunsForErrorRate ? recentErrors / recentRuns : null;

  if (errorRate !== null && errorRate >= THRESHOLDS.failingErrorRate) {
    const pct = Math.round(errorRate * 100);
    return {
      agent,
      department,
      status: 'failing',
      errorRate,
      reason: `${recentErrors} of the last ${recentRuns} runs failed (${pct}%).`,
      evidence,
    };
  }

  if (successfulRuns > 0) {
    return {
      agent,
      department,
      status: 'live',
      errorRate,
      reason: `${successfulRuns} successful ${successfulRuns === 1 ? 'run' : 'runs'} on record.`,
      evidence,
    };
  }

  return {
    agent,
    department,
    status: 'draft',
    errorRate,
    reason:
      totalRuns === 0
        ? 'Never run.'
        : `${totalRuns} ${totalRuns === 1 ? 'run' : 'runs'}, none successful yet.`,
    evidence,
  };
}

/**
 * The LIVE counter (§2.0 `N OF 22 LIVE`, §2.2 per-department).
 *
 * We return only the numerator and the slugs behind it. The denominator — how many
 * agents exist — comes from the frontmatter projection in `GET /api/graph`, because
 * that is the only thing that knows. Splitting it this way makes it structurally
 * impossible for this module to report a total it made up.
 */
export type LiveCounts = {
  live: number;
  liveAgents: string[];
  byDepartment: Record<string, number>;
  failing: number;
  failingAgents: string[];
};

export function countLive(statuses: DerivedStatus[]): LiveCounts {
  const liveAgents: string[] = [];
  const failingAgents: string[] = [];
  const byDepartment: Record<string, number> = {};

  for (const s of statuses) {
    if (s.status === 'live') {
      liveAgents.push(s.agent);
      byDepartment[s.department] = (byDepartment[s.department] ?? 0) + 1;
    } else if (s.status === 'failing') {
      failingAgents.push(s.agent);
    }
  }

  return {
    live: liveAgents.length,
    liveAgents,
    byDepartment,
    failing: failingAgents.length,
    failingAgents,
  };
}
