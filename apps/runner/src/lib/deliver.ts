/**
 * Post-run delivery per frontmatter `deliver:` (§3.2, Part IV).
 *
 * Delivery is best-effort and never changes the outcome of a run: an agent that produced
 * a good artifact and failed to post it to Slack has succeeded and has a delivery
 * problem, and reporting that as a failed run would send someone to debug the wrong thing.
 * Failures are returned so the console can say so.
 */
import type { RunnerConfig } from './config';
import type { SavedArtifact } from './artifacts';

export interface DeliveryOutcome {
  channel: 'slack' | 'email';
  target: string;
  delivered: boolean;
  reason?: string;
}

export async function deliver(
  config: RunnerConfig,
  spec: { slack?: string; email?: string },
  context: { agentName: string; runId: string; artifact: SavedArtifact | null },
): Promise<DeliveryOutcome[]> {
  const outcomes: DeliveryOutcome[] = [];

  if (spec.slack) {
    outcomes.push(await deliverSlack(config, spec.slack, context));
  }

  if (spec.email) {
    // Deliberately not built at M3: email needs an SMTP relay and a sender identity, and
    // neither exists in the compose stack yet (Part V names six services; none of them is
    // a mail server). Declaring it unsupported is honest; silently dropping it would make
    // `deliver: {email: …}` look like it worked.
    outcomes.push({
      channel: 'email',
      target: spec.email,
      delivered: false,
      reason: 'Email delivery is not wired yet — the artifact is saved and downloadable.',
    });
  }

  return outcomes;
}

async function deliverSlack(
  config: RunnerConfig,
  target: string,
  context: { agentName: string; runId: string; artifact: SavedArtifact | null },
): Promise<DeliveryOutcome> {
  if (!config.slackWebhookUrl) {
    return {
      channel: 'slack',
      target,
      delivered: false,
      reason: 'SLACK_WEBHOOK_URL is not set on the runner.',
    };
  }

  const lines = [
    `*${context.agentName}* finished a run.`,
    context.artifact ? `Artifact: \`${context.artifact.path}\` (${context.artifact.bytes} bytes)` : 'No artifact was produced.',
  ];

  try {
    const response = await fetch(config.slackWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: target, text: lines.join('\n') }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok
      ? { channel: 'slack', target, delivered: true }
      : { channel: 'slack', target, delivered: false, reason: `Slack returned ${response.status}` };
  } catch (err) {
    return {
      channel: 'slack',
      target,
      delivered: false,
      reason: err instanceof Error ? err.message : 'Slack request failed',
    };
  }
}
