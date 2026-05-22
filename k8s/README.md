# BOSSNYUMBA on Kubernetes

Kubernetes + Helm scaffolding for the BOSSNYUMBA multi-tenant property
management SaaS. **This is scaffolding, not production-ready** — every
TODO marker in this tree gates a real value (image tag, secret, host,
issuer, etc.) that must be plumbed before `helm install` will succeed
against a real cluster.

> Mirrors the structure used in the LITFIN project's `k8s/` tree, but
> adapted to BOSSNYUMBA's app/service topology (4 frontends + 4
> backend services + Postgres + Redis).

## Two deployment paths

BOSSNYUMBA supports two deployment shapes. Pick one per environment.

### Default — PaaS (Vercel + Fly.io + Supabase + Upstash)

For most tenants and for our own SaaS instance we run on managed
PaaS. This is the recommended path and what `docker-compose.*.yml`
plus the GitHub Actions workflows in `.github/workflows/` already
deliver. The k8s manifests here are **not used** in that path —
they're parked here for the sovereign-cloud path below.

### Sovereign cloud — Kubernetes (this directory)

When a customer (typically a large landlord co-op, government agency,
or regulated estate) requires data-sovereign hosting on their own
cloud (GCP, AWS, on-prem k3s, Vultr, Hetzner, Equinix Metal), the
same workloads ship as the Helm chart in `helm/bossnyumba/`. Use this
when:

- Regulator forbids leaving the cloud account / jurisdiction.
- Tenant requires VPC peering with their own systems.
- Tenant requires their own KMS / HSM for field encryption.
- We need >100 tenants of >1k units each on dedicated infra.

## What ships here

```
k8s/
  README.md                          (this file)
  helm/bossnyumba/                   Helm chart wrapping all manifests
    Chart.yaml
    values.yaml                      Per-env override starting point
    templates/
      _helpers.tpl                   Common labels + image ref + SCs
      <app>.deployment.yaml          x4 frontend apps
      <app>.service.yaml             x4 ClusterIP services
      <app>.hpa.yaml                 x4 HPAs (CPU + memory triggers)
      <app>.networkpolicy.yaml       x4 explicit allow rules
      <service>.deployment.yaml      x4 backend services
      <service>.service.yaml         x4 ClusterIP services
      <service>.hpa.yaml             x4 HPAs
      <service>.networkpolicy.yaml   x4 explicit allow rules
      postgres.statefulset.yaml      Postgres 16 with anti-affinity + PDB
      redis.deployment.yaml          Redis 7 (single replica; HA via Sentinel — see /k8s/ha)
      ingress.yaml                   Per-portal public hosts
      secrets-external.yaml          External Secrets Operator binding
      cert-manager-issuer.yaml       Let's Encrypt prod + staging
  keda/                              KEDA HTTP-add-on ScaledObjects per frontend
    scaledobject-customer-app.yaml
    scaledobject-estate-manager-app.yaml
    scaledobject-owner-portal.yaml
    scaledobject-admin-platform-portal.yaml
  networkpolicy/                     Default-deny + portal-specific rules
    default-deny.yaml
    allow-frontend-to-gateway.yaml
    allow-gateway-to-services.yaml
    allow-payments-ledger-strict.yaml
  runbooks/                          Operator-facing markdown runbooks
    deploy-to-staging.md
    rollback.md
    scale-to-100-tenants.md
  external-secrets/                  ESO SecretStore + ExternalSecret (raw)
  cert-manager/                      ClusterIssuer (raw)
  ha/                                Postgres HA + Redis Sentinel (pre-existing)
  templates/                         Generic k8s templates (pre-existing)
```

## Architecture (mapped to BOSSNYUMBA topology)

| Tier | Workload | Visibility | Min replicas | Notes |
|------|----------|------------|--------------|-------|
| Frontend | `customer-app` | PUBLIC (ingress) | 2 (HPA: 2-30) | Tenant-facing tenant portal |
| Frontend | `estate-manager-app` | PUBLIC (ingress) | 1 (KEDA: 0-20) | Manager portal — scale-to-zero on idle |
| Frontend | `owner-portal` | PUBLIC (ingress) | 1 (KEDA: 0-10) | Property-owner portal |
| Frontend | `admin-platform-portal` | PUBLIC (ingress) | 1 (KEDA: 0-5) | Platform admin — low traffic, scales to 0 |
| Service | `api-gateway` | INTERNAL only | 3 (HPA: 3-50) | The only route into business logic |
| Service | `payments-ledger` | INTERNAL + STRICT | 2 (HPA: 2-15) | PCI-adjacent — see `networkpolicy/allow-payments-ledger-strict.yaml` |
| Service | `reports` | INTERNAL only | 1 (HPA: 1-10) | Heavy queries; resource-bound |
| Service | `notifications` | INTERNAL only | 2 (HPA: 2-10) | Outbound mail/SMS/WhatsApp/M-Pesa |
| Data | `postgres` | INTERNAL only | 3 (StatefulSet) | Anti-affinity + PDB; full HA cluster lives in `k8s/ha/` |
| Data | `redis` | INTERNAL only | 1 (Deployment) | Single replica baseline; Sentinel cluster in `k8s/ha/` |

## Cold-cluster bootstrap (sovereign path)

1. **Provision a cluster** (K8s 1.31+). GKE / EKS / k3s / Vultr / Hetzner
   all work; sizing depends on tenant count — see
   `runbooks/scale-to-100-tenants.md`.

2. **Install platform components**:
   - ingress-nginx
   - cert-manager
   - external-secrets-operator
   - KEDA + HTTP add-on (optional — for scale-to-zero portals)
   - Linkerd 2.19 (optional — for mTLS + retries between services)

   _TODO: add a `scripts/bootstrap-cluster.sh` mirroring LITFIN's helper._

3. **Configure the secrets backend**. Pick one in `values.yaml`:
   - GCP Secret Manager (Workload Identity)
   - AWS Secrets Manager (IRSA)
   - HashiCorp Vault
   - Sealed Secrets (in-cluster — last resort)

   _TODO: seed the secret names listed in `templates/secrets-external.yaml`._

4. **Configure DNS**. Point all four portal hosts at the ingress LB:
   - `tenant.<customer-domain>` → customer-app
   - `manager.<customer-domain>` → estate-manager-app
   - `owner.<customer-domain>` → owner-portal
   - `admin.<customer-domain>` → admin-platform-portal

5. **Install the chart**:

   ```bash
   helm install bossnyumba ./k8s/helm/bossnyumba \
     --namespace bossnyumba \
     --create-namespace \
     -f values-prod.yaml
   ```

   _TODO: create `values-staging.yaml` + `values-prod.yaml`._

## Hard rules (carried over from BOSSNYUMBA CLAUDE.md)

- All workloads run as nonroot UID 65532 with read-only root FS.
- All pods drop ALL Linux capabilities and use seccomp `RuntimeDefault`.
- Default-deny NetworkPolicy is in effect; new workloads need an
  explicit allow rule.
- `payments-ledger` is **PCI-adjacent**: separate NetworkPolicy that
  only allows ingress from `api-gateway` and egress only to Postgres,
  Redis, and pinned payment-provider IPs (Stripe + Daraja).
- Secrets never live in git. The External Secrets Operator materialises
  real values at runtime from the configured backend.
- `api-gateway` is the only service exposed to the frontend pods. The
  4 services (`payments-ledger`, `reports`, `notifications`,
  `domain-services` if added later) are reachable only through it.

## Status (scaffolding markers)

Every file in `helm/bossnyumba/templates/` contains TODO comments where:

- Image tags need to be wired to the CI build SHA.
- Hosts need to be replaced with the real tenant / SaaS domain.
- Secret names need to match what's seeded into the secrets backend.
- Resource requests/limits need a real load-test pass.
- Health-probe paths need to match what each app actually exposes
  (most expose `/api/health` but verify per app).

Search for `TODO(scaffold):` to find them all.
