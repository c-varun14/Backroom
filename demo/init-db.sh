#!/bin/sh
set -eu
export PGPASSWORD="$DB_OWNER_PASSWORD"
attempt=0
until psql -h postgres -U "$DB_OWNER_USER" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1; do
  attempt=$((attempt+1))
  if [ "$attempt" -ge 60 ]; then echo 'Disposable database TCP readiness timed out; details withheld.' >&2; exit 1; fi
  sleep 1
done
if ! psql -h postgres -U "$DB_OWNER_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='mattermost'" | grep -q 1; then
  psql -h postgres -U "$DB_OWNER_USER" -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE mattermost;' >/dev/null
fi
# Generated values are hexadecimal and never printed. No inherited credentials.
if ! psql -h postgres -U "$DB_OWNER_USER" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  psql -h postgres -U "$DB_OWNER_USER" -d postgres -v ON_ERROR_STOP=1 <<SQL >/dev/null
CREATE ROLE "$DB_USER" LOGIN PASSWORD '$DB_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
SQL
fi
