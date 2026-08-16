#!/bin/sh
# Create the databases that initdb does NOT create for us.
#
# The postgres image creates exactly one database: $POSTGRES_DB (= langfuse). But this
# server holds three, on purpose (§3.5, Part V):
#
#   langfuse   Langfuse's own schema. Owned by Langfuse; we never write to it.
#   agnetos    The run ledger (ops.*) + the business rows agents write (app.*). This is
#              what LAST RUNS and the cost ticker read. Migrations in
#              apps/runner/src/db/migrations/ apply here.
#   happy      The session relay's store (§3.1) — ciphertext only, the relay cannot
#              decrypt it.
#
# Separate databases, not separate schemas in one, so a `pg_dump` of the ledger does not
# drag Langfuse's tables along and so Langfuse migrations can never touch our ledger.
#
# THIS RUNS ONCE, on first initialisation of an empty `langfuse_pgdata` volume. It is
# still written idempotently (`WHERE NOT EXISTS`) because a half-failed init that gets
# retried should not abort on "database already exists".
#
# Portability (Part V): POSIX sh, LF line endings, no host tools. Runs identically under
# Docker Desktop on Windows.
set -e

create_db() {
  db="$1"
  [ -z "$db" ] && return 0
  [ "$db" = "$POSTGRES_DB" ] && return 0
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	SELECT 'CREATE DATABASE "$db" OWNER "$POSTGRES_USER"'
	 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
  echo "init: database '$db' ready"
}

create_db "${APP_DB:-agnetos}"
create_db "${HAPPY_DB:-happy}"
