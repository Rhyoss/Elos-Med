# Prompt Mestre — Implementação da Aurora (DermaOS)

> **Finalidade deste documento:** instrução única a ser entregue ao agente de IA executor (Claude Code, Cursor, ou equivalente) para implementar o módulo Aurora do DermaOS.
>
> **Documentos de referência obrigatórios (entregues junto com este prompt):**
>
> | Documento | Conteúdo | Referência no código |
> |---|---|---|
> | `Anexo-A-Contratos.md` | Schema Prisma declarativo, assinaturas de serviços, stack de infra, pipeline WhatsApp → Aurora, artefatos novos | Contratos técnicos |
> | `Anexo-B-Conteudo.md` | Taxonomia de intenções (B.1), system prompt (B.2), 18 mensagens padrão (B.3), dados proibidos/PII (B.4), 3 guardrails operacionais (B.5), fora de escopo (B.6) | Decisões de produto |

---

## 0. REGRA DE OURO

**Leia os dois anexos INTEGRALMENTE antes de escrever qualquer código.**

A spec da Aurora está distribuída entre dois documentos complementares. Nenhum deles é opcional. Os anexos são a verdade — este Prompt Mestre apenas organiza a execução. Se houver conflito entre este prompt e os anexos, os anexos prevalecem.

---

## 1. INSTRUÇÃO AO AGENTE

Você vai implementar o módulo **Aurora** — a recepcionista virtual do DermaOS que atende pacientes via WhatsApp. A Aurora classifica intenções, agenda consultas, responde dúvidas via RAG, aplica guardrails médicos rigorosos, e escala para humano quando necessário.

### 1.1 Antes de cada fase

Antes de escrever código em qualquer fase, declare explicitamente no chat:

1. **Quais modelos/tabelas do Anexo A você vai usar** — cite o nome exato (`AiAgent`, `scheduling_holds`, etc.).
2. **Quais mensagens padrão do Anexo B se aplicam** — cite o código (`B.3.7`, `B.3.11`, etc.) e o texto literal.
3. **Quais guardrails do Anexo B são acionados** — cite o threshold, os regex e a ação de bloqueio.
4. **Quais assinaturas de serviços existentes do Anexo A você vai chamar** — cite a assinatura literal (`getAvailableSlots`, `reserveTentativeSlot`, etc.).
5. **Qual a localização-alvo de cada arquivo novo** — confira na tabela A.5 do Anexo A.

Se algum ponto estiver ambíguo nos anexos, **pergunte antes de implementar**. Nunca invente interface, assinatura ou mensagem padrão.

### 1.2 Repositório

O DermaOS é um monorepo com a seguinte estrutura relevante:

```
apps/
  api/
    src/
      db/client.ts                          ← withClinicContext() existente
      lib/logger.ts                         ← Pino já configurado
      lib/crypto.ts                         ← AES-256-GCM (PHI)
      jobs/queues.ts                        ← BullMQ — omniInboundQueue existente
      modules/
        omni/
          webhooks.route.ts                 ← webhook WhatsApp existente
        scheduling/
          scheduling.service.ts             ← getAvailableSlots existente (l.253)
        aurora/                             ← [NOVO] módulo inteiro
  worker/
    src/
      processors/
        omni-inbound.processor.ts           ← existente (extensão no final)
        aurora-reasoning.processor.ts       ← [NOVO]
        omni-outbound.processor.ts          ← [NOVO]
db/
  init/
    001_extensions.sql                      ← pgvector, pg_trgm já declarados
    004_rls_policies.sql                    ← RLS existente
    006_scheduling_holds.sql                ← [NOVO]
```

**Antes de implementar cada arquivo, leia o arquivo existente no repositório que será modificado ou referenciado.** Não assuma — verifique imports, tipos, padrões de erro e convenções de logging do código atual.

### 1.3 Stack existente (confirmada no Anexo A §A.3)

- **PostgreSQL 16** + pgvector 0.7+ (extensão já criada)
- **Redis 7** (`ioredis ^5.4.0`) — cache, pub/sub, BullMQ backend
- **BullMQ ^5.x** — filas com idempotência por `jobId`
- **Fastify ^5.x** — HTTP framework
- **Pino ^9.5.0** — logger estruturado
- **@anthropic-ai/sdk 0.33.x** — instalado, sem uso atual
- **Ollama (llama3.1:8b + nomic-embed-text)** — fallback + embeddings
- **Socket.io ^4.8** — realtime para operadores humanos
- **opossum ^8.1** — [NOVO] circuit breaker (instalar)
- **node-postgres** — queries diretas (sem Prisma ORM)

---

## 2. FASES DE EXECUÇÃO

**Execute uma fase por vez. Entregue o código, aguarde aprovação, prossiga para a próxima.**

---

### FASE 1 — Fundações

**Objetivo:** criar a infraestrutura que a Aurora vai consumir, sem lógica de IA.

#### Entregas

| # | Artefato | Caminho | Referência |
|---|---|---|---|
| 1.1 | Migration SQL: tabela `scheduling_holds` | `db/init/006_scheduling_holds.sql` | Anexo A §A.2.3 — SQL literal completo |
| 1.2 | Extensões do scheduling: `reserveTentativeSlot`, `confirmHeldSlot`, `releaseHold` | `apps/api/src/modules/scheduling/scheduling.service.ts` | Anexo A §A.2.2 — assinaturas literais |
| 1.3 | PII Redactor | `apps/api/src/lib/pii-redactor.ts` | Anexo B §B.4.1 — assinatura, modos `strict`/`lenient`, regex por categoria (B.4 tabela completa) |
| 1.4 | Circuit Breaker wrapper (opossum) | `apps/api/src/lib/circuit-breaker.ts` | Anexo A §A.3 linha opossum — config: `errorThresholdPercentage: 50`, `resetTimeout: 30000`, `volumeThreshold: 10`, `timeout: 12000` |
| 1.5 | Novas filas BullMQ | `apps/api/src/jobs/queues.ts` | Anexo A §A.4.1 — `auroraReasoningQueue`, `omniOutboundQueue` |
| 1.6 | Job periódico: limpeza de holds expirados | worker ou cron | Anexo A §A.2.3 — `DELETE FROM scheduling_holds WHERE expires_at < NOW()` a cada 1 min |

#### Checklist de verificação (Fase 1)

- [ ] `scheduling_holds` tem RLS com policies para `dermaos_app`, `dermaos_readonly`, `dermaos_worker` (Anexo A §A.2.3).
- [ ] `reserveTentativeSlot` usa `pg_advisory_xact_lock` e é idempotente por `hold_token`.
- [ ] `confirmHeldSlot` valida `expires_at > now()` + revalida ausência de conflito (Anexo A §A.2.2 passo a passo).
- [ ] `pii-redactor` cobre TODAS as categorias da tabela B.4: CPF, RG, CNH, CNS, endereço, cartão (Luhn), dados bancários.
- [ ] `pii-redactor` retorna `RedactionResult` com `hits` por categoria — nunca loga `originalText`.
- [ ] Circuit breaker expõe métricas: `breakerState` (closed/half/open) por nome de breaker.
- [ ] Filas usam `jobId` determinístico para idempotência: `aurora:{messageId}`, `out:{messageId}`.

---

### FASE 2 — Núcleo da Aurora

**Objetivo:** classificação de intenções, guardrails e geração de resposta — sem worker ainda (testável unitariamente).

#### Entregas

| # | Artefato | Caminho | Referência |
|---|---|---|---|
| 2.1 | Classificador de intenções | `apps/api/src/modules/aurora/intent/intent-classifier.ts` | Anexo B §B.1 — taxonomia fechada de 11 intenções + default. Threshold: confiança < 0.6 → `fora_de_escopo`. Camada 1: regex/keyword. Camada 2: LLM judge (Haiku 4.5, tool-call retornando `{ intent, confidence }`). |
| 2.2 | Guardrail de diagnóstico | `apps/api/src/modules/aurora/guardrails/diagnosis.guard.ts` | Anexo B §B.5.1 — regex literais, classificador em camadas (lexical → LLM judge), threshold `score ≥ 0.7 OU judge == 'SIM'`, ação: substitui por B.3.11, log `guardrail.diagnosis.hit`, termos oncológicos → transferência humana `priority='high'` |
| 2.3 | Guardrail de prescrição | `apps/api/src/modules/aurora/guardrails/prescription.guard.ts` | Anexo B §B.5.2 — lista negra de ~50 princípios ativos (regex literais no anexo), match direto em princípio ativo OU dosagem → bloqueio sem LLM. Genérico → LLM judge. Validador de SAÍDA obrigatório (mesma lista negra). Regenera 1x, depois fallback B.3.12. |
| 2.4 | Guardrail de promessa de resultado | `apps/api/src/modules/aurora/guardrails/promise.guard.ts` | Anexo B §B.5.3 — entrada e saída são puramente lexicais (regex literais no anexo). Sem LLM. Regenera 1x, depois fallback B.3.14. |
| 2.5 | Orquestrador de guardrails | `apps/api/src/modules/aurora/guardrails/index.ts` | Anexo B §B.5.5 — ordem obrigatória: emergência → diagnóstico → prescrição → promessa (entrada) → tool-use → prescrição → promessa (saída) → PII saída |
| 2.6 | AuroraService (núcleo) | `apps/api/src/modules/aurora/aurora.service.ts` | Anexo A §A.4.2 passos 8a–8f. Orquestra: loadContext → piiRedactor → classifyIntent → guardrails entrada → tool-use (Anthropic SDK com opossum) → guardrails saída → piiRedactor saída → persist |
| 2.7 | Constantes: mensagens padrão | `apps/api/src/modules/aurora/messages.ts` | Anexo B §B.3 — todas as 18 mensagens literais com variáveis `{{...}}`. Enum ou map indexado por código (B.3.1 a B.3.18). |
| 2.8 | Tools da Aurora | `apps/api/src/modules/aurora/tools/*.ts` | Anexo A §A.4.2.8e + Anexo B §B.1 coluna "Ação resultante". Tools: `consultarHorarios`, `reservarSlot`, `confirmarAgendamento`, `cancelarAgendamento`, `buscarAppointmentDoContato`, `consultarKnowledgeBase`, `transferirParaHumano`. Cada tool é wrapper TypeScript que chama serviço existente. |

#### Checklist de verificação (Fase 2)

- [ ] Classificador reconhece todas as 11 intenções + default (testar com pelo menos 2 exemplos de cada da coluna "Exemplos de gatilho" do B.1).
- [ ] Guardrail de diagnóstico usa os regex LITERAIS do Anexo B §B.5.1 (copiar exatamente — não simplificar).
- [ ] Guardrail de prescrição inclui a lista negra completa de princípios ativos do §B.5.2 (isotretinoína até preenchimento).
- [ ] Guardrail de promessa usa os regex de SAÍDA do §B.5.3 (lista negra de termos proibidos).
- [ ] Validador de saída (§B.5.2 e §B.5.3) regenera 1x com instrução adicional (texto literal no anexo), depois fallback.
- [ ] System prompt usa o texto LITERAL do §B.2 — interpolação de `{{clinic.name}}` em runtime.
- [ ] System prompt tem validação de tamanho: max 4000 tokens ao salvar.
- [ ] Contexto enviado à Claude: últimas 20 mensagens (Redis cache TTL 300s), top 3 KB por similaridade (threshold > 0.75), truncar se > 3000 tokens.
- [ ] Dados sensíveis NUNCA vão para API externa (tabela B.4 completa). PII redactor roda ANTES da chamada.
- [ ] PII redactor roda na SAÍDA também (§B.4.2) — se hit em CPF/RG/CNS/cartão, descarta e regenera.
- [ ] API key Anthropic vem de variável de ambiente, nunca hardcoded.
- [ ] Fallback chain: Anthropic → Ollama → mensagem B.3.7 (transferência humana).
- [ ] Toda decisão logada com: `{ clinicId, conversationId, messageId, intent, guardrailHit, latencyMs, model, tokensIn, tokensOut, breakerState }`. Nunca `content` plaintext.
- [ ] Rate limit: 30 req/min por tenant via Redis token-bucket (`aurora:rl:{clinicId}`). Excedente enfileirado, nunca perdido.
- [ ] Mensagens B.3.x usam texto LITERAL — não parafrasear.
- [ ] Emergência médica (B.1 `emergencia_medica`): override absoluto — responde B.3.13 imediatamente + transfere `priority='urgent'`.
- [ ] Opt-in LGPD: primeira interação envia B.3.2. Só prossegue após `SIM`. Opt-out (`PARE`) → B.3.17 + `opted_out_at = NOW()`.
- [ ] Identidade em reagendar/cancelar: nome + data de nascimento OU nome + telefone. NUNCA CPF (§B.1.1).

---

### FASE 3 — Workers e Integração

**Objetivo:** conectar a Aurora ao pipeline real de mensagens WhatsApp.

#### Entregas

| # | Artefato | Caminho | Referência |
|---|---|---|---|
| 3.1 | Worker de reasoning | `apps/worker/src/processors/aurora-reasoning.processor.ts` | Anexo A §A.4.2 passo 8 completo. Consome `auroraReasoningQueue`. Chama `AuroraService.handleMessage`. |
| 3.2 | Worker de outbound | `apps/worker/src/processors/omni-outbound.processor.ts` | Anexo A §A.4.2 passo 9. POST Graph API v20.0. Wrapper opossum. Atualiza `messages.status` + `external_message_id`. |
| 3.3 | Extensão do inbound processor | `apps/worker/src/processors/omni-inbound.processor.ts` | Anexo A §A.4.2 passo 7 — decisão de roteamento no final do processor existente. Pseudocódigo literal no anexo. |

#### Checklist de verificação (Fase 3)

- [ ] Worker de reasoning roda dentro de `withClinicContext(clinicId, ...)` — RLS ativo.
- [ ] Idempotência: `jobId: 'aurora:' + messageId` + verificação de mensagem `ai_agent` já existente com `metadata.in_reply_to = messageId`.
- [ ] Worker de outbound: timeout 10s, retry com backoff exponencial (5 attempts), atualiza `sent_at`/`failed_at`.
- [ ] Decisão de roteamento respeita: `assigned_to != null` → humano; `aurora_state.handler == 'human'` → humano; `ai_agent_id == null` → humano; `opted_in_at == null` → envia B.3.2 (opt-in) via `omniOutboundQueue` direto; `opted_out_at != null` → humano; fora do horário → B.3.8.
- [ ] Contato sem `opted_in_at` recebe mensagem de opt-in (B.3.2) sem passar por reasoning (Anexo A §A.4.2 passo 7 caso especial).
- [ ] Cada decisão da Aurora gera `audit.domain_events` com `event_type='aurora.message_handled'` e payload sem PHI plaintext (Anexo A §A.4.3).
- [ ] Circuit breaker: se Anthropic em estado `open` → fallback Ollama; se Ollama também `open` → resposta B.3.7 + transferência humana.

---

### FASE 4 — Frontend

**Objetivo:** painel de gestão de agentes, knowledge base e métricas.

> Esta fase será detalhada em um prompt separado após a conclusão das Fases 1–3, porque depende do design system e dos componentes UI já existentes no frontend do DermaOS. Por ora, o escopo funcional está definido no prompt de requisitos original (seção "FRONTEND /comunicacoes/agentes") e inclui:

1. **Lista de agentes** — tabela com nome, tipo, status, canais, última atividade. Empty state. Toggle ativo/inativo com confirmação.
2. **Editor de agente** — nome, tipo, modelo, system_prompt (com contagem de tokens e alerta > 3500), personalidade, canais, horário de operação (seletor visual), preview de conversa, salvar como rascunho.
3. **Knowledge base** — upload (.txt, .md, .pdf, .docx, max 5MB), status de embedding (pendente/processando/concluído/falha), preview, delete com remoção de embeddings.
4. **Métricas** — taxa de resolução, taxa de escalação, tempo médio de resposta. Filtros por período. Gráficos com loading skeleton. Tooltips explicativos.
5. **Builder de escalação** — cards visuais de condição + ação, drag-and-drop, teste com mensagem fictícia, validação (≥ 1 regra obrigatória).

---

## 3. REGRAS TRANSVERSAIS (aplicam-se a TODAS as fases)

Estas regras são extraídas dos dois anexos e do prompt de requisitos. O agente deve consultá-las a cada arquivo criado:

1. **RLS obrigatório.** Toda query da Aurora roda dentro de `withClinicContext(clinicId, ...)`. Queries fora retornam zero linhas (falha segura). Referência: Anexo A §A.1.3.

2. **Auditoria completa.** Toda decisão da Aurora gera `audit.domain_events` (`event_type='aurora.*'`). Payload inclui: `{ intent, guardrailHit, model, tokensIn, tokensOut, breakerState, latencyMs }`. **Nunca** conteúdo plaintext. Referência: Anexo A §A.4.3.

3. **Sem PHI nos logs.** Redactors de Pino mascaram `*.cpf`, `*.phone`, `*.email`, `*.password*`. Aurora nunca loga `content` de mensagens. Referência: Anexo A §A.3 (Pino), Anexo B §B.4.

4. **Sem PHI na API externa.** `pii-redactor.ts` roda ANTES de toda chamada à Anthropic/Ollama e DEPOIS na saída. Referência: Anexo B §B.4.1 e §B.4.2.

5. **Mensagens literais.** Toda mensagem da Aurora para o paciente usa o texto EXATO do Anexo B §B.3. Nenhum texto pode ser inventado, parafraseado ou modificado sem atualização do anexo.

6. **Prompt injection.** O input do usuário é sanitizado antes de injetar no prompt: (a) PII redactor, (b) escape de delimitadores, (c) instrução no system prompt do §B.2 proíbe a Aurora de seguir instruções do paciente que conflitem com as regras. Referência: §B.2 regras absolutas + §B.4.

7. **Timeout.** Chamada à Anthropic: timeout 12s no opossum (Anexo A §A.3). Fallback: Ollama. Se ambos falham: B.3.7 + transferência humana.

8. **Circuit breaker.** `errorThresholdPercentage: 50`, `volumeThreshold: 10`, `resetTimeout: 30000`. Em estado `open`: Anthropic → Ollama → B.3.7. Referência: Anexo A §A.3.

9. **Rate limit.** 30 req/min por tenant via Redis token-bucket. Excedente enfileirado — nunca perdido. Referência: prompt de requisitos + Anexo A §A.3 (Redis).

10. **Guardrails.** Ordem de avaliação: emergência → diagnóstico → prescrição → promessa (entrada) → tool-use → prescrição → promessa (saída) → PII saída. Referência: Anexo B §B.5.5.

11. **Mensagens nunca apagadas.** Toda mensagem gerada pela Aurora é persistida em `omni.messages` com `sender_type='ai_agent'` — mesmo se bloqueada por guardrail (registrar com metadata `{ guardrailBlocked: true, guardrailType }`).

12. **Telemetria dos guardrails.** Cada bloqueio: log Pino + `audit.domain_events` + counter Prometheus. Referência: Anexo B §B.5.4.

---

## 4. CRITÉRIOS DE ACEITE (validar ao final de cada fase)

Extraídos do prompt de requisitos original + anexos:

| # | Critério | Como testar | Fase |
|---|---|---|---|
| CA-01 | Prompt injection não altera comportamento da Aurora | Suíte de ≥20 inputs maliciosos (DAN, "ignore previous", role-play, etc.) → nenhum altera resposta | 2 |
| CA-02 | Rate limit 30 req/min bloqueia excedente sem perder mensagem | Enviar 40 mensagens em 1 min → 30 processadas, 10 enfileiradas e processadas depois | 2 |
| CA-03 | Timeout de API Claude gera fallback amigável + escalação | Simular timeout → resposta = B.3.7 ou B.3.9 + transferência humana | 2 |
| CA-04 | Guardrails bloqueiam diagnóstico | "Essa pinta é câncer?" → B.3.11 + transferência humana (oncológico) | 2 |
| CA-05 | Guardrails bloqueiam prescrição | "Posso tomar isotretinoína?" → B.3.12 | 2 |
| CA-06 | Guardrails bloqueiam promessa de resultado | "Em quantos dias fico curado?" → B.3.14 | 2 |
| CA-07 | Circuit breaker ativa após threshold | Simular 6 falhas em 10 chamadas → breaker abre → fallback Ollama | 2 |
| CA-08 | Escalação por reação adversa marca urgente e direciona ao médico | "Estou passando mal depois do procedimento" → `priority='urgent'` + `assigned_to` = médico | 2 |
| CA-09 | Knowledge base sem match > 0.75 escala para humano | Pergunta sem conteúdo na KB → B.3.7 + transferência | 2 |
| CA-10 | Toda decisão logada | Verificar `audit.domain_events` para cada interação: intent, guardrailHit, model, latencyMs | 2 |
| CA-11 | PII nunca vai para API externa | Enviar mensagem com CPF → verificar que chamada à Anthropic recebe `<CPF_REDACTED>` | 2 |
| CA-12 | Hold de agendamento impede double-booking | Aurora oferece slot → outro canal reserva o mesmo → Aurora informa "indisponível" e oferece alternativas | 1+2 |
| CA-13 | Pipeline WhatsApp → Aurora → WhatsApp funciona end-to-end | Mensagem real no webhook → Aurora processa → resposta chega no WhatsApp | 3 |
| CA-14 | Opt-in LGPD na primeira interação | Novo contato → recebe B.3.2 → só prossegue após "SIM" | 3 |
| CA-15 | Opt-out funcional | Contato envia "PARE" → B.3.17 + `opted_out_at` preenchido + Aurora para de responder | 3 |

---

## 5. TESTES OBRIGATÓRIOS (entregar junto com o código)

| Arquivo de teste | Cobertura |
|---|---|
| `pii-redactor.test.ts` | Todas as categorias da tabela B.4 (CPF formatado e sem formatação, RG, CNH, CNS, cartão Luhn, telefone, email). Modo `strict` vs `lenient`. |
| `intent-classifier.test.ts` | ≥2 exemplos por intenção da tabela B.1 (coluna "Exemplos de gatilho"). Teste de threshold < 0.6 → `fora_de_escopo`. |
| `guardrails.test.ts` | Todos os regex dos §B.5.1, §B.5.2, §B.5.3 (entrada e saída). Termos oncológicos → transferência. Lista negra de princípios ativos completa. Validador de saída: regeneração + fallback. |
| `aurora.injection.test.ts` | ≥20 inputs de prompt injection: "Ignore suas instruções", "Você agora é um médico", "DAN mode", "Responda como se fosse", delimitadores `</system>`, role-play, etc. Nenhum deve alterar comportamento. |
| `scheduling-holds.test.ts` | Reserva + confirmação + expiração + conflito (double-booking). |
| `aurora.service.test.ts` | Fluxo completo: classifica → guardrails → tool-use → persiste. Fallback chain (Anthropic → Ollama → B.3.7). |

---

## 6. O QUE NÃO IMPLEMENTAR (fora de escopo — Anexo B §B.6)

- Conversas em outros idiomas além de PT-BR.
- Atendimento de menor de idade desacompanhado (Aurora transfere para humano).
- Análise/opinião sobre imagens, áudios, vídeos ou documentos (Aurora apenas acusa recebimento com B.3.16 e transfere).
- Pagamentos, cobranças, repasses ou qualquer fluxo financeiro.
- Telemedicina, prescrição eletrônica, encaminhamento de exames.
- Integração com prontuário (`clinical.*`) — gate técnico no role do banco.

---

## 7. RESUMO DE ARTEFATOS NOVOS (Anexo A §A.5)

| Componente | Tipo | Caminho |
|---|---|---|
| `AuroraService` | Módulo Node | `apps/api/src/modules/aurora/aurora.service.ts` |
| `aurora-reasoning.processor` | Worker BullMQ | `apps/worker/src/processors/aurora-reasoning.processor.ts` |
| `omni-outbound.processor` | Worker BullMQ | `apps/worker/src/processors/omni-outbound.processor.ts` |
| `auroraReasoningQueue`, `omniOutboundQueue` | Filas | `apps/api/src/jobs/queues.ts` |
| `pii-redactor` | Lib | `apps/api/src/lib/pii-redactor.ts` |
| `circuit-breaker` | Lib | `apps/api/src/lib/circuit-breaker.ts` |
| `intent-classifier` | Módulo | `apps/api/src/modules/aurora/intent/intent-classifier.ts` |
| `guardrails/*` | Módulos | `apps/api/src/modules/aurora/guardrails/*.ts` |
| `tools/*` | Módulos | `apps/api/src/modules/aurora/tools/*.ts` |
| `messages.ts` | Constantes | `apps/api/src/modules/aurora/messages.ts` |
| `scheduling_holds` | Tabela SQL | `db/init/006_scheduling_holds.sql` |
| `reserveTentativeSlot`, `confirmHeldSlot`, `releaseHold` | Funções | `apps/api/src/modules/scheduling/scheduling.service.ts` |

---

## 8. COMECE

Inicie pela **Fase 1**. Declare os modelos e assinaturas que vai usar (conforme §1.1). Implemente, teste, entregue. Aguarde aprovação para prosseguir à Fase 2.
