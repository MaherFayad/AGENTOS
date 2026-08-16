/**
 * The headless Claude Agent SDK session (§3.2).
 *
 * The SDK is reached through a narrow, injectable interface for two reasons. It keeps the
 * run pipeline testable without a network or an API key — which is how the allowlist test
 * can prove a mid-run tool request is refused — and it keeps the SDK's message shapes from
 * leaking into the SSE contract, so a change in the SDK becomes a change in this file
 * rather than a change to what the drawer console renders.
 */
import type { ToolEventStatus } from '@agnetos/contracts';
import { ApiError } from './errors';

export type AgentSessionEvent =
  | { type: 'token'; text: string }
  | { type: 'tool'; name: string; input: unknown; status: ToolEventStatus; durationMs?: number; error?: string }
  | { type: 'result'; costUsd: number | null }
  | { type: 'error'; message: string; retryable: boolean };

export interface AgentSessionOptions {
  systemPrompt: string;
  prompt: string;
  /** The per-run scratch workspace. Destroyed after artifact extraction. */
  cwd: string;
  /** Exactly the resolved `wired_into` allowlist. Never a superset (§3.2). */
  allowedTools: string[];
  model: string;
  signal: AbortSignal;
  abortController: AbortController;
  /**
   * The runner's own gate. Returns false for anything outside the allowlist — see the
   * enforcement-point comment in `allowlist.ts` for why this exists alongside
   * `allowedTools`.
   *
   * **It takes the tool's `input`, not just its name.** For `workspace` the name alone was
   * never the boundary: `Write` is permitted, `Write("/repo/.env")` must not be. The cwd
   * only decides where a relative path resolves.
   */
  isToolAllowed: (toolName: string, input: unknown) => boolean;
}

export type AgentSessionFactory = (options: AgentSessionOptions) => AsyncIterable<AgentSessionEvent>;

/** Narrow structural reads of the SDK's message stream; nothing here trusts a shape. */
function textOf(block: unknown): string | null {
  if (typeof block !== 'object' || block === null) return null;
  const b = block as { type?: unknown; text?: unknown };
  return b.type === 'text' && typeof b.text === 'string' ? b.text : null;
}

function toolUseOf(block: unknown): { name: string; input: unknown } | null {
  if (typeof block !== 'object' || block === null) return null;
  const b = block as { type?: unknown; name?: unknown; input?: unknown };
  return b.type === 'tool_use' && typeof b.name === 'string' ? { name: b.name, input: b.input } : null;
}

/**
 * The real session. Layers 1 and 2 of the allowlist enforcement are configured here:
 *
 *   `allowedTools`   — the resolved list, so permitted calls run without a prompt.
 *   `permissionMode: 'dontAsk'` — tools outside that list are DENIED rather than
 *                      escalated to a human. A run fired by cron at 06:00 has no human to
 *                      escalate to, so "prompt" would mean "hang until timeout".
 *   `canUseTool`     — layer 3, our own gate (`allowlist.ts`), consulted for anything that
 *                      still reaches the permission flow.
 */
export const createSdkSession: AgentSessionFactory = async function* createSdkSession(options) {
  let query: (args: { prompt: string; options?: Record<string, unknown> }) => AsyncIterable<unknown>;
  try {
    ({ query } = (await import('@anthropic-ai/claude-agent-sdk')) as {
      query: typeof query;
    });
  } catch (err) {
    throw new ApiError('runner_not_configured', 'The runner cannot load the Claude Agent SDK.', {
      hint: 'The runner image is missing @anthropic-ai/claude-agent-sdk. Rebuild the runner container; nothing was charged.',
      cause: err,
    });
  }

  const stream = query({
    prompt: options.prompt,
    options: {
      cwd: options.cwd,
      model: options.model,
      systemPrompt: options.systemPrompt,
      allowedTools: options.allowedTools,
      permissionMode: 'dontAsk',
      abortController: options.abortController,
      canUseTool: async (toolName: string, input: unknown) => {
        if (!options.isToolAllowed(toolName, input)) {
          return {
            behavior: 'deny' as const,
            message:
              `"${toolName}" was refused: it is either outside this agent's wired_into list, ` +
              'or it asked for a path outside this run’s scratch workspace.',
          };
        }
        return { behavior: 'allow' as const, updatedInput: input };
      },
    },
  });

  const pending = new Map<string, number>();

  for await (const message of stream) {
    if (options.signal.aborted) return;
    if (typeof message !== 'object' || message === null) continue;
    const msg = message as { type?: unknown; content?: unknown; total_cost_usd?: unknown };

    if (msg.type === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        const text = textOf(block);
        if (text !== null && text !== '') {
          yield { type: 'token', text };
          continue;
        }
        const call = toolUseOf(block);
        if (call) {
          // Belt and braces: even if the SDK's own gating ever changes, a call outside
          // the agent's `wired_into` never reaches the stream as an executed tool.
          if (!options.isToolAllowed(call.name, call.input)) {
            yield {
              type: 'tool',
              name: call.name,
              input: call.input,
              status: 'error',
              error: 'refused: not in this agent\'s wired_into',
            };
            continue;
          }
          pending.set(call.name, Date.now());
          yield { type: 'tool', name: call.name, input: call.input, status: 'start' };
        }
      }
      continue;
    }

    if (msg.type === 'result') {
      for (const block of Array.isArray(msg.content) ? msg.content : []) {
        const b = block as { type?: unknown; is_error?: unknown; tool_use_id?: unknown };
        if (b.type !== 'tool_result') continue;
        const name = String(b.tool_use_id ?? 'tool');
        const startedAt = pending.get(name);
        yield {
          type: 'tool',
          name,
          input: null,
          status: b.is_error === true ? 'error' : 'ok',
          ...(startedAt ? { durationMs: Date.now() - startedAt } : {}),
        };
        pending.delete(name);
      }
      yield {
        type: 'result',
        costUsd: typeof msg.total_cost_usd === 'number' ? msg.total_cost_usd : null,
      };
      continue;
    }

    if (msg.type === 'error') {
      const text = (msg as { message?: unknown }).message;
      yield {
        type: 'error',
        message: typeof text === 'string' ? text : 'The agent session failed.',
        retryable: true,
      };
    }
  }
};
