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

Rather than 7 placeholder containers, this repo demonstrates the pattern with
**two real services with working CRUD**, each running **2 replicas** — enough
to prove routing and load balancing actually work, without 7x the repetition
for no added signal. The same pattern extends to the rest.

- **`products-service/`** — Express + PostgreSQL. `POST/GET/DELETE /products`.
  Two replicas (`products1`, `products2`).
- **`invoice-service/`** — Express + MongoDB. `POST/GET/DELETE /invoices`.
  Two replicas (`invoices1`, `invoices2`).
- **`docker-compose.yml`** — isolates both databases on an internal-only
  Docker network (`backend`, no published ports), adds per-container resource
  limits so no single container can starve the others, and adds health
  checks so Compose/nginx know when a replica is actually ready.
- **`nginx/nginx.conf`** — the single public entry point. Routes `/api/products`
  and `/api/invoices` to their respective upstream (this is **routing**, since
  they're different services), and load-balances (round-robin) across each
  service's 2 replicas (this is **load balancing**, since those are identical
  instances). Also serves the static UI.
- **`ui/index.html`** — plain HTML + vanilla JS (no build step, no framework —
  the assignment is an infrastructure test, not a frontend one). Lets you
  create/list/delete products and invoices live, and shows which replica
  (`servedBy`) handled each request, so load balancing is visibly provable in
  the interview, not just claimed.
- **`scripts/backup.sh` + `scripts/Dockerfile`** — a sidecar container that
  runs nightly `mongodump`/`pg_dump` to a local volume with 7-day retention.
  The offsite-sync step is a deliberate stub (see below).
- **`products-service/test.js`, `invoice-service/test.js`** — basic API tests
  (create, get, list, validation, delete, 404-after-delete) for each service.
  Not exhaustive — enough to prove the pattern and give concrete material to
  defend line-by-line, per the assignment's requirement.
- **`.github/workflows/ci-cd.yml`** — build → test → deploy → rollback
  pipeline. This is the actual fix for risk #3 (pull-and-restart deploys):
  a deploy only reaches the VM if the tests above pass, and a failed
  post-deploy health check triggers an automatic rollback job. The
  deploy/rollback steps are stubs (no real target VM in a take-home context)
  but the gate structure — nothing ships without passing tests, nothing
  stays deployed without passing its health check — is real and is the part
  that matters.

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

## Cost and trade-offs (Phase 1 / AWS migration)

Every Phase 1 item has a cost, and part of leading this migration is being
upfront about them rather than presenting "move to AWS" as free:

- **RDS + DocumentDB/Atlas vs. self-hosted**: meaningfully more expensive
  per month than two DB processes on one VM — you're paying for automated
  backups, multi-AZ failover, and patching, not just compute. Worth it once
  the cost of a single data-loss incident (which is what Phase 0's backups
  are a stopgap against) exceeds the price delta. I'd size this against
  actual traffic/revenue numbers before committing, not assume it by default.
- **ECS/Fargate vs. one VM**: more moving parts to operate (task definitions,
  service discovery, ALB config) — a real cost in team ramp-up time, not
  just dollars. This is where an Application Lead's job is to decide if the
  team is ready to own that complexity, or if it's staged in over a quarter.
- **Migration risk itself**: cutting over a live database is the highest-risk
  step in this whole plan — more risk than any of the Phase 0 changes,
  which are all reversible with a `docker-compose down`. This is why it's
  ordered last and staged (see rollout plan below), not done in one shot.

## Rollout plan

1. **Phase 0 ships first, on the existing VM**, during a short maintenance
   window (a few minutes of downtime for the network/compose changes). This
   is low-risk and immediately reduces the two biggest risks (data loss,
   public DB exposure) without touching AWS at all.
2. **Communicate the maintenance window** to whoever depends on uptime,
   with rollback being "redeploy the previous compose file" — cheap, since
   nothing external has changed yet.
3. **Stage the AWS migration database-first**, starting with whichever of
   Mongo/Postgres has lower write volume, to prove the migration pattern
   before touching the busier one. Use a dual-write or read-replica cutover
   (write to both old and new during a transition window, verify parity,
   then cut reads over) rather than a single hard cutover — this is the
   step where downtime and data-loss risk are both highest, so it gets the
   most caution, not the least.
4. **App tier moves to ECS after the databases are stable on AWS**, not
   before — moving compute first while data still lives on the VM adds
   network hops and a second thing to debug simultaneously.
5. **Keep the old VM running, untouched, until the new stack has run in
   production for a full billing/traffic cycle** — cheap insurance against
   an issue that only shows up under real load.

## What I deliberately left out, and why

- **Offsite backup sync (S3) is a stub, not implemented.** Wiring it up
  needs real AWS credentials/IAM scoping that don't exist in a take-home
  context — the script is structured so it's a one-line swap once they do.
- **TLS certificates are not generated/committed.** `nginx/certs/` expects
  real certs (e.g., from Let's Encrypt/ACM); shipping self-signed certs in a
  submitted repo felt like it would obscure the actual point of the config.
- **Only 2 of the original 7 app containers are represented as full services**
  (products, invoices), each with 2 replicas. The remaining 5 would follow
  the identical pattern — duplicating a 3rd, 4th, 5th service adds repetition
  without adding new reasoning. In a real PR I'd factor the repeated
  replica blocks into a Compose extension/YAML anchor rather than copy-paste.
- **TLS is not implemented in this demo build** (nginx serves plain HTTP on
  `:8080`). The original Phase 0 draft included TLS termination; I dropped it
  here so the whole stack — including the UI — can be `docker-compose up`'d
  and clicked through on a clean machine with zero certificate setup. The
  nginx config in Phase 1 would add `ssl_certificate` directives exactly as
  before; it's a config addition, not an architecture change.
- **No Terraform/CloudFormation for the Phase 1 AWS target state.** The brief
  asked for reasoning and order of work over a diagram of the perfect system,
  so I described the target state and the reasoning behind each piece rather
  than building infra-as-code for an environment I'd be provisioning blind.
- **Auth/authz within the app layer** — out of scope for an infrastructure
  question; the demo services have no login system.
- **The deploy/rollback steps in `ci-cd.yml` are stubs**, not wired to a real
  VM — there's no actual target host in a take-home context, and faking SSH
  credentials against nothing felt like it would obscure the actual point
  (the gate structure) rather than demonstrate it. The build→test gate and
  the rollback trigger condition are both real and would need only host/SSH
  secrets to go live.

## Running it

```bash
cp .env.example .env
docker-compose up --build
```

- **UI**: `http://localhost:8080` — create/list/delete products and invoices,
  watch `servedBy` alternate between replicas as you refresh
- **Products API directly**: `curl http://localhost:8080/api/products`
- **Invoices API directly**: `curl http://localhost:8080/api/invoices`
- **Health checks**: `curl http://localhost:8080/health`
- Backups land in the `mongo_backups`/`postgres_backups` volumes; inspect with
  `docker-compose exec backup ls /backups/mongo`

### Proving load balancing live in the interview

1. Open the UI, add a product.
2. Refresh the products list a few times — watch the `servedBy` tag
   alternate between `products1` and `products2` (nginx round-robin).
3. Optionally, `docker-compose stop products1` mid-demo and show requests
   keep succeeding — nginx stops routing to the dead replica once its
   healthcheck fails.
