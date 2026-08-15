/**
 * In-memory registry of runs, their streams, and the approval gates they are waiting on
 * (§3.2).
 *
 * Deliberately in-memory at M3. The durable record of a run is its Langfuse trace and its
 * saved artifact; this store is the live view — who is running, who is paused at a gate,
 * and what a reconnecting phone still needs replayed. Its scope is the process's life, and
 * `GET /api/runs` says so honestly rather than implying a history it does not have.
 */
import { randomUUID } from 'node:crypto';
import type { ArtifactKind, PendingApproval, RunInputValue, RunStatus, RunSummary } from '@agnetos/contracts';
import { ApiError } from './errors';
import { RunStream } from './sse';

export interface ApprovalGate {
  summary: string;
  requestedAt: string;
  decided: boolean;
  /** Resolved by `POST /api/approvals/:runId`. The run awaits this and nothing else. */
  settle: (decision: { decision: 'approve' | 'deny'; note?: string }) => void;
  promise: Promise<{ decision: 'approve' | 'deny'; note?: string }>;
}

export interface RunState {
  runId: string;
  agent: string;
  agentName: string;
  department: string;
  inputs: Record<string, RunInputValue>;
  status: RunStatus;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  costUsd: number | null;
  traceUrl: string | null;
  stream: RunStream;
  gate: ApprovalGate | null;
  denialNote: string | null;
  artifact: { path: string; absolutePath: string; kind: ArtifactKind; bytes: number } | null;
  /** Set when the run should stop — a denial, or a shutdown. */
  abort: AbortController;
}

const ACTIVE: ReadonlySet<RunStatus> = new Set<RunStatus>(['queued', 'running', 'awaiting-approval']);

export class RunStore {
  private readonly runs = new Map<string, RunState>();
  /** Most recent first. Bounded, because this is a live view, not a database. */
  private readonly order: string[] = [];
  private readonly limit: number;

  constructor(limit = 200) {
    this.limit = limit;
  }

  create(input: {
    agent: string;
    agentName: string;
    department: string;
    inputs: Record<string, RunInputValue>;
    traceUrl: string | null;
  }): RunState {
    const runId = randomUUID();
    const state: RunState = {
      runId,
      agent: input.agent,
      agentName: input.agentName,
      department: input.department,
      inputs: input.inputs,
      status: 'queued',
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMs: null,
      costUsd: null,
      traceUrl: input.traceUrl,
      stream: new RunStream(runId),
      gate: null,
      denialNote: null,
      artifact: null,
      abort: new AbortController(),
    };
    this.runs.set(runId, state);
    this.order.unshift(runId);
    this.evict();
    return state;
  }

  private evict(): void {
    while (this.order.length > this.limit) {
      const oldest = this.order.pop();
      if (oldest) this.runs.delete(oldest);
    }
  }

  get(runId: string): RunState | undefined {
    return this.runs.get(runId);
  }

  /** Throwing lookup, so routes do not each re-invent the same 404. */
  require(runId: string): RunState {
    const state = this.runs.get(runId);
    if (!state) {
      throw new ApiError('run_not_found', `No run with id ${runId}.`, {
        hint: 'The run may have finished more than five minutes ago — its live stream is gone, but its trace and artifact are not. Open it from LAST RUNS.',
        retryable: false,
      });
    }
    return state;
  }

  list(filter: { agent?: string; limit?: number } = {}): RunSummary[] {
    const limit = Math.min(Math.max(filter.limit ?? 5, 1), 100);
    const out: RunSummary[] = [];
    for (const runId of this.order) {
      const state = this.runs.get(runId);
      if (!state) continue;
      if (filter.agent && state.agent !== filter.agent) continue;
      out.push({
        runId: state.runId,
        agent: state.agent,
        status: state.status,
        startedAt: state.startedAt,
        durationMs: state.durationMs,
        costUsd: state.costUsd,
        traceUrl: state.traceUrl,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  /** Open an approval gate and return the promise the run should await. */
  openGate(state: RunState, summary: string): ApprovalGate {
    let settle!: ApprovalGate['settle'];
    const promise = new Promise<{ decision: 'approve' | 'deny'; note?: string }>((resolve) => {
      settle = resolve;
    });
    const gate: ApprovalGate = {
      summary,
      requestedAt: new Date().toISOString(),
      decided: false,
      settle,
      promise,
    };
    state.gate = gate;
    state.status = 'awaiting-approval';
    return gate;
  }

  decide(runId: string, decision: 'approve' | 'deny', note?: string): RunState {
    const state = this.require(runId);
    if (!state.gate) {
      throw new ApiError('run_not_pending_approval', `Run ${runId} is not waiting for approval.`, {
        hint: `That run is ${state.status}. Nothing to approve — open it to see where it got to.`,
        retryable: false,
      });
    }
    if (state.gate.decided) {
      throw new ApiError('approval_already_decided', `Run ${runId} has already been decided.`, {
        hint: 'Someone (possibly you, on another device) already answered this one.',
        retryable: false,
      });
    }
    state.gate.decided = true;
    state.gate.settle({ decision, ...(note ? { note } : {}) });
    return state;
  }

  pendingApprovals(): PendingApproval[] {
    const out: PendingApproval[] = [];
    for (const runId of this.order) {
      const state = this.runs.get(runId);
      if (!state?.gate || state.gate.decided || state.status !== 'awaiting-approval') continue;
      out.push({
        runId: state.runId,
        agent: state.agent,
        agentName: state.agentName,
        department: state.department,
        summary: state.gate.summary,
        requestedAt: state.gate.requestedAt,
        inputs: state.inputs,
      });
    }
    return out;
  }

  /** Agents with a gate open — the map pulses these amber. */
  agentsAwaitingApproval(): string[] {
    return [...new Set(this.pendingApprovals().map((a) => a.agent))];
  }

  counts(): { active: number; queued: number; pendingApprovals: number } {
    let active = 0;
    let queued = 0;
    for (const state of this.runs.values()) {
      if (state.status === 'running' || state.status === 'awaiting-approval') active += 1;
      if (state.status === 'queued') queued += 1;
    }
    return { active, queued, pendingApprovals: this.pendingApprovals().length };
  }

  /** Drop streams past their replay window. Called on a timer by the server. */
  sweep(now: number = Date.now()): number {
    let dropped = 0;
    for (const state of this.runs.values()) {
      if (state.stream.ended && state.stream.isExpired(now) && state.stream.listenerCount === 0) {
        dropped += 1;
      }
    }
    return dropped;
  }
}

/** Exported for tests that assert lifecycle transitions rather than wall-clock behaviour. */
export const ACTIVE_STATUSES = ACTIVE;
