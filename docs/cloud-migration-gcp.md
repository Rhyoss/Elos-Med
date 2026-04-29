# Migração para Google Cloud — Guia de Segurança

Este documento mapeia, para cada correção do Sprint 0 emergencial, como o
mesmo controle deve ser aplicado em GCP. Use-o ao migrar do Docker Compose
local para Cloud Run / GKE + Cloud SQL + Memorystore + Cloud Storage +
Secret Manager.

---

## SEC-01 · Postgres: Admin separado da App (RLS preservada)

**Local (Docker)** — `db/init/000_app_roles.sh` cria três roles
(`dermaos_app`, `dermaos_worker`, `dermaos_readonly`) com `NOSUPERUSER
NOBYPASSRLS` lendo senhas das envs `POSTGRES_*_PASSWORD`. O smoke
`db/init/099_security_smoke.sql` falha em FATAL se algum atributo regredir.

**Cloud SQL (Postgres 16)**

1. **Provisionar a instância** com Terraform (ou Console). O usuário criado
   pelo `--root-user`/`google_sql_user` recebe `cloudsqlsuperuser` —
   trate-o como `dermaos_admin`. NUNCA use esta conta para a aplicação.

   ```hcl
   resource "google_sql_user" "admin" {
     name     = "dermaos_admin"
     instance = google_sql_database_instance.main.name
     password = data.google_secret_manager_secret_version.pg_admin.secret_data
   }
   ```

2. **Criar as roles de aplicação via SQL** (rodando como `dermaos_admin`,
   uma única vez no provisionamento). O mesmo conteúdo de
   `db/init/000_app_roles.sh` pode ser executado por `gcloud sql connect`
   ou um job Cloud Build.

   > ⚠ Cloud SQL **não permite** SUPERUSER real, mas `cloudsqlsuperuser`
   > tem `BYPASSRLS=true` por padrão. As roles da app devem ser criadas
   > com `NOBYPASSRLS NOSUPERUSER` (o que o nosso script já faz). O smoke
   > `099_security_smoke.sql` continua valendo em Cloud SQL.

3. **Conexão da aplicação** via Cloud SQL Auth Proxy (Cloud Run sidecar
   ou Workload Identity em GKE). A `DATABASE_URL` aponta para o Unix
   socket:

   ```
   DATABASE_URL=postgresql://dermaos_app:<SENHA>@/dermaos?host=/cloudsql/PROJECT:REGION:INSTANCE
   ```

   A senha deve vir do Secret Manager — Cloud Run:
   `--update-secrets=POSTGRES_APP_PASSWORD=postgres-app-password:latest`.

4. **Ativar Private IP** na instância e desabilitar IP público. Combinado
   com VPC Service Controls, isso garante que ninguém alcance o banco
   fora da VPC do projeto.

---

## SEC-03 · Webhooks omnichannel: fail-closed sem segredo

**Local** — `apps/api/src/modules/omni/channels/*.channel.ts` agora
retornam `false` quando `appSecret`/`webhookSecret`/`signingKey` estão
ausentes, independente de `mode`.

**GCP**

- Os segredos por canal (Meta App Secret, Telegram Webhook Secret, Mailgun
  Signing Key) ficam em `omni.channels.config` (jsonb cifrado por
  `EncryptionService`). Em produção, leia de Secret Manager se preferir
  rotacionar centralmente, mas o caminho atual já cobre.
- Coloque um Cloud Armor rule rejeitando `POST /api/v1/webhooks/*` sem
  o header esperado (`X-Hub-Signature-256` para Meta, `X-Telegram-Bot-Api-
  Secret-Token`). Filtragem de borda evita carga inútil no app.

---

## SEC-04 · Presigned URL com input não confiável (IDOR)

**Local** — `products.photoUrl` agora aceita `productId` (UUID) e busca o
`photo_object_key` no banco com filtro `clinic_id = ctx.clinicId`.

**GCP** — ao migrar de MinIO para Cloud Storage:

- Substitua `presignGet(objectKey, ttl)` por
  `bucket.file(objectKey).getSignedUrl({ action: 'read', expires: ... })`
  do `@google-cloud/storage`. A propriedade de tenant deve continuar
  vindo do banco — nunca do input do cliente.
- Use buckets **distintos** por nível de sensibilidade (`clinical-images`,
  `prescriptions`, `product-images`, `avatars`) com IAM separado e
  Customer-Managed Encryption Keys (CMEK) via Cloud KMS para os dois
  primeiros (PHI).

---

## SEC-05 · AI Service Key: sem default, constant-time

**Local** — `apps/ai/src/config.py` define `ai_service_key` com
`min_length=32` e rejeita placeholders (`change-me`, `secret`, etc.).
`apps/ai/src/main.py` usa `hmac.compare_digest`.

**GCP**

- Gere com `openssl rand -hex 32` e armazene em Secret Manager.
- Cloud Run AI service:
  ```
  gcloud run deploy dermaos-ai \
    --update-secrets=AI_SERVICE_KEY=ai-service-key:latest \
    --ingress=internal \
    --no-allow-unauthenticated \
    ...
  ```
- API/Worker chamam o AI passando o segredo lido também do Secret
  Manager, **nunca** lido por proxy/template literal em logs.

---

## SEC-10 · AI Service não exposto publicamente

**Local** — removidos `ports:` e `dermaos-public` do serviço `ai` no
`docker-compose.yml`. Apenas o `proxy` (nginx) participa de ambas redes
e roteia `/ai/` para o serviço interno.

**GCP** — duas opções:

1. **Cloud Run com `--ingress=internal`**: o serviço só é alcançável a
   partir da VPC do projeto. Combine com `--vpc-egress=all-traffic` no
   serviço chamador (api/worker) e Serverless VPC Connector.

2. **GKE com NetworkPolicy** isolando o pod do AI:
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata: { name: ai-deny-external }
   spec:
     podSelector: { matchLabels: { app: dermaos-ai } }
     policyTypes: [Ingress]
     ingress:
       - from:
           - podSelector: { matchLabels: { app: dermaos-api } }
           - podSelector: { matchLabels: { app: dermaos-worker } }
   ```

Em qualquer caso: **mantenha o `X-Service-Key` mesmo dentro da VPC**
(defesa em profundidade).

---

## Inventário de segredos (Secret Manager)

| Secret                       | Origem (.env)                  | Consumidor             |
|------------------------------|--------------------------------|------------------------|
| `postgres-admin-password`    | `POSTGRES_ADMIN_PASSWORD`      | Migrations / Terraform |
| `postgres-app-password`      | `POSTGRES_APP_PASSWORD`        | api, web (SSR)         |
| `postgres-worker-password`   | `POSTGRES_WORKER_PASSWORD`     | worker                 |
| `postgres-readonly-password` | `POSTGRES_READONLY_PASSWORD`   | BI / dashboards        |
| `redis-password`             | `REDIS_PASSWORD`               | api, worker            |
| `jwt-secret`                 | `JWT_SECRET`                   | api                    |
| `jwt-refresh-secret`         | `JWT_REFRESH_SECRET`           | api (após SEC-06)      |
| `cookie-secret`              | (novo após SEC-07)             | api                    |
| `encryption-key`             | `ENCRYPTION_KEY`               | api, worker            |
| `ai-service-key`             | `AI_SERVICE_KEY`               | ai, api                |
| `claude-api-key`             | `CLAUDE_API_KEY`               | ai, api                |

Nunca exporte estes valores como env literais em manifests YAML — sempre
use `--update-secrets` (Cloud Run) ou `Secret` k8s + Workload Identity.
