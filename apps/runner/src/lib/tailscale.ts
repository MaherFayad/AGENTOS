/**
 * Tailnet reachability, **observed** rather than assumed (§3.6).
 *
 * `GET /api/status` used to answer:
 *
 *     tailscale: process.env.TAILSCALE_IP || process.env.TS_HOSTNAME ? 'online' : 'unknown'
 *
 * which reported `online` on a host with **no Tailscale installed at all** — no binary, no
 * service, no address in `100.64.0.0/10`, and `TS_AUTHKEY` empty. The shell rendered a
 * filled dot and the word ONLINE. It was reading an environment variable and calling the
 * result a connection.
 *
 * That is the same defect as a 0/20 brain reported at 45%, `runs: 0` during a database
 * outage, and a trace link to a project that was never created: **a configured value
 * reported as an observed one.** A setting is a statement of intent by whoever wrote the
 * `.env`; a connection is a fact about the world. They are not interchangeable, and the
 * failure mode is always the same — the wrong answer is well-formed, confident, and
 * indistinguishable from the right one.
 *
 * So this observes exactly one thing it can actually see: **does this process have an
 * interface on the tailnet?** Tailscale assigns every node a `100.64.0.0/10` (CGNAT) IPv4
 * and an `fd7a:115c:a1e0::/48` IPv6, so the presence of either on a local interface is a
 * fact, not a guess.
 *
 * ### Why `unknown` is the right answer in compose today, and not a regression
 *
 * The runner runs on the compose bridge network. Under the topology `.env.example`
 * documents (Tailscale installed on the *host*, Caddy publishing on a host interface) the
 * container has no tailnet address of its own and **genuinely cannot observe** whether the
 * tailnet is up. `unknown` says exactly that. It is not a claim that the tailnet is down.
 *
 * Under the alternative topology (`network_mode: service:tailscale` on caddy — the ADR
 * `infra-compose-engineer` raised and deliberately did not write) the container *would*
 * hold a `100.x` address and this would answer `online` on evidence. So the pill stops
 * being decoration and becomes a real read on which topology is deployed.
 */
import { networkInterfaces } from 'node:os';

/** `100.64.0.0/10` — CGNAT, which is Tailscale's IPv4 range. */
export function isTailnetIPv4(address: string): boolean {
  const parts = address.split('.');
  if (parts.length !== 4) return false;
  const [a, b] = parts.map((p) => Number(p));
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  return a === 100 && b >= 64 && b <= 127;
}

/** `fd7a:115c:a1e0::/48` — Tailscale's ULA prefix. */
export function isTailnetIPv6(address: string): boolean {
  return address.toLowerCase().replace(/%.*$/, '').startsWith('fd7a:115c:a1e0');
}

export interface TailnetReading {
  /** `online` **only** when an interface on this process carries a tailnet address. */
  state: 'online' | 'unknown';
  /** The observed tailnet address, or `null`. Reported because it is checkable. */
  address: string | null;
  /** Written for a human on a phone. Always present, never a stack trace. */
  hint: string;
}

/** Injectable for tests; production reads the real interfaces. */
export type InterfaceReader = () => ReturnType<typeof networkInterfaces>;

export function readTailnet(read: InterfaceReader = networkInterfaces): TailnetReading {
  let address: string | null = null;

  try {
    for (const entries of Object.values(read())) {
      for (const entry of entries ?? []) {
        if (entry.internal) continue;
        const value = String(entry.address ?? '');
        if (isTailnetIPv4(value) || isTailnetIPv6(value)) {
          address = value;
          break;
        }
      }
      if (address) break;
    }
  } catch {
    address = null;
  }

  if (address) {
    return {
      state: 'online',
      address,
      hint: `This runner is on the tailnet as ${address}.`,
    };
  }

  // The env vars are reported as *intent*, never as evidence. Saying "configured but not
  // observed" is the whole distinction this module exists to draw.
  const configured = Boolean(process.env.TAILSCALE_IP || process.env.TS_HOSTNAME);

  return {
    state: 'unknown',
    address: null,
    hint: configured
      ? 'A tailnet address is configured in .env, but this process cannot see one on any of ' +
        'its own interfaces — which is the normal answer from inside a container when ' +
        'Tailscale runs on the host. It is not a claim that the tailnet is down; the runner ' +
        'simply cannot tell from here.'
      : 'This process has no tailnet interface and none is configured. If you expected to ' +
        'reach this from a phone, Tailscale is not up yet.',
  };
}
