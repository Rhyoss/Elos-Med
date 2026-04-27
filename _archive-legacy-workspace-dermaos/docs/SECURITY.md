# Segurança — Modelo STRIDE, LGPD e Resposta a Incidentes

## Modelo de ameaças (STRIDE simplificado)

### S — Spoofing (falsificação de identidade)

| Ameaça                                                  | Mitigação                                                                                          |
|---------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| Atacante usa credencial vazada de funcionário           | Argon2id + lockout após 5 falhas; alerta em login de IP novo (`shared.users.known_ip_hashes`)      |
| Token JWT roubado via XSS                               | Cookies httpOnly + CSP estrita + sanitização de inputs com `lib/sanitize.ts`                       |
| Webhook forjado de provider externo                     | Validação HMAC sobre raw body antes de qualquer parse                                              |
| Paciente se passa por outro paciente no portal          | Audience claim `patient-portal` no JWT + lookup por `patient_id` exato                            |
| Atacante usa token de portal para acessar API da clínica| `aud: 'patient-portal'` rejeitado em `/api/trpc/*` ([ADR-003](ADR/003-patient-portal-isolation.md))|

**Roadmap (v2):** TOTP MFA obrigatório para roles `admin`, `owner`.
WebAuthn como segunda opção.

### T — Tampering (alteração não autorizada)

| Ameaça                                                  | Mitigação                                                                                          |
|---------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| Funcionário altera prontuário pós-assinatura            | Encounter com `signed_at IS NOT NULL` é imutável (trigger no banco) + `signature_hash` SHA-256     |
| Adulteração de rastreabilidade ANVISA                   | `supply.patient_lot_traces` é append-only — UPDATE/DELETE bloqueados por trigger                   |
| Adulteração de log de auditoria                         | `audit.audit_log` imutável (trigger BEFORE UPDATE/DELETE → RAISE EXCEPTION)                        |
| Modificação de evento de domínio                        | `audit.domain_events` imutável (trigger) — sem UPDATE/DELETE                                       |
| Tampering em ciphertext entre tenants                   | AES-GCM AAD = clinic_id — auth tag falha se ciphertext for movido entre clínicas                  |

### R — Repudiation (negação de autoria)

| Ameaça                                                  | Mitigação                                                                                          |
|---------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| "Não fui eu que assinei essa prescrição"                | `prescription.signed_at` + `signed_by` + `signature_hash` (SHA-256 do conteúdo no momento)         |
| "Eu não cancelei esse appointment"                      | `appointments.status_history` JSONB com `changed_by` em cada transição                             |
| "Não autorizei a aplicação desse lote"                  | `patient_lot_traces.applied_by` + `applied_at` + signed encounter referenciado                     |
| "Não recebi notificação de novo IP"                     | `audit.security_events` registra `login.new_ip` com IP, geo, user_agent                           |

### I — Information Disclosure (vazamento de informação)

| Ameaça                                                  | Mitigação                                                                                          |
|---------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| Dump do banco vaza PHI                                  | Campos PHI cifrados AES-256-GCM por tenant ([ADR-002](ADR/002-encryption-strategy.md))             |
| Cross-tenant via SQL injection                          | Parametrização de queries (PG driver) + RLS como segunda linha                                     |
| Cross-tenant via bug em código                          | RLS sempre ativo; smoke test bloqueia deploy se isolamento quebrar                                 |
| PII em logs                                             | `lib/pii-redactor.ts` remove campos sensíveis antes de logar                                       |
| Vazamento via headers / response                        | `helmet` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)                     |
| Enumeration em endpoint de login/forgot-password        | Resposta genérica + rate limit por email (`auth.forgotPassword`)                                   |
| Header verbose / stack trace em produção                | `NODE_ENV=production` desabilita stack trace; erros 500 logados internos                           |
| Vazamento via timing attack em comparação de senha      | argon2id verify (constant-time)                                                                    |

### D — Denial of Service

| Ameaça                                                  | Mitigação                                                                                          |
|---------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| Bruteforce de login                                     | Rate limit 5/min por IP + lockout 30min após 5 falhas                                              |
| Burst em endpoint público                               | `@fastify/rate-limit` 100/min por IP global                                                        |
| Resource exhaustion via upload grande                   | Limite de tamanho por endpoint (lesion 10MB, logo 2MB) + multipart streaming                       |
| Memory leak em socket connections                       | `pingTimeout: 20s` desconecta sockets ociosos; metric `dermaos_socket_connections` monitorada      |
| Worker travado consumindo CPU                           | Health check + auto-restart; DLQ + manual review                                                   |
| Query custosa sem LIMIT                                 | Pagination obrigatória em listagens; query timeout em PG (`statement_timeout`)                     |
| Slowloris / connection exhaustion                       | Reverse proxy (Nginx) com limites; Fastify `connectionTimeout`                                     |

**Não mitigado em v1:** DDoS volumétrico exige WAF/CDN (Cloudflare/Front Door)
em frente ao reverse proxy. Documentar como prereq operacional.

### E — Elevation of Privilege

| Ameaça                                                  | Mitigação                                                                                          |
|---------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| Recepcionista lê prontuário                             | RBAC middleware: `requireRoles('dermatologist','nurse')` em encounters                            |
| Funcionário promove a si mesmo a admin                  | `auth.register` requer role admin/owner para criar usuário; `password_version` invalida sessões antigas em changePassword |
| Acesso a audit log por role não autorizada              | `audit.audit_log` exige role `admin` ou `owner`                                                    |
| Comando perigoso em endpoint de teste deixa exposto     | Rotas de teste só registradas em `NODE_ENV !== 'production'`                                       |
| Migrations destrutivas em produção                      | `seed.sh` e `seed-rich.ts` bloqueiam `NODE_ENV=production` sem `--force-production`                |

---

## Criptografia de dados

Resumo de [ADR-002](ADR/002-encryption-strategy.md):

- **Algoritmo:** AES-256-GCM (autenticado).
- **Versionamento:** prefixo `v{N}:` no ciphertext permite rotação online.
- **Por tenant:** HKDF-SHA256(masterKey, info=clinic_id) — chave derivada
  determinística por clínica.
- **AAD obrigatória:** clinic_id em UTF-8.
- **Hash determinístico para lookup:** HMAC-SHA256(value, TENANT_HMAC_SECRET).

### Gestão de chaves

| Chave                  | Onde fica em produção           | Rotação                              |
|------------------------|---------------------------------|--------------------------------------|
| `MASTER_ENCRYPTION_KEY`| Vault / Azure Key Vault         | Anual ou pós-incidente               |
| `MASTER_KEY_V1`, `V2`...| Vault (cada versão preservada) | Versão antiga removida 1 ano após não-uso |
| `JWT_SECRET`           | Vault                           | Trimestral; invalidação por bump em `password_version` |
| `TENANT_HMAC_SECRET`   | Vault                           | Cuidadoso — re-hash de todos cpf_hash/email_hash |

NUNCA armazenar essas chaves em:

- `.env` commitado no repositório
- Logs (qualquer linha)
- Bug reports / Slack / Email
- Screenshots de ambiente

### Rotação operacional do `MASTER_ENCRYPTION_KEY`

1. Gerar nova chave: `openssl rand -hex 32`.
2. Adicionar ao Vault como `MASTER_KEY_V<N>` (preservando V<N-1>).
3. Atualizar `MASTER_ENCRYPTION_KEY` para a nova versão e
   `MASTER_KEY_VERSION=<N>`.
4. Restart rolling de api + worker.
5. Reads de ciphertext antigo continuam funcionando (decrypt usa
   `MASTER_KEY_V<N-1>`).
6. Writes começam a usar `v<N>:`.
7. `reEncryptIfStale` faz re-write opportunistic em reads ao longo dos
   meses seguintes.
8. Após N meses (configurável) e métrica de "% ciphertext em v<N>"
   estabilizar em > 99%, remover `MASTER_KEY_V<N-1>` do Vault.

---

## LGPD compliance

DermaOS implementa os direitos do titular previstos na LGPD (art. 18):

| Direito                                | Implementação                                                              |
|----------------------------------------|----------------------------------------------------------------------------|
| Confirmação da existência de tratamento| Endpoint portal + `/api/portal/me`                                         |
| Acesso aos dados                       | `lgpd.requestExport` gera ZIP com dados em JSON + PDFs (prescrições/exames)|
| Correção de dados                      | `patients.update` no portal e na clínica (com audit)                       |
| Anonimização / eliminação              | `lgpd.anonymizePatient` — soft delete + nulificação de PII (mantém trilha) |
| Portabilidade                          | Mesmo export contém formato estruturado processável                        |
| Revogação de consentimento             | `lgpd.consents` rastreia consentimentos com versão de TCLE                 |

### Bases legais (art. 7º LGPD)

- **Tratamento de saúde** (art. 11 II §a): atendimento clínico e preventivo.
- **Cumprimento de obrigação legal** (art. 7º II): retenção mínima
  prontuário (CFM 1638/2002 — 20 anos).
- **Execução de contrato** (art. 7º V): pagamento, agendamento.
- **Consentimento** (art. 7º I): marketing e comunicações não-clínicas.

Anonimização "de fato" (art. 5º XI) é registrada com hash do timestamp e
auditada — permite cumprir art. 18 sem perder histórico financeiro
(reqd. fiscal).

### Contato do DPO

Encarregado de Proteção de Dados (DPO):

```
Nome:     [PREENCHER ANTES DO GO-LIVE]
Email:    dpo@dermaos.com.br
Telefone: [PREENCHER ANTES DO GO-LIVE]
Endereço: [PREENCHER ANTES DO GO-LIVE]
```

Publicação obrigatória em `/legal/lgpd` no site público.

---

## Incident Response

### Reportando um incidente

**Internamente:** abrir ticket em `Linear > Security > P0` ou
notificar imediatamente:

```
Security Lead:    [PREENCHER ANTES DO GO-LIVE — nome + telefone + Slack]
DPO:              [PREENCHER ANTES DO GO-LIVE]
Tech Lead:        [PREENCHER ANTES DO GO-LIVE]
On-call (24/7):   [PREENCHER ANTES DO GO-LIVE]
```

**Externamente** (paciente / pesquisador):

- Email: `security@dermaos.com.br` (PGP key: ver `/legal/security`).
- Tempo de resposta: 24h em dias úteis.

### Passos iniciais de IR

```
1. ISOLAR — desabilitar credenciais comprometidas, revogar tokens
   (UPDATE shared.users SET locked_until = NOW() + INTERVAL '999 years';
    DELETE FROM shared.sessions WHERE user_id = '<id>';
    UPDATE shared.users SET password_version = password_version + 1;)

2. PRESERVAR — snapshot do banco, preservar logs, audit_log, security_events
   pg_dump --format=custom dermaos > /var/incidents/<id>/snapshot.dump
   docker logs <api> > /var/incidents/<id>/api.log

3. AVALIAR ESCOPO — quantos titulares afetados, que tipo de dado,
   janela de exposição

4. NOTIFICAR — DPO + tech lead + (se aplicável) ANPD em até 72h após
   conhecimento do incidente (LGPD art. 48)

5. MITIGAR / REMEDIAR — patch, rotação de segredos, comunicação aos
   titulares quando exigido

6. POST-MORTEM — registrar em docs/incidents/YYYY-MM-DD-<slug>.md
   * O que aconteceu
   * Como foi descoberto
   * Janela de exposição
   * Quantos titulares afetados
   * Ação imediata
   * Causa raiz
   * Prevenção (testes, monitoramento, mudança de processo)
```

### Obrigações de notificação ANPD (art. 48 LGPD)

> O controlador deverá comunicar à autoridade nacional e ao titular a
> ocorrência de incidente de segurança que possa acarretar risco ou
> dano relevante aos titulares.

**Prazo:** até 72h após ciência do incidente. Comunicação pelo formulário
da ANPD em `https://www.gov.br/anpd`.

**Conteúdo mínimo:** descrição da natureza dos dados afetados, número de
titulares, medidas técnicas e de segurança utilizadas, riscos
relacionados, motivos da demora se > 72h, medidas adotadas para reverter
ou mitigar.

---

## Vulnerability Disclosure

DermaOS aceita reports de vulnerabilidades via responsible disclosure:

```
Email:    security@dermaos.com.br
PGP key:  https://dermaos.com.br/.well-known/security.pgp
```

### O que esperamos

- Reproduzir em ambiente isolado (não em produção).
- Não acessar dados de pacientes além do necessário para provar a
  vulnerabilidade.
- Aguardar 90 dias antes de divulgação pública (ou 30 dias se for
  crítica e patch já estiver disponível).

### Escopo

In-scope:
- `*.dermaos.com.br`
- Repositório DermaOS (qualquer apps/*)
- Apps mobile do portal (quando lançados)

Out-of-scope:
- Engenharia social contra funcionários
- DoS volumétrico
- Self-XSS
- Falta de header de segurança em endpoint não-sensível (avaliado caso a caso)

### O que oferecemos

- Reconhecimento público (com permissão) em `/legal/hall-of-fame`.
- Bounty para vulnerabilidades P0/P1 (programa em formulação).
- Comunicação transparente sobre status do fix.

---

## Atualizando este documento

Mantido por Security Lead + DPO. Atualizar:

- A cada incidente (preenchendo lições aprendidas).
- A cada novo controle implementado (MFA, SIEM, etc.).
- A cada mudança regulatória relevante (LGPD, ANVISA, CFM).
- Anualmente como parte da auditoria interna.

**ANTES DO GO-LIVE:** preencher todos os contatos `[PREENCHER]` com
nomes, emails e telefones reais. Documento sem esses contatos = clínica
não está pronta para receber dados de pacientes em produção.
