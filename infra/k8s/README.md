# Kubernetes deployment

Kustomize-based deployment for BOSSNYUMBA. The base manifests describe a
production-grade topology; each overlay tunes replica counts, resource
envelopes, image tags, and host names per environment.

## Layout

```
infra/k8s/
├── namespaces/                  Namespace manifests (with Pod Security Standards)
├── external-secrets/            ClusterSecretStore + IRSA SA + ghcr-pull ESO fan-out
├── base/                        All-environment shared resources (core 18 services)
├── overlays/
│   ├── staging/                 Smaller envelope, staging hostnames
│   └── prod/                    Full envelope, anti-affinity required, prod hostnames
├── brain-evolution-worker/      Per-service tree (added 2026-05-24)
├── document-render/             Per-service tree
├── onboarding-orchestrator/     Per-service tree
├── outcomes-metering/           Per-service tree
├── parcel-service/              Per-service tree
├── scientific-discovery-sidecar/ Per-service tree
└── voice-agent/                 Per-service tree
```

Per-service trees follow:
```
<service>/
├── base/                        deployment / service / hpa / pdb /
│                                networkpolicy / servicemonitor / externalsecret
└── overlays/
    ├── staging/                 namespace + image tag + small envelope
    └── prod/                    namespace + image tag + full envelope + anti-affinity
```

## Image registry convention

Every BOSSNYUMBA container image is published to GitHub Container Registry
under a single owner with a flat naming scheme:

```
ghcr.io/georgemwiki/bossnyumba-<service>:<tag>
```

- `<service>`   matches the directory name under `services/` or `apps/`
                (e.g. `api-gateway`, `voice-agent`, `brain-evolution-worker`)
- `<tag>`       is the 7-char short SHA in CD, `staging`/`latest` in dev

This is what `.github/workflows/cd.yml` actually publishes (`REGISTRY=ghcr.io`,
`REGISTRY_OWNER=georgemwiki`); every Deployment / CronJob in this directory
references that same path. There is no per-service registry path — keep new
services on this convention so the CD workflow's matrix build keeps working.

The packages are currently private; see `external-secrets/README.md` for the
`ghcr-pull` image-pull secret wiring.

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
backend. This is provisioned by `infra/k8s/external-secrets/` (apply that
overlay once per cluster after installing the ESO Helm chart) — see
`external-secrets/README.md` for the IAM trust + permission policies, the
secret-tree layout, and the `ghcr-pull` Docker config flow.

The schema mirrors `.env.production.example` 1:1, organised as
`bossnyumba/<env>/<service>` plus shared paths like `bossnyumba/<env>/postgres`,
`bossnyumba/<env>/redis`, and `bossnyumba/shared/ghcr-pull-token`.

## Quick start

```bash
# Validate
kubectl apply --dry-run=client -k infra/k8s/external-secrets
kubectl apply --dry-run=client -k infra/k8s/overlays/staging
kubectl apply --dry-run=client -k infra/k8s/overlays/prod
# Per-service trees (each one of the 7 new services)
for svc in brain-evolution-worker document-render onboarding-orchestrator \
           outcomes-metering parcel-service scientific-discovery-sidecar \
           voice-agent; do
  kubectl apply --dry-run=client -k "infra/k8s/$svc/overlays/staging"
  kubectl apply --dry-run=client -k "infra/k8s/$svc/overlays/prod"
done

# Apply (order matters — cluster-scope secrets first)
kubectl apply -k infra/k8s/external-secrets
kubectl apply -k infra/k8s/overlays/staging
kubectl apply -k infra/k8s/overlays/prod
for svc in brain-evolution-worker document-render onboarding-orchestrator \
           outcomes-metering parcel-service scientific-discovery-sidecar \
           voice-agent; do
  kubectl apply -k "infra/k8s/$svc/overlays/staging"
  kubectl apply -k "infra/k8s/$svc/overlays/prod"
done
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
