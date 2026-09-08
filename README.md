# Application Lead Assignment — Zenalyst AI

## The problem, restated

One VM, one public IP. Docker Compose runs 7 app containers plus MongoDB and
PostgreSQL, both on the same box, both writing to that box's disk. Deploys are
a `git pull` + restart. It's cheap and it hasn't failed yet — but "hasn't
failed yet" is doing a lot of work in that sentence.

The brief asked for **reasoning and order of work**, not a diagram of the
ideal end state. So this README is organized as: what breaks first, why,
and what I'd do about it — in the order I'd actually do it.

## How I prioritized

I ranked risks by **(likelihood × blast radius) ÷ cost to fix**, not by
architectural elegance. A few things follow from that:

| # | Risk | Why it's ranked here |
|---|------|----------------------|
| 1 | No backups / shared disk for both DBs | Silent until it isn't — then it's total, irreversible data loss. Cheapest fix on this list. Fix before touching anything else. |
| 2 | DB ports potentially reachable from the public internet | A single public IP with no explicit network isolation is one misconfigured `EXPOSE`/firewall rule away from an open database. Fixed before scaling anything, because scaling a leaky system just gives attackers more surface. |
| 3 | Deploys are pull-and-restart | Every deploy is a mini-outage with no rollback. This matters *especially* while migrating, because you'll be deploying constantly during the migration itself. |
| 4 | Mongo + Postgres contend for one disk's I/O | A slow query in one database can now starve the other. This is a correctness/performance risk, distinct from #1 — backups protect the data, this protects the day-to-day. |
| 5 | Single VM = single point of failure | Only tackled once 1–4 are solid, because adding redundancy to an insecure, unbacked-up, badly-deployed system just replicates the problem. |
| 6 | No observability | You need this to *know* whether 1–5 are actually fixed, but building dashboards before the underlying risks are addressed is polishing the mirror on a sinking ship. |

## What's in this repo (Phase 0 — fixes deployable to the *same* VM, no AWS spend required yet)

- **`docker-compose.yml`** — isolates the databases on an internal-only Docker
  network (`backend`, no published ports), adds resource limits so one
  container can't starve the others, adds health checks so Compose actually
  knows when something is unhealthy, and fronts everything with nginx as the
  single TLS-terminating entry point.
- **`nginx/nginx.conf`** — forces HTTPS, adds basic rate limiting, load-balances
  across app instances.
- **`scripts/backup.sh` + `scripts/Dockerfile`** — a sidecar container that
  runs nightly `mongodump`/`pg_dump` to a local volume with 7-day retention.
  The offsite-sync step is a deliberate stub (see below).
- **`app/`** — a minimal Express placeholder standing in for the 7 real
  services, with `/health` (liveness) and `/ready` (checks both DB
  connections) endpoints, so the whole stack is runnable end-to-end on a
  clean machine.

## Target state (Phase 1 — once Phase 0 is stable, migrate to AWS)

This is the direction, not something I built out in code, because the brief
asked for reasoning over a perfect-system diagram:

- **RDS (Postgres) + DocumentDB or Atlas (Mongo)** instead of self-hosted —
  automated backups, multi-AZ failover, patching handled for you. This
  directly retires risk #1 and #4.
- **Security groups scoping DB access to the app tier only**, no public DB
  endpoints at all — hardens risk #2 beyond what a Docker network boundary
  gives you.
- **ECS/Fargate behind an ALB** instead of docker-compose on one VM — rolling
  deploys with automatic rollback on failed health checks (risk #3), and
  horizontal scaling / no single point of failure (risk #5).
- **CloudWatch (or equivalent) for logs/metrics/alarms** — risk #6.

## Assumptions

- The 7 application containers are stateless (session/state lives in the DBs,
  not in-process) — if not, the load-balancing story in `nginx.conf` and the
  ECS target state both need sticky sessions or a shared session store, which
  I did not build.
- Traffic volume is modest enough that a single VM was viable at all — this
  informed the "fix in place first, migrate second" order rather than an
  immediate full rewrite.
- There's no compliance requirement (HIPAA/PCI/etc.) driving specific
  encryption-at-rest or audit-log requirements beyond general good practice.
- Downtime for the Phase 0 migration itself (a few minutes, during a
  maintenance window) is acceptable — Phase 1 is where zero-downtime deploys
  actually get solved.

## What I deliberately left out, and why

- **Offsite backup sync (S3) is a stub, not implemented.** Wiring it up
  needs real AWS credentials/IAM scoping that don't exist in a take-home
  context — the script is structured so it's a one-line swap once they do.
- **TLS certificates are not generated/committed.** `nginx/certs/` expects
  real certs (e.g., from Let's Encrypt/ACM); shipping self-signed certs in a
  submitted repo felt like it would obscure the actual point of the config.
- **Only 2 of the 7 app containers are represented** (`app1`, `app2`). The
  other 5 are structurally identical — duplicating them 7 times added
  repetition without adding to the reasoning being demonstrated. In a real
  PR I'd factor this into a Compose extension/YAML anchor rather than copy-paste.
- **No Terraform/CloudFormation for the Phase 1 AWS target state.** The brief
  asked for reasoning and order of work over a diagram of the perfect system,
  so I described the target state and the reasoning behind each piece rather
  than building infra-as-code for an environment I'd be provisioning blind.
- **Auth/authz within the app layer** — out of scope for an infrastructure
  question; the placeholder app has no login system.

## Running it

```bash
cp .env.example .env
docker-compose up --build
```

- App (via nginx): `https://localhost` (self-signed cert warning expected
  unless you supply real certs in `nginx/certs/`)
- Health check: `curl -k https://localhost/health`
- Readiness (checks both DBs): `curl -k https://localhost/ready`
- Backups land in the `mongo_backups`/`postgres_backups` volumes; inspect with
  `docker-compose exec backup ls /backups/mongo`
