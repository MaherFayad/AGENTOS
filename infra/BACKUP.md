# Postgres backup — local volume, encrypted dumps

**Why this file exists:** Part VII.4 (PDPL) — *"keep Langfuse+Postgres volumes
local/GCC-hosted, no US SaaS traces, encrypt backups."* §3.5 repeats it. The volume half is
enforced in `infra/compose.yaml` (`langfuse_pgdata`, `driver: local`, named, never a cloud
volume driver). The backup half is this document.

Agents will run against client data. A plaintext `pg_dump` sitting in a folder is the same
disclosure risk as a US SaaS trace, just slower.

## What is in the volume

`agnetos_langfuse_pgdata` holds two databases on one server:

| DB | Contents | Sensitivity |
|---|---|---|
| `langfuse` | traces, prompts, completions, cost, latency (§3.5) | **high** — prompts and completions contain whatever the agent was given |
| `agnetos` | agent output rows the business widgets read (§3.5) | high |

## Taking an encrypted backup

Runs from the repo root. Works identically in PowerShell and bash — the encryption happens
inside a container, so nothing is installed on the host (portability rule, Part V).

```sh
docker compose -f infra/compose.yaml --env-file .env exec -T postgres \
  pg_dumpall -U "$POSTGRES_USER" \
| docker run --rm -i -e PASS="$BACKUP_PASSPHRASE" alpine:3.21 sh -c \
  'apk add --no-cache openssl >/dev/null && openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:PASS' \
> "backups/agnetos-$(date +%Y%m%d-%H%M).sql.enc"
```

Restore:

```sh
docker run --rm -i -e PASS="$BACKUP_PASSPHRASE" alpine:3.21 sh -c \
  'apk add --no-cache openssl >/dev/null && openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:PASS' \
  < backups/agnetos-YYYYMMDD-HHMM.sql.enc \
| docker compose -f infra/compose.yaml --env-file .env exec -T postgres psql -U "$POSTGRES_USER" postgres
```

`backups/` ignores its own contents via `backups/.gitignore` (`*` with a `!.gitignore`
exception), so a dump can never be committed by accident — not even an encrypted one.
`BACKUP_PASSPHRASE` is documented in `.env.example` and lives nowhere else — losing it
loses the backups, which is the intended property.

## Status: declared, not automated

This is a documented manual procedure, not a scheduled job. It is tracked as
`REQ-INF-25` in `comms/specs/infrastructure.md` with `Implemented in: —`.

Automating it means adding a service to `infra/compose.yaml` that runs on a cron and needs
`openssl` in whatever image it uses. That is a real decision (which image, which retention,
where the ciphertext goes, who holds the passphrase) and it belongs to M7 alongside the
rest of the schedule work — not to a foundations milestone that would have to guess at all
four answers. Writing an automated backup that silently produces unencrypted or
unrestorable files would be worse than this file.

**Before any client data touches this stack, automate the above and test a restore.** An
untested backup is a belief, not a backup.
