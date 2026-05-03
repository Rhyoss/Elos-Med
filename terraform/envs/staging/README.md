# ELOS MED — Staging Terraform

Infraestrutura GCP do ambiente `staging` (projeto `elos-med`, região `southamerica-east1`).

State remoto: `gs://elos-med-tfstate/staging/`.

## Pré-requisitos

- `terraform >= 1.6`
- `gcloud` autenticado (`gcloud auth application-default login`) com permissão de Editor no projeto `elos-med`.
- O bootstrap inicial já foi executado via [`scripts/provision-staging.sh`](../../../scripts/provision-staging.sh) — Terraform assume Artifact Registry, VPC, Secret Manager containers e SAs já existentes (eles são `import`-friendly).

## Comandos básicos

```bash
cd terraform/envs/staging

terraform init
terraform plan
terraform apply
```

## Sequência de provisionamento do Redis (Memorystore)

> **Nota:** atualmente a infra de staging foi bootstrap via `gcloud` (script
> [`scripts/provision-staging.sh`](../../../scripts/provision-staging.sh)) e o
> state Terraform está vazio. Por isso, o caminho atual usa `gcloud` direto.
> Quando todo o state for importado para Terraform, é só trocar `--source=gcloud`
> por `--source=terraform` no comando do passo 2.

### Caminho atual (gcloud direto)

```bash
# 1. Habilita API e cria a instância Memorystore Basic 1GB com AUTH + TLS.
#    Async: ~5-10 min até state=READY.
gcloud services enable redis.googleapis.com --project=elos-med

gcloud redis instances create staging-elosmed-redis \
  --project=elos-med \
  --region=southamerica-east1 \
  --tier=basic \
  --size=1 \
  --redis-version=redis_7_2 \
  --network=projects/elos-med/global/networks/staging-elosmed-vpc \
  --connect-mode=PRIVATE_SERVICE_ACCESS \
  --enable-auth \
  --transit-encryption-mode=server-authentication \
  --redis-config=maxmemory-policy=allkeys-lru \
  --maintenance-window-day=sunday \
  --maintenance-window-hour=4 \
  --labels=env=staging,app=elosmed \
  --async

# Cria o container do secret (uma vez só)
gcloud secrets create redis-url \
  --project=elos-med \
  --replication-policy=user-managed \
  --locations=southamerica-east1 \
  --labels=env=staging,app=elosmed

# 2. Espera ficar READY e popula o secret `redis-url`.
#    Lê host/port/auth via gcloud e envia direto pro Secret Manager.
until [[ "$(gcloud redis instances describe staging-elosmed-redis \
    --region=southamerica-east1 --project=elos-med \
    --format='value(state)')" == "READY" ]]; do sleep 30; done

bash ../../../scripts/seed-redis-url.sh staging elos-med --source=gcloud

# 3. Redeploy dos serviços para carregarem o secret (api e worker).
git push origin main          # ou workflow_dispatch em "Deploy"
```

### Caminho futuro (Terraform)

Quando o state estiver completo:

```bash
terraform apply -target=module.cache
bash ../../../scripts/seed-redis-url.sh staging elos-med --source=terraform
git push origin main
```

### Por quê secret único `redis-url`?

| Aspecto                       | `REDIS_URL` único | `REDIS_HOST` + `REDIS_PASSWORD` separados |
|-------------------------------|-------------------|-------------------------------------------|
| Endpoint em logs do CI        | nunca aparece     | aparece em todo deploy                    |
| Endpoint no painel Cloud Run  | "from secret"     | texto puro                                |
| TLS (`rediss://`) garantido   | sim, no secret    | depende do código construir certo         |
| Rotação                       | atômica           | 2 lugares para sincronizar                |

A URL é construída pelo output `redis_url` do [`module.cache`](../../modules/cache/outputs.tf), que sempre força `rediss://` — o cliente recusa esquema `redis://` em produção (ver [`apps/api/src/config/env.ts`](../../../apps/api/src/config/env.ts) e [`apps/worker/src/index.ts`](../../../apps/worker/src/index.ts)).

## Rotação do secret `redis-url`

Quando o `auth_string` do Memorystore muda (rotação manual via `gcloud redis instances update --auth-enabled`) ou o host muda, basta rodar de novo:

```bash
bash scripts/seed-redis-url.sh staging
git push origin main          # redeploy
```

Versões antigas do secret continuam acessíveis até serem desabilitadas — útil para rollback.

## Outputs úteis

```bash
terraform output cloudsql_connection_name      # para Cloud SQL Auth Proxy
terraform output redis_host                    # IP privado do Memorystore (debug)
terraform output -raw redis_url                # rediss://...:6379 (sensitive)
terraform output cloud_run_urls                # URLs dos serviços
terraform output github_actions_secrets        # vars para gh secret set
```

## Rotina de destruição (cuidado)

`force_destroy = true` no module.storage permite apagar buckets com objetos. Cloud SQL tem `deletion_protection = false` em staging — o que torna `terraform destroy` viável, mas **toda PHI seed deve ser apagada antes** se houver dados reais de paciente.
