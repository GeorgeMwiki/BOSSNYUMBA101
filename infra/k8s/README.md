# Kubernetes deployment

Kustomize-based deployment for BOSSNYUMBA. The base manifests describe a
production-grade topology; each overlay tunes replica counts, resource
envelopes, image tags, and host names per environment.

## Layout

```
infra/k8s/
├── namespaces/            Namespace manifests (with Pod Security Standards)
├── base/                  All-environment shared resources
└── overlays/
    ├── staging/           Smaller envelope, staging hostnames
    └── prod/              Full envelope, anti-affinity required, prod hostnames
```

## Prerequisites

The cluster must have these operators installed:

| Operator                    | Purpose                                |
|-----------------------------|----------------------------------------|
| `ingress-nginx`             | L7 ingress (TLS + rate-limit)          |
| `cert-manager`              | Let's Encrypt cert rotation             |
| `external-secrets-operator` | Sync from AWS Secrets Manager / Azure / GCP |
| `metrics-server`            | HPA CPU/memory metrics                  |
| A CNI with NetworkPolicy    | Calico, Cilium, or Antrea               |

Plus a `ClusterSecretStore` named `bossnyumba-aws` pointing at the secrets
backend, populated with three secrets:

- `bossnyumba/prod/app` — app env (JWT_SECRET, ANTHROPIC_API_KEY, etc.)
- `bossnyumba/prod/postgres` — POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
- `bossnyumba/prod/redis` — REDIS_PASSWORD

The schema mirrors `.env.production.example` 1:1.

## Quick start

```bash
# Validate
kubectl apply --dry-run=client -k infra/k8s/overlays/staging
kubectl apply --dry-run=client -k infra/k8s/overlays/prod

# Apply
kubectl apply -k infra/k8s/overlays/staging
kubectl apply -k infra/k8s/overlays/prod
```

The CD workflow (`.github/workflows/cd.yml`) drives this with image-tag
pinning and approval gates.

## Security defaults

- **Pod Security Standards**: namespaces enforce `restricted`
- **Non-root**: every pod runs as `runAsNonRoot: true` with a fixed UID
- **Read-only root**: every container has `readOnlyRootFilesystem: true`
  (writable scratch via emptyDir mounts)
- **Capabilities dropped**: `capabilities: { drop: ["ALL"] }` (nginx-based
  frontends add only `NET_BIND_SERVICE`)
- **Seccomp**: `seccompProfile: RuntimeDefault`
- **ServiceAccount**: every deployment has its own SA with
  `automountServiceAccountToken: false`
- **NetworkPolicy**: default-deny + targeted allow-lists (see
  `base/network-policies.yaml`)
- **Secrets**: never committed; pulled at sync time via
  `external-secrets-operator`

## Migrations strategy

Schema migrations run as a pre-deploy `Job` (not bundled here — see the
existing `k8s/templates/migration-job.yaml` Helm template for reference).
Order on rollout:

1. `kubectl apply -k infra/k8s/overlays/prod --prune=false`
2. Wait for the migration Job to succeed
3. CD then rolls api-gateway forward

## Self-hosted alternative

If you want a single-VM deployment instead of K8s, use
`docker-compose.production.yml` at the repo root. See
[docs/deployment/README.md](../../docs/deployment/README.md) for the
operator runbook.
