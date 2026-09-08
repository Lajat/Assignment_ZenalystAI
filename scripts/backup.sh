#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "[$TIMESTAMP] Starting backup..."

# --- MongoDB dump ---
mongodump --uri="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongo:27017" \
  --out="/backups/mongo/dump_${TIMESTAMP}"

# --- PostgreSQL dump ---
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h postgres -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  > "/backups/postgres/dump_${TIMESTAMP}.sql"

# --- Prune backups older than 7 days (local retention; offsite copy keeps longer history) ---
find /backups/mongo -maxdepth 1 -type d -mtime +7 -exec rm -rf {} +
find /backups/postgres -type f -mtime +7 -delete

# --- Push to offsite storage ---
# Placeholder: replace with `aws s3 sync /backups s3://<bucket>/backups --delete=false`
# once AWS credentials/IAM role are provisioned. Left as a stub deliberately —
# see README "What I left out and why".
echo "[$TIMESTAMP] Backup complete. Offsite sync not yet wired up (see README)."
