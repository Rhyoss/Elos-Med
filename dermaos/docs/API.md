# API — Contratos e Convenções

## Autenticação

### JWT em cookies httpOnly

Todo acesso autenticado usa JWT no cookie `access_token` (clínica) ou
`portal_access` (portal do paciente). NUNCA em `localStorage` nem em
header `Authorization` retornável ao JS — tokens em JS são vulneráveis a
XSS. Cookies httpOnly + SameSite=Lax + Secure (em produção) mitigam
roubo via XSS e CSRF cross-site.

### Audiences

| Cookie          | Audience claim    | Path             | Origem                   |
|-----------------|-------------------|------------------|--------------------------|
| `access_token`  | `clinic-app`      | `/api/trpc`      | apps/web (clínica)       |
| `refresh_token` | `clinic-app-rfr`  | `/api/trpc`      | apps/web                 |
| `portal_access` | `patient-portal`  | `/api/portal`    | apps/patient-portal      |

Middleware rejeita JWT cuja audience não bate com o handler — ver
[ADR-003](ADR/003-patient-portal-isolation.md).

### Fluxo de login (clínica)

```
POST /api/trpc/auth.login
Content-Type: application/json
{ "email": "user@clinic.com", "password": "..." }

→ HTTP 200 (cookies setados via Set-Cookie)
{ "result": { "data": { "user": { ... }, "permissions": [...] } } }
```

Ao expirar (15 min), cliente chama:

```
POST /api/trpc/auth.refresh
→ HTTP 200 (novos cookies setados)
{ "result": { "data": { "ok": true } } }
```

Logout:

```
POST /api/trpc/auth.logout
→ HTTP 200 (cookies expirados; JTI blacklistado por TTL restante)
```

### MFA (futuro v2)

Roadmap: TOTP obrigatório para roles `admin`, `owner`. Atualmente não
implementado — login fica protegido apenas por argon2id + rate limit.

---

## Rate limits

Rate limit é aplicado em duas camadas:

1. **Global por IP** (`@fastify/rate-limit`): 100 req/min em todos os
   endpoints, antes do auth.
2. **Autenticado por user** (`registerAuthenticatedRateLimit`): aplicado
   após auth, varia por rota.

| Rota                              | Limite           | Janela | Justificativa                        |
|-----------------------------------|------------------|--------|--------------------------------------|
| `auth.login`                      | 5/IP             | 1 min  | Anti-bruteforce                      |
| `auth.forgotPassword`             | 3/email          | 1 hora | Anti-enumeration                     |
| `auth.refresh`                    | 30/user          | 1 min  | Refresh saudável fica abaixo         |
| `patients.search`                 | 60/user          | 1 min  | Busca em massa não é normal          |
| `lgpd.requestExport`              | 1/patient        | 24h    | Geração custosa                      |
| `webhooks/whatsapp`               | 1000/IP          | 1 min  | Burst do provider precisa caber      |
| `tRPC genérico`                   | 100/user         | 1 min  | Default                              |

Quando o limite é atingido: HTTP 429 com payload:

```json
{ "statusCode": 429, "error": "Too Many Requests",
  "message": "Muitas requisições. Tente novamente em instantes." }
```

---

## tRPC procedures por módulo

### auth

| Procedure              | Type     | Input                        | Output                     | Permissão            |
|------------------------|----------|------------------------------|----------------------------|----------------------|
| `auth.login`           | mutation | `loginSchema`                | `{ user, permissions }`    | público              |
| `auth.register`        | mutation | `registerSchema`             | `{ user }`                 | owner / admin        |
| `auth.refresh`         | mutation | (cookie)                     | `{ ok }`                   | refresh válido       |
| `auth.logout`          | mutation | -                            | `{ success }`              | autenticado          |
| `auth.changePassword`  | mutation | `changePasswordSchema`       | `{ success }`              | autenticado          |
| `auth.forgotPassword`  | mutation | `forgotPasswordSchema`       | `{ success }` (genérico)   | público              |
| `auth.resetPassword`   | mutation | `resetPasswordSchema`        | `{ success }`              | público (com token)  |
| `auth.me`              | query    | -                            | `{ user, clinic, permissions }` | autenticado    |

### patients

| Procedure                | Type     | Permissão                                        |
|--------------------------|----------|--------------------------------------------------|
| `patients.list`          | query    | `dermatologist`, `nurse`, `receptionist`, admin  |
| `patients.byId`          | query    | mesmas (com RBAC fino para PHI)                  |
| `patients.search`        | query    | mesmas                                           |
| `patients.create`        | mutation | `receptionist`, `admin`, `owner`                 |
| `patients.update`        | mutation | `receptionist`, `admin`, `dermatologist`         |
| `patients.delete`        | mutation | `admin`, `owner` (soft delete)                   |

### scheduling

| Procedure                | Type     | Permissão                                        |
|--------------------------|----------|--------------------------------------------------|
| `scheduling.slots`       | query    | autenticado                                      |
| `scheduling.book`        | mutation | `receptionist`, `dermatologist`, admin           |
| `scheduling.cancel`      | mutation | mesmas                                           |
| `scheduling.reschedule`  | mutation | mesmas                                           |
| `scheduling.checkin`     | mutation | `receptionist`, admin                            |

### clinical / encounters

| Procedure                  | Type     | Permissão                              |
|----------------------------|----------|----------------------------------------|
| `clinical.encounters.list` | query    | `dermatologist`, `nurse`, admin        |
| `clinical.encounters.byId` | query    | mesmas — RBAC bloqueia `receptionist`  |
| `clinical.encounters.create` | mutation | `dermatologist`, `nurse`             |
| `clinical.encounters.sign` | mutation | `dermatologist` (autor) ou admin       |

### supply

| Procedure                       | Type     | Permissão                       |
|---------------------------------|----------|---------------------------------|
| `supply.products.list`          | query    | autenticado                     |
| `supply.lots.byProduct`         | query    | autenticado                     |
| `supply.movements.record`       | mutation | `nurse`, `dermatologist`, admin |
| `supply.purchaseOrders.create`  | mutation | `admin`, `owner`                |
| `supply.purchaseOrders.approve` | mutation | `admin`, `owner`                |
| `supply.kits.consume`           | mutation | system (via worker)             |
| `supply.traceability.byPatient` | query    | `dermatologist`, admin          |

### omni / aurora

| Procedure                   | Type     | Permissão                       |
|-----------------------------|----------|---------------------------------|
| `omni.conversations.list`   | query    | `receptionist`, admin           |
| `omni.messages.send`        | mutation | mesmas                          |
| `aurora.knowledge.list`     | query    | `admin`                         |
| `aurora.knowledge.upload`   | mutation | `admin`                         |

### financial

| Procedure                    | Type     | Permissão                          |
|------------------------------|----------|------------------------------------|
| `financial.invoices.create`  | mutation | `financial`, `admin`               |
| `financial.invoices.cancel`  | mutation | `financial`, `admin`               |
| `financial.payments.record`  | mutation | `financial`, `receptionist`, admin |
| `financial.cashregister.day` | query    | `financial`, `admin`               |

### lgpd

| Procedure                       | Type     | Permissão                       |
|---------------------------------|----------|---------------------------------|
| `lgpd.requestExport`            | mutation | `admin` (em nome do titular)    |
| `lgpd.exportStatus`             | query    | `admin`                         |
| `lgpd.anonymizePatient`         | mutation | `admin` (com aprovação)         |
| `lgpd.consents.list`            | query    | `admin`, `dermatologist`        |
| `lgpd.consents.record`          | mutation | autenticado                     |

### settings

Todos: `admin`, `owner`.

| Procedure                       | Type     |
|---------------------------------|----------|
| `settings.clinic.update`        | mutation |
| `settings.users.list/create/update` | múltiplas |
| `settings.integrations.update`  | mutation |
| `settings.audit.list`           | query    |

---

## REST endpoints

### Webhooks externos

| Método | Path                                    | Auth                               | Conteúdo                  |
|--------|-----------------------------------------|------------------------------------|---------------------------|
| POST   | `/api/v1/webhooks/whatsapp`             | HMAC-SHA256 sobre raw body         | Meta WhatsApp business API|
| POST   | `/api/v1/webhooks/instagram`            | HMAC-SHA256                        | Meta Graph API            |
| POST   | `/api/v1/webhooks/email`                | API key no header                  | provider de email         |
| POST   | `/api/v1/webhooks/payment`              | HMAC                               | gateway de pagamento      |

Validação obrigatória: `X-Signature` header bate com HMAC do body.
Falha = HTTP 401 (não 403, evita enumeration). Re-tries do provider são
tratados via idempotency_key no payload.

### Uploads

| Método | Path                                     | Auth          | Tipo                           |
|--------|------------------------------------------|---------------|--------------------------------|
| POST   | `/api/v1/upload/lesion-image`            | tRPC cookie   | multipart, max 10 MB           |
| POST   | `/api/v1/upload/clinic-logo`             | tRPC cookie   | multipart, max 2 MB, sharp     |
| POST   | `/api/v1/upload/product-photo`           | tRPC cookie   | multipart, max 5 MB            |
| POST   | `/api/v1/upload/aurora-knowledge`        | tRPC cookie   | multipart, PDF/DOCX/MD         |

### Observabilidade

| Método | Path           | Auth                           | Resposta                      |
|--------|----------------|--------------------------------|-------------------------------|
| GET    | `/health`      | público                        | `{ status, uptime, version }` |
| GET    | `/ready`       | público                        | health de cada dependência    |
| GET    | `/metrics`     | IP allowlist + Basic Auth      | Prometheus exposition format  |

### Portal do Paciente

Prefixo `/api/portal`. Todas as rotas exigem `portal_access` cookie com
audience `patient-portal`.

| Método | Path                                | Conteúdo                 |
|--------|-------------------------------------|--------------------------|
| POST   | `/api/portal/auth/login`            | email + senha + captcha  |
| POST   | `/api/portal/auth/magic-link`       | email + captcha          |
| GET    | `/api/portal/me`                    | dados do paciente        |
| GET    | `/api/portal/appointments`          | próximos agendamentos    |
| POST   | `/api/portal/appointments/book`     | agendar                  |
| GET    | `/api/portal/prescriptions`         | prescrições com PDF link |
| GET    | `/api/portal/exams`                 | resultados disponíveis   |
| POST   | `/api/portal/messages`              | enviar mensagem          |

---

## Códigos de erro padronizados

| Código tRPC               | HTTP | Quando ocorre                                                     |
|---------------------------|------|-------------------------------------------------------------------|
| `BAD_REQUEST`             | 400  | Validação Zod falhou no input                                     |
| `UNAUTHORIZED`            | 401  | Token ausente/expirado/inválido; senha incorreta                  |
| `FORBIDDEN`               | 403  | Auth válido mas role/permissão insuficiente; cross-tenant         |
| `NOT_FOUND`               | 404  | Recurso não existe ou está oculto por RLS                         |
| `CONFLICT`                | 409  | UNIQUE constraint, idempotency_key duplicado, status incompatível |
| `PRECONDITION_FAILED`     | 412  | Operação requer estado prévio (ex: encounter não assinado)        |
| `TOO_MANY_REQUESTS`       | 429  | Rate limit ou conta bloqueada                                     |
| `INTERNAL_SERVER_ERROR`   | 500  | Bug — sempre logado com correlationId                             |

Erros de domínio retornam `BAD_REQUEST` ou `CONFLICT` com `code` interno
no `data`:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Lote vencido não pode ser consumido",
    "data": { "code": "supply.lot_expired", "lotId": "..." }
  }
}
```

---

## Exemplos de request/response (curl)

### Login

```bash
curl -i -X POST http://localhost:3001/api/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dermaos-test.com","password":"admin123"}' \
  -c cookies.txt
```

Resposta:

```
HTTP/1.1 200 OK
Set-Cookie: access_token=eyJ...; HttpOnly; SameSite=Lax; Path=/api/trpc
Set-Cookie: refresh_token=eyJ...; HttpOnly; SameSite=Lax; Path=/api/trpc

{ "result": { "data": { "user": { "id": "...", "role": "admin", ... }, ... } } }
```

### Listar pacientes

```bash
curl http://localhost:3001/api/trpc/patients.list \
  -b cookies.txt \
  --get --data-urlencode 'input={"limit":20,"offset":0}'
```

### Criar agendamento

```bash
curl -X POST http://localhost:3001/api/trpc/scheduling.book \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "patientId": "...", "providerId": "...", "serviceId": "...",
    "scheduledAt": "2026-05-01T14:00:00-03:00", "durationMin": 30
  }'
```

### Webhook WhatsApp (provider → DermaOS)

```bash
curl -X POST http://localhost:3001/api/v1/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=<HMAC do body>" \
  -d '{ "object": "whatsapp_business_account", ... }'
```

---

## Atualizando este documento

A cada nova procedure tRPC ou rota REST:

1. Adicionar à tabela do módulo (com permissão exigida).
2. Documentar input/output via Zod schema em `packages/shared/`.
3. Para erros de domínio novos, adicionar à tabela de códigos.
4. PR review deve verificar que esta doc foi atualizada.
