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

A primeira vez que o Redis é provisionado em staging, siga **na ordem**:

```bash
# 1. Aplica o módulo cache (e tudo que depende dele).
#    Cria a instância Memorystore com auth + transit encryption (TLS).
terraform apply -target=module.cache
# ou apenas: terraform apply

# 2. Popular o secret `redis-url` no Secret Manager com a URL completa
#    (rediss://:<auth>@<host>:<port>). O script lê o output `redis_url`
#    sensitive do Terraform e envia direto para o gcloud — nunca grava
#    em disco e nunca aparece em logs.
bash ../../../scripts/seed-redis-url.sh staging

# 3. Redeploy dos serviços para carregarem a nova versão do secret
#    (api e worker são os consumidores).
git push origin main          # ou workflow_dispatch em "Deploy"
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
