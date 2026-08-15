#!/usr/bin/env node
/**
 * check-bind.mjs — prove no container is published on a public interface.
 *
 * §3.6: "the app has no auth of its own in v1 because it is unreachable off your tailnet".
 * That sentence is only true while every published port is bound to the tailnet address
 * (100.x.y.z) or to loopback. Binding 0.0.0.0 is the single mistake that turns "no auth by
 * design" into "no auth".
 *
 * This asks DOCKER what it actually bound, rather than reading the compose file — a config
 * can be right while a leftover container from an older config is still listening.
 *
 * Usage:  node infra/check-bind.mjs            # checks running containers
 *         node infra/check-bind.mjs --config   # also lints the compose file's port specs
 *
 * Exit 1 on any violation. Runs identically under PowerShell and bash.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPOSE = join(HERE, 'compose.yaml');

const errors = [];
const notes = [];

/** Loopback and the Tailscale CGNAT range 100.64.0.0/10 are the only acceptable binds. */
function classify(host) {
  if (host === '' || host === '0.0.0.0' || host === '::' || host === '*') return 'PUBLIC';
  if (host === '127.0.0.1' || host === '::1' || host === 'localhost') return 'loopback';
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 100 && b >= 64 && b <= 127) return 'tailnet';
    if (a === 127) return 'loopback';
  }
  return 'PUBLIC';
}

function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// --- 1. what is actually listening ------------------------------------------------
// `docker ps`, not `docker compose ps`. Compose only reports containers carrying THIS
// project's labels, and the failure this check exists to catch is precisely the one that
// escapes those labels: a container left over from an older compose file, a different
// project name, or a `docker run` someone typed by hand (which Part V forbids, and which
// is therefore exactly the thing nobody is looking for). If something on this host is
// listening on a public interface, the tailnet-only claim is false no matter who started
// it — so the probe asks about every running container.
let checkedContainers = 0;
let probedHost = false;
try {
  const out = docker(['ps', '--format', '{{.Names}}\t{{.Ports}}']);
  probedHost = true;

  for (const line of out.split(/\r?\n/).filter(Boolean)) {
    const [name, ports = ''] = line.split('\t');
    // Ports render as `0.0.0.0:443->443/tcp, 100.90.1.2:80->80/tcp, 3000/tcp`.
    // A bare `3000/tcp` is an EXPOSE with no published port — not reachable from the
    // host at all, so it is not a finding and must not be counted as a checked bind.
    for (const pub of ports.split(/,\s*/).filter(Boolean)) {
      const m = /^(\[?[0-9a-fA-F.:*]+\]?):(\d+)->(\d+)\/(tcp|udp)$/.exec(pub.trim());
      if (!m) continue;
      checkedContainers++;
      const [, rawHost, hostPort, , proto] = m;
      const host = rawHost.replace(/^\[|\]$/g, '');
      const verdict = classify(host);
      if (verdict === 'PUBLIC') {
        errors.push(
          `container "${name}": published on ${host}:${hostPort}/${proto} — that is every ` +
            `interface. No auth exists in v1 by design (§3.6); this makes it reachable by ` +
            `anyone who can route to this host.`,
        );
      } else {
        notes.push(`  ok   running  ${name.padEnd(24)} ${host}:${hostPort}/${proto}  (${verdict})`);
      }
    }
  }
  if (checkedContainers === 0) notes.push('  ok   running  no container publishes a host port.');
} catch (err) {
  // The daemon being down is not a pass. Say so loudly, because the rest of this script
  // only lints intent — it cannot see a stale container that is listening right now.
  notes.push(
    `  SKIP running-container probe — docker daemon not reachable ` +
      `(${String(err.message).split('\n')[0].slice(0, 120)}).`,
  );
  notes.push('        Start Docker Desktop and re-run before trusting this result.');
}

// --- 2. what the compose file WILL bind on the next `up` --------------------------
// Read the RESOLVED config, not the raw YAML: every bind address in this file is a
// ${VAR:-default}, and a checker that only understands literals would pass a file whose
// variables expand to 0.0.0.0. `--profile *` so no service can hide in an unused profile.
let linted = 0;
try {
  const json = docker([
    'compose',
    '-f',
    COMPOSE,
    '--profile',
    '*',
    'config',
    '--format',
    'json',
  ]);
  const config = JSON.parse(json);

  for (const [service, def] of Object.entries(config.services ?? {})) {
    for (const p of def.ports ?? []) {
      linted++;
      // Compose omits host_ip entirely when none was given — which means 0.0.0.0.
      const host = p.host_ip ?? '';
      const label = `${p.published}:${p.target}/${p.protocol ?? 'tcp'}`;

      if (host === '') {
        errors.push(
          `compose.yaml ${service}: port "${label}" has NO bind address, so Docker binds ` +
            `0.0.0.0 — every interface. Prefix it with \${TAILSCALE_IP:-127.0.0.1}: (§3.6).`,
        );
      } else if (classify(host) === 'PUBLIC') {
        errors.push(
          `compose.yaml ${service}: port "${label}" resolves to bind "${host}" — public. ` +
            `The stack has no auth in v1 by design; use \${TAILSCALE_IP:-127.0.0.1} (§3.6).`,
        );
      } else {
        notes.push(
          `  ok   compose ${service.padEnd(10)} ${host}:${label}  (${classify(host)})`,
        );
      }
    }
  }
} catch (err) {
  // Fallback: docker unavailable. Catch the one failure a plain read can still catch —
  // a ports entry with no bind address at all — and say plainly that this is the weaker
  // check, so a green run here is never mistaken for the real one.
  warnCannotResolve(String(err.message).split('\n')[0]);
}

function warnCannotResolve(reason) {
  notes.push(`  WEAK  could not resolve compose config (${reason}) — text lint only.`);
  const compose = readFileSync(COMPOSE, 'utf8');
  let service = 'unknown';
  let inPorts = false;
  for (const raw of compose.split(/\r?\n/)) {
    const svc = /^ {2}([a-z][a-z0-9_-]*):\s*$/.exec(raw);
    if (svc) {
      service = svc[1];
      inPorts = false;
    }
    if (/^\s{4}ports:\s*$/.test(raw)) {
      inPorts = true;
      continue;
    }
    if (inPorts && /^\s{4}\w/.test(raw)) inPorts = false;
    if (!inPorts) continue;

    const entry = /^\s*-\s*['"]?([^'"]+?)['"]?\s*$/.exec(raw);
    if (!entry) continue;
    // "3000:3000" — two fields, no host. "x:3000:3000" — three fields, host present.
    const fields = entry[1].split(':');
    if (fields.length < 3) {
      errors.push(
        `compose.yaml ${service}: port "${entry[1]}" has NO bind address, so Docker binds ` +
          `0.0.0.0 (§3.6).`,
      );
    } else if (/0\.0\.0\.0|^\*$|^::$/.test(fields[0])) {
      errors.push(`compose.yaml ${service}: port "${entry[1]}" binds a public interface (§3.6).`);
    }
  }
}

console.log('\nBind-address check (§3.6 — no public ports)\n');
for (const n of notes) console.log(n);
if (errors.length) {
  console.log('');
  for (const e of errors) console.log(`  FAIL ${e}`);
  console.log(`\n${errors.length} violation(s).\n`);
  process.exit(1);
}
console.log(
  `\n${linted} declared + ${checkedContainers} running port(s) bound to loopback or the ` +
    `tailnet. No public listeners.` +
    (probedHost ? '\n' : '\n(Declared ports only — no running container was inspected.)\n'),
);
