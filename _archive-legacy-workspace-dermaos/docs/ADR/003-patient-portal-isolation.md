# ADR-003: Isolamento de sessão entre portal do paciente e clínica

**Status:** Accepted
**Data:** 2026-04-15
**Autores:** Backend Lead, Security Lead

## Contexto

O Portal do Paciente (`apps/patient-portal`) e o app da clínica
(`apps/web`) consomem a mesma API mas são fronteiras de segurança
distintas:

- **Web da clínica** dá acesso completo a registros clínicos, finanças,
  estoque. Audiência: profissionais de saúde, secretária, admin.
- **Portal do paciente** dá acesso APENAS ao próprio prontuário do
  paciente que se autentica. Audiência: paciente final, sem treinamento.

Riscos identificados:

1. **Token cross-audience:** se um JWT emitido para `apps/web` for
   reaproveitado em chamadas do portal (ou vice-versa), o paciente pode
   acessar funcionalidades de funcionário ou um funcionário se passar
   por paciente.
2. **CSRF cross-origin:** cookie httpOnly do web vazando para domínio do
   portal ou vice-versa.
3. **Confusão de subject:** `user_id` da clínica e `patient_id` são UUIDs
   distintos; uma rota que aceita ambos por engano vira escalação.

## Decisão

Implementar isolamento em três camadas:

### 1. Audience claim no JWT

JWTs do portal levam `aud: 'patient-portal'`. JWTs da clínica levam
`aud: 'clinic-app'`. Middleware `authMiddleware` rejeita JWT cuja
audience não bate com a rota.

```ts
// apps/api/src/modules/auth/auth.service.ts
sign({ sub, clinicId, role, aud: 'clinic-app' }, JWT_SECRET);

// apps/api/src/modules/patient-portal/portal.service.ts
sign({ sub: patientId, clinicId, aud: 'patient-portal' }, JWT_SECRET);
```

### 2. Rotas separadas

- Clínica: `/api/trpc/*` — audience exigida: `clinic-app`.
- Portal:  `/api/portal/*` — audience exigida: `patient-portal`.

Não há rota que aceita ambas as audiences.

### 3. Cookies separados por path

- `access_token` (clínica): `Path=/api/trpc; HttpOnly; Secure; SameSite=Lax`.
- `portal_access` (paciente): `Path=/api/portal; HttpOnly; Secure; SameSite=Lax`.

O `Path` do cookie impede que o navegador envie um cookie para a outra
fronteira mesmo que JS malicioso conheça o nome.

### 4. CAPTCHA + rate limit no portal

Login do portal exige hCaptcha/Turnstile (NÃO Google reCAPTCHA — vazamento
de dados do paciente para Google é problema LGPD). Rate limit por IP
mais agressivo (5 req/min vs 30/min na clínica).

## Consequências

### Positivas

- Token vazado de um lado não funciona no outro.
- Auditoria fica clara: `audit_log.actor_type` é `user` ou `patient`,
  nunca ambíguo.
- RLS continua aplicado em ambos — `clinic_id` é setado pelo middleware
  com base no JWT validado.

### Negativas

- Dois fluxos de login (clínica e portal) — código duplicado em parte
  do `auth.service`.
- Devs precisam lembrar de qual audience escolher ao adicionar nova
  rota — mitigado por convenção: rotas em `modules/patient-portal/` são
  audience `patient-portal`, todas as outras são `clinic-app`.

### Neutras

- Portal precisa de domínio separado em produção (`portal.dermaos.com.br`)
  para isolamento de cookies por origin.

## Alternativas consideradas

### Mesmo JWT com `role: 'patient'`

Descartado: misturar pacientes em `shared.users` quebraria FK de várias
tabelas e exigiria mudança de RBAC profunda. Mantemos `shared.patients`
como entidade separada com auth próprio.

### Portal como subdomínio sem audience claim

Descartado: cookies SameSite=Lax podem ser enviados em navegação
cross-subdomain dependendo de configuração. Audience explícita no JWT
é defesa em profundidade.

## Referências

- RFC 7519 — JSON Web Tokens (claim `aud`)
- LGPD art. 11 — dados de saúde como sensíveis
- [portal.plugin.ts](../../apps/api/src/modules/patient-portal/portal.plugin.ts)
