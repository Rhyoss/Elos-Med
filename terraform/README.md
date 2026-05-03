# DermaOS / ELOS MED — Terraform (GCP)

Infraestrutura como código para os ambientes `staging` e `prod` em GCP
(`southamerica-east1`).

## Pré-requisitos (uma única vez)

Execute o passo-a-passo em [`bootstrap/README.md`](bootstrap/README.md)
**antes** de rodar `terraform apply`. Ele cria:

- Os dois projetos GCP (`elosmed-staging`, `elosmed-prod`)
- Faturamento vinculado
- APIs habilitadas
- Buckets de _state_ do Terraform (um por env)
- Service Account de execução do Terraform

## Estrutura

```
terraform/
├── bootstrap/          # Passo-a-passo manual (gcloud)
├── modules/            # Módulos reutilizáveis (sem state próprio)
│   ├── network/        # VPC, NAT, Serverless VPC Connector
│   ├── database/       # Cloud SQL Postgres 16 + pgvector + roles
│   ├── cache/          # Memorystore Redis 7
│   ├── storage/        # 4 buckets GCS + CMEK (KMS)
│   ├── secrets/        # Secret Manager (11 segredos)
│   ├── registry/       # Artifact Registry (Docker)
│   ├── service-accounts/
│   ├── workload-identity/  # GitHub Actions WIF
│   └── cloud-run/      # Serviços Cloud Run (api/web/worker/ai/search)
└── envs/
    ├── staging/        # Workspace staging
    └── prod/           # Workspace prod
```

## Convenções

- **Region:** `southamerica-east1` (São Paulo) — LGPD + latência.
- **State:** GCS, versionado, retention 30 dias, bucket separado por env.
- **Naming:** `<env>-<recurso>` (ex.: `staging-cloudsql-main`).
- **Tags/Labels:** `env=staging|prod`, `app=elosmed`, `owner=platform`.
- **Princípio do menor privilégio:** uma SA por serviço, IAM granular.

## Workflow padrão

```bash
# Staging
cd envs/staging
terraform init
terraform plan -out=plan.out
terraform apply plan.out

# Prod (depois de validar staging)
cd ../prod
terraform init
terraform plan -out=plan.out
terraform apply plan.out
```

## Promoção de imagens (staging → prod)

As imagens Docker são buildadas e enviadas ao Artifact Registry do
**staging** pelo workflow `.github/workflows/deploy-staging.yml`.
A promoção para **prod** copia a imagem (mesma SHA) para o Artifact
Registry de prod e faz `gcloud run deploy --image=<sha>`.

Nunca rebuilde para prod — sempre promova. Isso garante que o artefato
em produção é exatamente o que foi testado em staging.

## Custos esperados (com `min-instances=0`)

| Recurso                          | Staging       | Prod          |
|----------------------------------|---------------|---------------|
| Cloud SQL Postgres (db-custom-1-3840) | ~$45/mês  | ~$90/mês      |
| Memorystore Redis (1 GB Standard)| ~$50/mês      | ~$50/mês      |
| Cloud Run (idle = 0)             | < $5/mês      | $20–80/mês    |
| Cloud Storage (clinical images)  | $0.02/GB/mês  | $0.02/GB/mês  |
| Load Balancer + Cloud Armor      | $18/mês       | $18/mês       |
| **Total estimado (mês)**         | **~$120**     | **~$200+**    |

> Worker exige `min-instances=1` (BullMQ não pode escalar a zero). Soma
> ~$15/mês por env.
