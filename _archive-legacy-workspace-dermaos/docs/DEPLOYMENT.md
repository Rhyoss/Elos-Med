# Deployment — Setup, Produção, Backup, Monitoramento

## Pré-requisitos para produção

| Item                 | Mínimo            | Recomendado          |
|----------------------|-------------------|----------------------|
| CPU                  | 4 cores           | 8 cores              |
| RAM                  | 8 GB              | 16 GB (32 com Ollama)|
| Disco                | 100 GB SSD        | 500 GB NVMe          |
| Domínio              | obrigatório       | + subdomínio portal  |
| Certificado SSL      | obrigatório       | Let's Encrypt + DNS-01|
| Postgres backup target | S3 / Azure Blob | S3 + offsite         |
| SMTP                 | obrigatório       | Provider transacional|

Stack rodando em **Docker Compose** (single-host) ou **Kubernetes**
(produção em escala). Esta doc cobre Docker Compose; manifests K8s ficam
em repo separado.

## Variáveis de ambiente

Lista completa em `.env.example`. Categoria, obrigatório, exemplo.

### Obrigatórias em qualquer ambiente

| Variável                  | Descrição                                  | Exemplo (NUNCA usar real)         |
|---------------------------|--------------------------------------------|-----------------------------------|
| `NODE_ENV`                | `development` / `production` / `test`      | `production`                      |
| `POSTGRES_DB`             | nome do banco                              | `dermaos`                         |
| `POSTGRES_USER`           | usuário PG                                 | `dermaos_app`                     |
| `POSTGRES_PASSWORD`       | senha PG (forte)                           | `<openssl rand -base64 32>`       |
| `POSTGRES_PORT`           | porta exposta                              | `5432`                            |
| `REDIS_PASSWORD`          | senha Redis (forte)                        | `<openssl rand -base64 32>`       |
| `REDIS_PORT`              | porta exposta                              | `6379`                            |
| `MINIO_ROOT_USER`         | admin MinIO                                | `dermaos_minio`                   |
| `MINIO_ROOT_PASSWORD`     | senha admin MinIO                          | `<openssl rand -base64 32>`       |
| `JWT_SECRET`              | min 64 chars random                        | `<openssl rand -base64 64>`       |
| `JWT_REFRESH_SECRET`      | min 64 chars random (DIFERENTE do acima)   | `<openssl rand -base64 64>`       |
| `MASTER_ENCRYPTION_KEY`   | 64 hex chars (32 bytes)                    | `<openssl rand -hex 32>`          |
| `MASTER_KEY_VERSION`      | int positivo                               | `1`                               |
| `TENANT_HMAC_SECRET`      | min 32 chars random                        | `<openssl rand -base64 32>`       |
| `ENCRYPTION_KEY`          | 64 hex chars (legado, ainda usado)         | `<openssl rand -hex 32>`          |
| `TYPESENSE_API_KEY`       | 32+ chars                                  | `<openssl rand -hex 32>`          |
| `SMTP_HOST`               | servidor SMTP                              | `smtp.sendgrid.net`               |
| `SMTP_USER`/`PASS`        | credenciais SMTP                           | -                                 |
| `WEBHOOK_SECRET`          | HMAC para webhooks                         | `<openssl rand -base64 32>`       |

### Obrigatórias em produção (extras)

| Variável                  | Descrição                                  |
|---------------------------|--------------------------------------------|
| `WHATSAPP_API_TOKEN`      | Meta WhatsApp Business token               |
| `WHATSAPP_PHONE_NUMBER_ID`| ID do número configurado                   |
| `WHATSAPP_VERIFY_TOKEN`   | Token de verificação do webhook            |
| `PORTAL_VAPID_*`          | Chaves Web Push (gere com web-push CLI)    |
| `PORTAL_CAPTCHA_SECRET`   | hCaptcha ou Turnstile (NUNCA reCAPTCHA)    |
| `CLAUDE_API_KEY`          | Claude API (apenas para análises não-PHI)  |
| `AI_SERVICE_KEY`          | Chave interna entre api e ai service       |
| `METRICS_ALLOWED_IPS`     | IPs autorizados a /metrics                 |
| `METRICS_USERNAME` / `PASSWORD` | Basic Auth para /metrics              |

### Sensíveis — NUNCA commitar

`MASTER_ENCRYPTION_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`TENANT_HMAC_SECRET`, `WEBHOOK_SECRET` e senhas de banco/redis. Em
produção, gerenciar via Vault / Azure Key Vault / AWS Secrets Manager.
NUNCA aparecer em logs, em commits, ou em screenshots.

## Deploy local (Docker Desktop)

```bash
git clone <repo> && cd dermaos
./scripts/setup.sh         # cria .env de template, sobe infra, migrations
pnpm db:seed               # dados de demo
pnpm dev                   # web/portal/api/worker em watch mode
```

URLs:
- Web: http://localhost:3000
- Portal: http://localhost:3002
- API: http://localhost:3001

Para parar:

```bash
pnpm docker:down           # mantém volumes
pnpm docker:reset          # apaga volumes — limpa banco
```

## Deploy em produção (single-host VPS / Azure VM)

### 1. Preparar host

```bash
# Ubuntu 22.04+ recomendado
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
```

### 2. Provisionar segredos

```bash
mkdir -p /opt/dermaos && cd /opt/dermaos
git clone <repo> .

# Gerar segredos fortes
cp .env.example .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')|" .env
sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')|" .env
sed -i "s|MASTER_ENCRYPTION_KEY=.*|MASTER_ENCRYPTION_KEY=$(openssl rand -hex 32)|" .env
sed -i "s|TENANT_HMAC_SECRET=.*|TENANT_HMAC_SECRET=$(openssl rand -base64 48 | tr -d '\n' | head -c 64)|" .env
# ... POSTGRES_PASSWORD, REDIS_PASSWORD, MINIO_ROOT_PASSWORD, etc.
```

### 3. Configurar reverse proxy

`nginx/` contém configuração para HTTPS + WebSocket upgrade. Resumo:

- `web.dermaos.com.br` → apps/web :3000
- `portal.dermaos.com.br` → apps/patient-portal :3002
- `api.dermaos.com.br` → apps/api :3001
- WebSocket via path `/api/realtime` no api

Certificados Let's Encrypt via certbot DNS-01 (recomendado para portal
do paciente que não pode ficar offline durante renewal).

### 4. Subir

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Inicialmente:
1. Containers de infraestrutura (db, cache, storage, search) sobem.
2. Migrations rodam automaticamente (script `migrate.sh` no entrypoint da api).
3. Apps iniciam.

Verificar:

```bash
curl https://api.dermaos.com.br/health      # deve retornar 200
curl https://api.dermaos.com.br/ready       # deve retornar 200 com overall=ok
docker compose ps                            # todos healthy
```

### 5. Configurar DNS e webhooks externos

- DNS A/AAAA → IP do host.
- Webhook WhatsApp configurado no painel Meta:
  `https://api.dermaos.com.br/api/v1/webhooks/whatsapp`
- Token de verificação: valor de `WHATSAPP_VERIFY_TOKEN`.

### 6. Smoke test final

```bash
NODE_ENV=production bash scripts/smoke-test.sh \
  --base-url https://api.dermaos.com.br \
  --force-production
```

Falha = NÃO liberar acesso de usuários.

## Backup e restore

### Backup automático

`scripts/backup.sh` roda via cron diário às 03:00:

```cron
0 3 * * * /opt/dermaos/scripts/backup.sh >> /var/log/dermaos/backup.log 2>&1
```

O script:

1. `pg_dump --format=custom --compress=9` do banco — vai para
   `/var/backups/dermaos/pg-YYYYMMDD-HHMMSS.dump`.
2. Snapshot do MinIO via `mc mirror` para bucket de backup remoto (S3
   ou Azure Blob com versionamento ativo).
3. Retenção local: 7 dias. Retenção remota: 90 dias com lifecycle.
4. Notifica via email se backup falhar.

### Verificar integridade

Cada backup inclui um arquivo `.sha256` com hash. Verificação:

```bash
sha256sum -c /var/backups/dermaos/pg-20260425-030000.dump.sha256
```

Em adição, mensalmente fazer **restore-test em ambiente isolado** para
validar que o backup é restaurável de fato (não só sintaticamente). É
fácil ter backup corrompido por meses sem perceber.

### Restore manual

```bash
# 1. Criar instância isolada (não tocar produção até validar)
docker run -d --name dermaos-restore -e POSTGRES_PASSWORD=tmp \
  -p 15432:5432 postgres:16-alpine

# 2. Aplicar dump
PGPASSWORD=tmp pg_restore --clean --create -h localhost -p 15432 \
  -U postgres -d postgres /var/backups/dermaos/pg-20260425-030000.dump

# 3. Verificar contagem de tabelas-chave
psql -h localhost -p 15432 -U postgres -d dermaos -c \
  "SELECT
     (SELECT COUNT(*) FROM shared.patients) AS patients,
     (SELECT COUNT(*) FROM shared.appointments) AS appointments,
     (SELECT COUNT(*) FROM clinical.encounters) AS encounters;"

# 4. Se OK e for restore real em produção:
#    a) Parar app (mas não infra)
#    b) docker compose stop api worker web portal
#    c) Aplicar dump no banco real (pg_restore --clean)
#    d) docker compose start
#    e) bash scripts/smoke-test.sh
```

Ver `scripts/backup.sh` para detalhes completos.

## Monitoramento

### Health endpoints

- `GET /health` — liveness (sempre rápido, < 100ms, sem dependências)
- `GET /ready` — readiness (cada dependência com timeout)
- `GET /metrics` — Prometheus exposition (IP allowlist + Basic Auth)

Alertmanager mínimo:

```
ALERT api-down                IF up{job="dermaos-api"} == 0 FOR 2m
ALERT db-unhealthy            IF dermaos_db_up == 0 FOR 1m
ALERT redis-unhealthy         IF dermaos_redis_up == 0 FOR 1m
ALERT high-error-rate         IF rate(dermaos_http_errors[5m]) > 0.05
ALERT slow-readiness          IF dermaos_ready_duration_ms > 5000 FOR 5m
ALERT bullmq-queue-stalled    IF dermaos_queue_stalled_count > 10
ALERT cert-expiring           IF cert_expiry_days < 14
```

### Logs

Pino structured logging → stdout → coletado por Loki/Datadog/CloudWatch.
Cada log linha tem `correlationId` (request) e `clinicId` quando
aplicável. Para PII: `lib/pii-redactor.ts` remove campos sensíveis antes
de logar.

Buscas comuns:

```
{ correlationId: "abc-123", clinicId: "<uuid>" }   # request completo
{ severity: "error", clinicId: "<uuid>" }          # erros de uma clínica
{ "stock.critical_alert" }                         # eventos de domínio
```

### Métricas-chave

| Métrica                              | Tipo      | Onde olhar          |
|--------------------------------------|-----------|---------------------|
| `dermaos_http_request_duration_seconds` | Histogram | latência por rota   |
| `dermaos_http_requests_total`        | Counter   | RPS por rota/status |
| `dermaos_socket_connections`         | Gauge     | conexões ativas     |
| `dermaos_db_query_duration_seconds`  | Histogram | queries lentas      |
| `dermaos_queue_jobs_processed_total` | Counter   | throughput de filas |
| `dermaos_queue_jobs_failed_total`    | Counter   | DLQ rate            |
| `dermaos_event_published_total`      | Counter   | eventos por tipo    |

## Troubleshooting

| Sintoma                                        | Causa provável                              | Solução                                          |
|------------------------------------------------|---------------------------------------------|--------------------------------------------------|
| `/ready` retorna 503 com `database: error`     | Postgres caiu ou pool exausto               | Verificar logs do PG; aumentar `max` do pool     |
| `/ready` retorna 200 com `typesense: error`    | Search degradado (não bloqueante)           | Reiniciar typesense; verificar disk              |
| Login retorna 429 sempre                       | Rate limit por IP atingido                  | Verificar fonte de tráfego; ajustar `RATE_LIMIT_MAX` |
| WebSocket desconecta a cada 25s                | Ping/pong timeout                           | Verificar reverse proxy (Nginx idle_timeout)     |
| `Cross-tenant lookup retorna dados`            | RLS desabilitado em alguma tabela           | **CRÍTICO** — rodar smoke test, ALTER TABLE ENABLE RLS |
| Worker não processa fila                       | Redis lock distribuído travado              | `DEL` da chave de lock; ver logs do worker       |
| Migration trava com `lock not available`       | Conexão zumbi segurando lock                | `SELECT pid FROM pg_stat_activity WHERE state = 'active'`; `pg_terminate_backend(pid)` |
| `MASTER_KEY_VERSION` mismatch após rotação     | `.env` atualizado mas serviço não reiniciado| Restart do api e worker                          |
| Push notification não chega no portal          | VAPID expirado ou subscription stale        | Re-emitir VAPID, limpar subscriptions inválidas  |

## Atualizando este documento

Mantido por DevOps / SRE. Atualizar:

- A cada mudança em `docker-compose*.yml`.
- A cada nova variável de ambiente (em `.env.example` e aqui).
- A cada problema de produção que entrou no troubleshooting.
- A cada mudança no script de backup ou rotação de chaves.
