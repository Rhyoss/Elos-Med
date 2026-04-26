# Anexo A — Contratos e Pré-requisitos

> Spec da **Aurora** (recepcionista virtual do DermaOS via WhatsApp).
> Este anexo declara contratos técnicos. Decisões de produto, mensagens, intenções e guardrails estão em [Anexo-B-Conteudo.md](./Anexo-B-Conteudo.md).
>
> **Convenções:** componentes que **já existem** no código não recebem marca; componentes a adicionar são marcados **[NOVO]**. Toda referência cita arquivo:linha do estado atual do repositório.

---

## A.0 Premissa de design (nota de paridade)

O DermaOS hoje **não usa Prisma ORM**. O stack persistente é `node-postgres` puro com migrações em [`db/init/*.sql`](../../db/init/). Este anexo declara um `schema.prisma` **somente como contrato de tipos** — uma descrição normativa dos modelos de domínio, suas colunas e suas relações. **Não** será introduzido `prisma migrate`; o source of truth do schema continua sendo SQL.

Discrepâncias toleradas e como representá-las em Prisma:

| Aspecto SQL real | Representação Prisma | Nota |
|---|---|---|
| Campos cifrados AES-256-GCM (`name`, `cpf_encrypted`, `phone_encrypted`, `email_encrypted`) armazenados como `TEXT` (formato `iv:authTag:ciphertext` base64url) | `String` + comentário JSDoc `/// @phi(aes256gcm)` | Cifragem é responsabilidade de [`lib/crypto.ts`](../../apps/api/src/lib/crypto.ts). Prisma nunca decifra. |
| `name_search` populado por trigger (lowercase + sem acentos, `pg_trgm`) | `String? /// @search(trgm)` | Trigger continua em SQL, fora do escopo do Prisma. |
| `embedding VECTOR(1536)` (pgvector) | `Unsupported("vector(1536)")?` | Acessado exclusivamente via `$queryRaw` com operador `<=>` (cosine). Índice ivfflat criado em SQL. |
| RLS via `shared.current_clinic_id()` lendo `app.current_clinic_id` | `/// @rls(clinic_id)` no JSDoc + extensão Prisma `withClinicContext` | Comentário é **normativo**, não executável (ver A.1.3). |
| `audit.domain_events` com UPDATE/DELETE bloqueados por RULE | `@@ignore` + `/// @append-only` | Não modelado como entidade operável. Inserções via SQL/serviço dedicado. |
| Enums Postgres (`shared.user_role`, `omni.channel_type`, etc.) | `enum` Prisma com mesmo nome em PascalCase | Mapeamento 1:1; mantém ordem dos valores. |

Caso o time decida adotar Prisma de fato no futuro, a paridade já está descrita aqui — basta gerar `prisma/schema.prisma` a partir desta seção e introspectar para validar. Enquanto isso, este documento serve como **contrato declarativo de tipos** consumido pela Aurora e por outros agentes.

---

## A.1 Schema Prisma declarativo dos modelos citados

### A.1.1 Datasource e generator

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema", "postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  schemas    = ["shared", "omni", "clinical", "audit"]
  extensions = [pgcrypto, pg_trgm, vector, uuid_ossp(map: "uuid-ossp")]
}
```

### A.1.2 Modelos

```prisma
// ─────────────────────────────────────────────────────────────
// Schema "shared" — tenant raiz, usuários, pacientes, agendas
// ─────────────────────────────────────────────────────────────

/// @rls(clinic_id) @schema(shared)
/// Tenant raiz. Todos os modelos referenciam clinicId.
model Clinic {
  id              String       @id @default(uuid()) @db.Uuid
  slug            String       @unique
  name            String
  cnpj            String?      @unique
  timezone        String       @default("America/Sao_Paulo")
  /// JSON: { mon: { open: "08:00", close: "18:00" }, ... }
  businessHours   Json         @default("{}") @map("business_hours")
  /// JSON: { ollama_model, features: ["aurora_whatsapp"], ... }
  aiConfig        Json         @default("{}") @map("ai_config")
  isActive        Boolean      @default(true) @map("is_active")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  users           User[]
  patients        Patient[]
  services        Service[]
  appointments    Appointment[]
  contacts        Contact[]
  channels        Channel[]
  aiAgents        AiAgent[]
  knowledgeBase   AiKnowledgeBase[]
  conversations   Conversation[]
  messages        Message[]

  @@map("clinics")
  @@schema("shared")
}

enum UserRole {
  owner
  admin
  dermatologist
  nurse
  receptionist
  financial
  readonly

  @@schema("shared")
  @@map("user_role")
}

/// @rls(clinic_id) @schema(shared)
model User {
  id              String   @id @default(uuid()) @db.Uuid
  clinicId        String   @map("clinic_id") @db.Uuid
  name            String
  email           String
  /// argon2id
  passwordHash    String   @map("password_hash")
  role            UserRole @default(readonly)
  /// Apenas para `dermatologist`
  crm             String?
  specialty       String?
  /// JSON: { working_hours: { mon: { start, end, breaks }, ... }, slot_size_min }
  scheduleConfig  Json     @default("{}") @map("schedule_config")
  isActive        Boolean  @default(true) @map("is_active")
  /// @phi(aes256gcm) — TOTP secret cifrado em camada de aplicação
  mfaSecret       String?  @map("mfa_secret")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  clinic          Clinic   @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  appointments    Appointment[]      @relation("ProviderAppointments")
  conversations   Conversation[]     @relation("AssignedConversations")

  @@unique([clinicId, email])
  @@index([clinicId, role])
  @@map("users")
  @@schema("shared")
}

enum PatientStatus {
  active
  inactive
  blocked
  deceased
  transferred

  @@schema("shared")
  @@map("patient_status")
}

/// @rls(clinic_id) @schema(shared) @phi
/// Dados PHI cifrados AES-256-GCM antes de persistência.
model Patient {
  id                       String        @id @default(uuid()) @db.Uuid
  clinicId                 String        @map("clinic_id") @db.Uuid
  /// @phi(aes256gcm) plaintext nunca trafega fora de processo
  name                     String
  /// @search(trgm) lowercase sem acentos — populado por trigger; NÃO é PHI direto
  nameSearch               String        @map("name_search")
  /// SHA-256 com pepper para lookup sem decifrar (ver lib/crypto.ts)
  cpfHash                  String?       @map("cpf_hash")
  /// @phi(aes256gcm)
  cpfEncrypted             String?       @map("cpf_encrypted")
  birthDate                DateTime?     @map("birth_date") @db.Date
  /// @phi(aes256gcm)
  emailEncrypted           String?       @map("email_encrypted")
  /// @phi(aes256gcm)
  phoneEncrypted           String?       @map("phone_encrypted")
  status                   PatientStatus @default(active)
  /// Soft-delete LGPD (art. 16/18) — não remover fisicamente
  deletedAt                DateTime?     @map("deleted_at")
  deletionReason           String?       @map("deletion_reason")
  createdAt                DateTime      @default(now()) @map("created_at")
  updatedAt                DateTime      @updatedAt @map("updated_at")

  clinic                   Clinic        @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  appointments             Appointment[]
  contacts                 Contact[]

  @@index([clinicId, cpfHash])
  @@index([clinicId, status])
  @@map("patients")
  @@schema("shared")
}

/// @rls(clinic_id) @schema(shared)
model Service {
  id            String   @id @default(uuid()) @db.Uuid
  clinicId      String   @map("clinic_id") @db.Uuid
  name          String
  description   String?
  category      String?
  durationMin   Int      @default(30) @map("duration_min")
  price         Decimal? @db.Decimal(10, 2)
  /// Gate Aurora: serviço só é ofertado em agendamento online se TRUE
  allowOnline   Boolean  @default(false) @map("allow_online")
  isActive      Boolean  @default(true) @map("is_active")

  clinic        Clinic   @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  appointments  Appointment[]

  @@unique([clinicId, name])
  @@map("services")
  @@schema("shared")
}

enum AppointmentStatus {
  scheduled
  confirmed
  waiting
  in_progress
  completed
  cancelled
  no_show
  rescheduled

  @@schema("shared")
  @@map("appointment_status")
}

enum AppointmentSource {
  manual
  online_booking
  whatsapp
  phone
  walk_in
  referral

  @@schema("shared")
  @@map("appointment_source")
}

/// @rls(clinic_id) @schema(shared)
model Appointment {
  id                  String              @id @default(uuid()) @db.Uuid
  clinicId            String              @map("clinic_id") @db.Uuid
  patientId           String              @map("patient_id") @db.Uuid
  providerId          String              @map("provider_id") @db.Uuid
  serviceId           String?             @map("service_id") @db.Uuid
  type                String              @default("consultation") @db.VarChar(100)
  scheduledAt         DateTime            @map("scheduled_at")
  durationMin         Int                 @default(30) @map("duration_min")
  status              AppointmentStatus   @default(scheduled)
  /// JSONB: [{ status, changed_at, changed_by, reason, via }]
  statusHistory       Json                @default("[]") @map("status_history")
  source              AppointmentSource   @default(manual)
  /// FK lógica para Conversation quando origem = whatsapp/phone/online_booking
  conversationId      String?             @map("conversation_id") @db.Uuid

  clinic              Clinic              @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  patient             Patient             @relation(fields: [patientId], references: [id], onDelete: Restrict)
  provider            User                @relation("ProviderAppointments", fields: [providerId], references: [id], onDelete: Restrict)
  service             Service?            @relation(fields: [serviceId], references: [id], onDelete: SetNull)

  @@index([clinicId, providerId, scheduledAt])
  @@index([clinicId, patientId])
  @@index([clinicId, scheduledAt])
  @@map("appointments")
  @@schema("shared")
}

// ─────────────────────────────────────────────────────────────
// Schema "omni" — contatos, canais, conversas, mensagens, IA
// ─────────────────────────────────────────────────────────────

enum ContactType {
  patient
  lead
  anonymous
  bot

  @@schema("omni")
  @@map("contact_type")
}

enum ChannelType {
  whatsapp
  instagram
  email
  sms
  webchat
  phone

  @@schema("omni")
  @@map("channel_type")
}

enum ConversationStatus {
  open
  pending
  resolved
  spam
  archived

  @@schema("omni")
  @@map("conversation_status")
}

enum ConversationPriority {
  low
  normal
  high
  urgent

  @@schema("omni")
  @@map("conversation_priority")
}

enum MessageSenderType {
  patient
  user
  ai_agent
  system

  @@schema("omni")
  @@map("message_sender_type")
}

enum MessageContentType {
  text
  image
  audio
  video
  document
  location
  template
  interactive

  @@schema("omni")
  @@map("message_content_type")
}

enum MessageStatus {
  pending
  sent
  delivered
  read
  failed

  @@schema("omni")
  @@map("message_status")
}

enum AiAgentType {
  receptionist
  scheduler
  follow_up
  support
  custom

  @@schema("omni")
  @@map("ai_agent_type")
}

/// @rls(clinic_id) @schema(omni)
model Contact {
  id              String        @id @default(uuid()) @db.Uuid
  clinicId        String        @map("clinic_id") @db.Uuid
  patientId       String?       @map("patient_id") @db.Uuid
  type            ContactType   @default(lead)
  name            String
  phone           String?
  email           String?
  /// JSONB: { whatsapp_id, instagram_id, telegram_id }
  externalIds     Json          @default("{}") @map("external_ids")
  /// LGPD art. 8 — consentimento explícito antes de qualquer fluxo da Aurora
  optedInAt       DateTime?     @map("opted_in_at")
  optedOutAt      DateTime?     @map("opted_out_at")

  clinic          Clinic        @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  patient         Patient?      @relation(fields: [patientId], references: [id], onDelete: SetNull)
  conversations   Conversation[]

  @@unique([clinicId, phone])
  @@index([clinicId, patientId])
  @@map("contacts")
  @@schema("omni")
}

/// @rls(clinic_id) @schema(omni)
model Channel {
  id          String        @id @default(uuid()) @db.Uuid
  clinicId    String        @map("clinic_id") @db.Uuid
  type        ChannelType
  name        String
  isActive    Boolean       @default(true) @map("is_active")
  /// JSONB: para WhatsApp contém { phoneNumberId, wabaId, verifyToken, appSecret, accessTokenEncrypted }
  /// Tokens cifrados pela aplicação antes de persistir (ver lib/crypto.ts)
  config      Json          @default("{}")
  aiAgentId   String?       @map("ai_agent_id") @db.Uuid

  clinic        Clinic         @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  aiAgent       AiAgent?       @relation(fields: [aiAgentId], references: [id], onDelete: SetNull)
  conversations Conversation[]

  @@unique([clinicId, name])
  @@index([clinicId, type])
  @@map("channels")
  @@schema("omni")
}

/// @rls(clinic_id) @schema(omni)
model AiAgent {
  id              String         @id @default(uuid()) @db.Uuid
  clinicId        String         @map("clinic_id") @db.Uuid
  type            AiAgentType    @default(receptionist)
  name            String
  isActive        Boolean        @default(true) @map("is_active")
  /// Para Aurora: "claude-haiku-4-5" (primário) — fallback "ollama:llama3.1:8b" via opossum
  model           String         @default("claude-haiku-4-5")
  /// Texto literal versionado — ver Anexo B §B.2
  systemPrompt    String?        @map("system_prompt")
  temperature     Decimal        @default(0.30) @db.Decimal(3, 2)
  maxTokens       Int            @default(800) @map("max_tokens")
  /// Subset de B.1 — taxonomia de intenções fechada
  toolsEnabled    String[]       @map("tools_enabled")
  /// JSONB: { escalation_rules, sla_minutes, business_hours_only, ... }
  config          Json           @default("{}")

  clinic          Clinic           @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  channels        Channel[]
  knowledgeBase   AiKnowledgeBase[]

  @@index([clinicId, type])
  @@map("ai_agents")
  @@schema("omni")
}

/// @rls(clinic_id) @schema(omni)
/// RAG: FAQ, scripts, regras de negócio. Embeddings gerados por Ollama local.
model AiKnowledgeBase {
  id          String                       @id @default(uuid()) @db.Uuid
  clinicId    String                       @map("clinic_id") @db.Uuid
  aiAgentId   String                       @map("ai_agent_id") @db.Uuid
  title       String
  content     String
  /// @vector(1536) — acessado via $queryRaw com operador <=> (cosine)
  embedding   Unsupported("vector(1536)")?
  metadata    Json                         @default("{}")
  isActive    Boolean                      @default(true) @map("is_active")

  clinic      Clinic    @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  aiAgent     AiAgent   @relation(fields: [aiAgentId], references: [id], onDelete: Cascade)

  @@index([aiAgentId])
  @@map("ai_knowledge_base")
  @@schema("omni")
}

/// @rls(clinic_id) @schema(omni)
model Conversation {
  id                    String                @id @default(uuid()) @db.Uuid
  clinicId              String                @map("clinic_id") @db.Uuid
  contactId             String                @map("contact_id") @db.Uuid
  channelId             String                @map("channel_id") @db.Uuid
  assignedTo            String?               @map("assigned_to") @db.Uuid
  status                ConversationStatus    @default(open)
  priority              ConversationPriority  @default(normal)
  subject               String?
  lastMessageAt         DateTime?             @map("last_message_at")
  lastMessagePreview    String?               @map("last_message_preview")
  unreadCount           Int                   @default(0) @map("unread_count")
  tags                  String[]              @default([])
  /// JSONB de uso geral (já existe). Aurora consome a chave `aurora_state` aqui:
  /// { handler: 'aurora'|'human', intent, lastTransferAt, optInGivenAt, holdToken? }
  metadata              Json                  @default("{}")
  resolvedAt            DateTime?             @map("resolved_at")

  clinic                Clinic                @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  contact               Contact               @relation(fields: [contactId], references: [id], onDelete: Restrict)
  channel               Channel               @relation(fields: [channelId], references: [id], onDelete: Restrict)
  assignedUser          User?                 @relation("AssignedConversations", fields: [assignedTo], references: [id], onDelete: SetNull)
  messages              Message[]

  @@index([clinicId, status])
  @@index([clinicId, contactId])
  @@map("conversations")
  @@schema("omni")
}

/// @rls(clinic_id) @schema(omni)
model Message {
  id                  String              @id @default(uuid()) @db.Uuid
  clinicId            String              @map("clinic_id") @db.Uuid
  conversationId      String              @map("conversation_id") @db.Uuid
  senderType          MessageSenderType   @map("sender_type")
  senderUserId        String?             @map("sender_user_id") @db.Uuid
  senderAgentId       String?             @map("sender_agent_id") @db.Uuid
  contentType         MessageContentType  @default(text) @map("content_type")
  content             String?
  mediaUrl            String?             @map("media_url")
  mediaMetadata       Json                @default("{}") @map("media_metadata")
  status              MessageStatus       @default(pending)
  /// ID retornado pelo provedor (Meta wamid, etc.) — chave de idempotência
  externalMessageId   String?             @map("external_message_id")
  sentAt              DateTime?           @map("sent_at")
  deliveredAt         DateTime?           @map("delivered_at")
  readAt              DateTime?           @map("read_at")
  isInternalNote      Boolean             @default(false) @map("is_internal_note")
  createdAt           DateTime            @default(now()) @map("created_at")

  clinic              Clinic              @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  conversation        Conversation        @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  /// Idempotência inbound — já implementada no SQL atual
  @@unique([clinicId, externalMessageId])
  @@index([conversationId, createdAt])
  @@map("messages")
  @@schema("omni")
}

// ─────────────────────────────────────────────────────────────
// Schema "audit" — append-only, fora do escopo de RLS multi-tenant na app
// ─────────────────────────────────────────────────────────────

/// @append-only @schema(audit)
/// UPDATE/DELETE bloqueados por RULE — não usar PrismaClient para mutar.
model DomainEvent {
  id            BigInt   @id @default(autoincrement())
  clinicId      String   @map("clinic_id") @db.Uuid
  aggregateType String   @map("aggregate_type")
  aggregateId   String   @map("aggregate_id") @db.Uuid
  eventType     String   @map("event_type")
  payload       Json
  metadata      Json     @default("{}")
  occurredAt    DateTime @default(now()) @map("occurred_at")

  @@index([clinicId, aggregateType, aggregateId])
  @@index([eventType, occurredAt])
  @@map("domain_events")
  @@schema("audit")
  @@ignore
}

/// @append-only @schema(audit)
/// LGPD art. 37 — quem acessou PHI quando.
model AccessLog {
  id            BigInt   @id @default(autoincrement())
  clinicId      String   @map("clinic_id") @db.Uuid
  userId        String?  @map("user_id") @db.Uuid
  resourceType  String   @map("resource_type")
  resourceId    String?  @map("resource_id") @db.Uuid
  action        String
  ipAddress     String?  @map("ip_address") @db.Inet
  userAgent     String?  @map("user_agent")
  sessionId     String?  @map("session_id")
  occurredAt    DateTime @default(now()) @map("occurred_at")

  @@index([clinicId, occurredAt])
  @@map("access_log")
  @@schema("audit")
  @@ignore
}
```

### A.1.3 Como o RLS é aplicado em runtime

A política de RLS está em [`db/init/004_rls_policies.sql`](../../db/init/004_rls_policies.sql) e força `clinic_id = shared.current_clinic_id()` em todas as tabelas multi-tenant. O `current_clinic_id()` lê a variável de sessão `app.current_clinic_id`, que **deve ser setada por transação** antes de qualquer query do role `dermaos_app`.

O helper canônico já implementado é `withClinicContext()` em [`apps/api/src/db/client.ts:31`](../../apps/api/src/db/client.ts) e é usado, por exemplo, em [`scheduling.service.ts:259`](../../apps/api/src/modules/scheduling/scheduling.service.ts).

Caso Prisma seja adotado, este helper deve ser espelhado como extensão **[NOVO]**:

```ts
// packages/db-prisma/src/withClinicContext.ts [NOVO — opcional]
import { Prisma, PrismaClient } from '@prisma/client';

export const clinicContextExtension = Prisma.defineExtension((client) => client.$extends({
  client: {
    async withClinicContext<T>(clinicId: string, fn: (tx: PrismaClient) => Promise<T>) {
      // SET LOCAL precisa de transação; $transaction garante connection sticky
      return client.$transaction(async (tx) => {
        // SET LOCAL não aceita parâmetros bind — clinicId DEVE vir já validado
        // como UUID antes desta chamada (zod / fastify schema)
        await tx.$executeRawUnsafe(`SET LOCAL app.current_clinic_id = '${clinicId}'`);
        return fn(tx as unknown as PrismaClient);
      });
    },
  },
}));
```

**Regra de uso:** qualquer query da Aurora (e de qualquer outro código de aplicação) deve estar dentro de `withClinicContext(clinicId, async (tx) => { ... })`. Queries fora desse contexto, no role `dermaos_app`, retornam **zero linhas** (RLS) — o que é a falha segura desejada.

**Roles do banco** (definidos em [`db/init/004_rls_policies.sql`](../../db/init/004_rls_policies.sql)):
- `dermaos_app` — uso regular, RLS forçado.
- `dermaos_readonly` — BI/compliance, somente SELECT, RLS forçado.
- `dermaos_worker` — workers BullMQ cross-clinic (Aurora reasoning roda neste role; ver A.4).
- `dermaos_admin` — migrations apenas; sem RLS.

---

## A.2 Assinatura de `scheduling.service.getAvailableSlots` (literal)

### A.2.1 Existente — não alterar

Definida em [`apps/api/src/modules/scheduling/scheduling.service.ts:253`](../../apps/api/src/modules/scheduling/scheduling.service.ts):

```ts
export interface SlotWindow {
  start:     Date;
  end:       Date;
  available: boolean;
}

export async function getAvailableSlots(
  providerId:  string,
  date:        Date,
  durationMin: number,
  clinicId:    string,
): Promise<SlotWindow[]>;
```

**Semântica:**
- Lê `provider.schedule_config.workingHours[diaSemana]` (com `breaks`).
- Itera o dia em passos de `slotSizeMin` (config do provider).
- Cruza com `shared.appointments` ativos (status NÃO em `cancelled`/`no_show`) usando `pg_advisory_xact_lock` na tupla `(clinic_id, provider_id, start_time)` para serializar a leitura.
- Retorna lista completa de janelas, marcando `available: false` para slots conflitantes (mantém útil para UIs que mostram horários ocupados em cinza).

### A.2.2 Extensões necessárias para Aurora **[NOVO]**

Aurora propõe um horário, o paciente leva 30–90 segundos para responder; outro canal (recepcionista humano, agendamento online) não pode reservar o mesmo slot nesse intervalo. Solução: **hold curto** com TTL.

```ts
// apps/api/src/modules/scheduling/scheduling.service.ts (a adicionar) [NOVO]

/**
 * Reserva tentativa (TTL curto) sem criar Appointment.
 * Idempotente por hold_token. Não persiste PHI.
 */
export async function reserveTentativeSlot(input: {
  providerId:     string;
  scheduledAt:    Date;
  durationMin:    number;
  clinicId:       string;
  conversationId: string;     // origem (Aurora)
  ttlSeconds:     number;     // padrão 180s, máx 600s
}): Promise<{ holdToken: string; expiresAt: Date }>;

/**
 * Confirma um hold em Appointment definitivo. Atomicamente:
 *   1. SELECT FOR UPDATE no hold; valida expires_at > now()
 *   2. pg_advisory_xact_lock(clinic_id, provider_id, scheduled_at)
 *   3. revalida ausência de conflito em shared.appointments
 *   4. INSERT shared.appointments com source='whatsapp', conversation_id, status='scheduled'
 *   5. DELETE do hold
 *   6. Emite audit.domain_events evento `appointment.created_via_aurora`
 */
export async function confirmHeldSlot(input: {
  holdToken:      string;
  clinicId:       string;
  patientId:      string;
  serviceId:      string;
  conversationId: string;
}): Promise<AppointmentPublic>;

/**
 * Libera hold (paciente desistiu, timeout interno do bot, fluxo abortado).
 */
export async function releaseHold(holdToken: string, clinicId: string): Promise<void>;
```

### A.2.3 Tabela de suporte ao hold **[NOVO]**

Nova migração SQL (`db/init/006_scheduling_holds.sql`):

```sql
CREATE TABLE shared.scheduling_holds (
  hold_token       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id        UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  provider_id      UUID        NOT NULL REFERENCES shared.users    (id) ON DELETE RESTRICT,
  conversation_id  UUID        NOT NULL,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_min     INT         NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_holds_provider_slot UNIQUE (clinic_id, provider_id, scheduled_at)
);

CREATE INDEX idx_holds_expires_at ON shared.scheduling_holds (expires_at);

ALTER TABLE shared.scheduling_holds ENABLE  ROW LEVEL SECURITY;
ALTER TABLE shared.scheduling_holds FORCE   ROW LEVEL SECURITY;

CREATE POLICY holds_isolation_app      ON shared.scheduling_holds
  FOR ALL TO dermaos_app      USING (clinic_id = shared.current_clinic_id());
CREATE POLICY holds_isolation_readonly ON shared.scheduling_holds
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY holds_worker_all         ON shared.scheduling_holds
  FOR ALL TO dermaos_worker   USING (true);
```

Job periódico (BullMQ, intervalo 1 min): `DELETE FROM shared.scheduling_holds WHERE expires_at < NOW()`. **Não** depende de RLS — roda como `dermaos_admin` ou `dermaos_worker`.

---

## A.3 Stack de infra assumida

| Componente | Versão alvo | Já existe? | Onde Aurora usa | Notas |
|---|---|---|---|---|
| **PostgreSQL 16 + pgvector** | 16.x / pgvector 0.7+ | Sim — [`docker-compose.yml`](../../docker-compose.yml) `db` service; extensão criada em [`001_extensions.sql`](../../db/init/001_extensions.sql) | RAG sobre `omni.ai_knowledge_base` (FAQ da clínica, scripts de atendimento, regras de agendamento). Query: `embedding <=> $queryEmbedding` com índice ivfflat. | Embeddings gerados por Ollama (modelo `nomic-embed-text`); 1536-dim. |
| **Redis 7 (`ioredis`)** | server 7 / lib `^5.4.0` | Sim — [`docker-compose.yml`](../../docker-compose.yml) `cache` service; lib em [`apps/api/package.json`](../../apps/api/package.json) | (a) Token-bucket de rate-limit por contato (`aurora:rl:{clinicId}:{contactId}`, capacidade 6 msgs / 60s); (b) Cache de contexto da conversa (últimas 20 mensagens, chave `aurora:ctx:{conversationId}`, TTL 300s); (c) Pub/sub `omni:realtime` para empurrar mensagem ao operador humano via Socket.io. | Sem persistência crítica em Redis — toda informação reconstruível a partir do Postgres. |
| **BullMQ** | `^5.x` | Sim — usada em [`apps/api/src/jobs/queues.ts`](../../apps/api/src/jobs/queues.ts) | Filas: `omniInboundQueue` (existe), `auroraReasoningQueue` **[NOVO]**, `omniOutboundQueue` **[NOVO]**. Cada job carrega apenas `messageId`/`conversationId` — o worker carrega o resto sob `withClinicContext`. | Idempotência por `jobId` determinístico; retries exponenciais; DLQ por fila. |
| **opossum** **[NOVO]** | `^8.1` | Não | Wrap obrigatório em **toda** chamada externa: Anthropic SDK, Ollama HTTP, Meta Graph API. Configuração padrão: `errorThresholdPercentage: 50`, `resetTimeout: 30000`, `volumeThreshold: 10`, `timeout: 12000`. Em estado `open`: para Anthropic → fallback Ollama; para Ollama → resposta de transferência humana (B.3.7); para Meta Graph → enfileirar com `attempts: 5` e backoff exponencial. | Métricas exportadas em Prometheus por nome de breaker. |
| **Pino** | `^9.5.0` | Sim — [`apps/api/src/lib/logger.ts`](../../apps/api/src/lib/logger.ts) | Logger estruturado JSON em produção. Aurora **deve** anexar em todo log: `{ clinicId, conversationId, messageId, intent, guardrailHit, latencyMs, model, tokensIn, tokensOut, breakerState }`. **Proibido** logar `content` plaintext de `messages` ou qualquer campo PHI. | Redactors de Pino configurados para mascarar `*.cpf`, `*.phone`, `*.email`, `*.password*`. |
| **@anthropic-ai/sdk** | `0.33.x` | Instalado — [`apps/api/package.json`](../../apps/api/package.json) — sem uso | `AuroraService` **[NOVO]** consome via `messages.create` com **prompt caching** habilitado em `system` e `tools`. Modelo: `claude-haiku-4-5`. Streaming opcional (resposta enviada em chunks ao Meta apenas em mensagens longas — WhatsApp não suporta typing real). | Headers obrigatórios: `anthropic-version`, `anthropic-beta: prompt-caching-2024-07-31`. |
| **Ollama (llama3.1:8b)** | local | Sim — [`docker-compose.yml`](../../docker-compose.yml) `ollama` service; uso atual em [`apps/api/src/modules/clinical/encounters/ai-suggestions.service.ts`](../../apps/api/src/modules/clinical/encounters/ai-suggestions.service.ts) | Fallback do circuit breaker da Anthropic. Também usado para gerar embeddings da KB. | Sem egresso de PHI — vantagem em modo degradado. |
| **Fastify** | `^5.x` | Sim | Webhook receiver de WhatsApp ([`apps/api/src/modules/omni/webhooks.route.ts`](../../apps/api/src/modules/omni/webhooks.route.ts)). | Aurora não expõe HTTP próprio; opera via worker. |
| **Socket.io** | `^4.8` | Sim | Aurora publica em `omni:realtime` quando transfere para humano — operador vê conversa "subir" em tempo real. | Canal por `clinicId`. |

---

## A.4 Como a mensagem do WhatsApp chega até o `AuroraService`

### A.4.1 Diagrama ASCII

```
                     ┌──────────────────┐
                     │  Meta Graph API  │  (webhooks.entry[].changes[].value.messages[])
                     └────────┬─────────┘
                              │ HTTPS POST  X-Hub-Signature-256
                              ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ Fastify (apps/api)                                                │
   │  POST /api/v1/webhooks/whatsapp   webhooks.route.ts:118           │
   │   1. addContentTypeParser preserva rawBody (line 75-91)           │
   │   2. findChannelByExternalId(phoneNumberId) → clinicId (l. 22-47) │
   │   3. driver.verifyWebhookSignature (HMAC-SHA256) — falha → 401    │
   │   4. extrai entry[].changes[].value.messages[]                    │
   │   5. para cada msg: omniInboundQueue.add(jobId='wa:'+msg.id)      │
   │   6. responde 200 em < 3 s   (requisito Meta)                     │
   └────────────────────────────┬──────────────────────────────────────┘
                                │ BullMQ (Redis)
                                ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ Worker — omni-inbound.processor (já existe)                       │
   │   abre withClinicContext(clinicId, async tx => …)                 │
   │   • UPSERT omni.contacts por (clinic_id, external_ids.whatsapp_id)│
   │   • UPSERT omni.conversations (status='open')                     │
   │   • INSERT omni.messages (idempotente por external_message_id)    │
   │   • emite audit.domain_events `message.received`                  │
   │                                                                   │
   │  → DECISÃO DE ROTEAMENTO (extensão [NOVO] no fim do processor):   │
   │     a) conversations.assigned_to ≠ NULL                           │
   │        OR metadata.aurora_state.handler = 'human'                 │
   │        → publish 'omni:realtime'  (humano cuida)        — fim     │
   │     b) channels.ai_agent_id ≠ NULL                                │
   │        AND contacts.opted_in_at ≠ NULL                            │
   │        AND not opted_out                                          │
   │        AND dentro de horário de operação da Aurora                │
   │        → auroraReasoningQueue.add({messageId},                    │
   │                                    {jobId:'aurora:'+messageId})   │
   │     c) caso contrário                                             │
   │        → publish 'omni:realtime'  (humano cuida)        — fim     │
   └────────────────────────────┬──────────────────────────────────────┘
                                │ BullMQ
                                ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ Worker — aurora-reasoning.processor [NOVO]                        │
   │  AuroraService.handleMessage({ messageId })                       │
   │   1. loadContext(conversationId)  — 20 últimas msgs (Redis cache) │
   │   2. piiRedactor.redact(messages, mode:'strict')   (Anexo B §B.4) │
   │   3. classifyIntent()  — regex/keyword + LLM judge (Anexo B §B.1) │
   │   4. guardrails.check(message, intent)             (Anexo B §B.5) │
   │      • se hit → resposta padrão; pula tool-use                    │
   │   5. tool-use loop com Anthropic SDK                              │
   │      └─ wrapper opossum → fallback Ollama → fallback B.3.7        │
   │   6. INSERT omni.messages (sender='ai_agent', status='pending')   │
   │   7. omniOutboundQueue.add({messageId},                           │
   │                            {jobId:'out:'+messageId})              │
   │   8. emite audit.domain_events `aurora.message_handled`           │
   │      (payload sem PHI plaintext)                                  │
   └────────────────────────────┬──────────────────────────────────────┘
                                │ BullMQ
                                ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ Worker — omni-outbound.processor [NOVO]                           │
   │   POST graph.facebook.com/v20.0/{phoneNumberId}/messages          │
   │   (wrapper opossum com retries; respeita rate-limit do canal)     │
   │   • atualiza omni.messages.status (sent | failed)                 │
   │   • atualiza omni.messages.external_message_id (wamid retornado)  │
   └───────────────────────────────────────────────────────────────────┘

   Status callbacks (delivered / read / failed) entram pelo MESMO webhook
   /api/v1/webhooks/whatsapp e seguem o ramo `persistStatus` já existente.
```

### A.4.2 Sequência detalhada (10 passos numerados)

1. **Meta envia** `POST /api/v1/webhooks/whatsapp` com payload Cloud API ([`webhooks.route.ts:118`](../../apps/api/src/modules/omni/webhooks.route.ts)). O parser custom em `addContentTypeParser` preserva `rawBody: Buffer` para validação HMAC ([`webhooks.route.ts:75-91`](../../apps/api/src/modules/omni/webhooks.route.ts)).

2. **HMAC-SHA256** validado em `whatsapp.channel.ts → verifyWebhookSignature` usando `appSecret` do `channel.config`. Falha → `reply.status(401)`, log `webhook signature invalid` em [`webhooks.route.ts:63-68`](../../apps/api/src/modules/omni/webhooks.route.ts), **sem enfileirar**.

3. **Resolução do canal**: `findChannelByExternalId('whatsapp', phoneNumberId)` ([`webhooks.route.ts:22-47`](../../apps/api/src/modules/omni/webhooks.route.ts)) localiza a linha em `omni.channels` cujo `config ->> 'phoneNumberId'` casa, devolvendo `clinic_id`. Não encontrado → `404 channel_not_found`. Em dev, fallback `findDefaultChannel`.

4. **Enfileiramento** (`webhooks.route.ts:280-282`):
   ```ts
   omniInboundQueue.add('inbound', job, {
     jobId: 'wa:' + msg.id,           // idempotência: redelivery do Meta = no-op
     attempts: 5,
     backoff: { type: 'exponential', delay: 2000 },
     removeOnComplete: 1000,
   });
   ```
   Há um `Promise.race` com timeout de 2.5 s para detectar Redis indisponível, mas a resposta Meta sempre é `200` para evitar retries descontrolados.

5. **Response 200** dentro de 3 s — requisito Meta.

6. **Worker `omni-inbound.processor`** (existente) consome o job:
   - Abre `withClinicContext(clinic_id, async (tx) => { ... })` — RLS ativo no role `dermaos_worker`/`dermaos_app`.
   - UPSERT `omni.contacts` por `(clinic_id, external_ids.whatsapp_id)`.
   - UPSERT `omni.conversations` se inexistente (status `open`).
   - INSERT `omni.messages`. Idempotência garantida por `@@unique([clinicId, externalMessageId])`.
   - INSERT em `audit.domain_events` (`event_type='omni.message.received'`).

7. **Decisão de roteamento [NOVO no fim do processor]** — pseudocódigo:
   ```ts
   const conv = await tx.query<{ assigned_to: string | null; metadata: any }>(
     `SELECT assigned_to, metadata FROM omni.conversations WHERE id = $1`,
     [conversationId],
   );
   const auroraState = conv.metadata?.aurora_state ?? {};
   const channel = await tx.query(`SELECT ai_agent_id FROM omni.channels WHERE id = $1`, [channelId]);
   const contact = await tx.query(`SELECT opted_in_at, opted_out_at FROM omni.contacts WHERE id = $1`, [contactId]);

   const handlerIsHuman = conv.assigned_to !== null || auroraState.handler === 'human';
   const auroraEnabled  = channel.ai_agent_id !== null
                       && contact.opted_in_at !== null
                       && contact.opted_out_at === null
                       && withinAuroraOperatingHours(clinicId, now());

   if (handlerIsHuman || !auroraEnabled) {
     await pubsub.publish('omni:realtime', { type: 'message', conversationId, clinicId });
     return;
   }

   await auroraReasoningQueue.add('reason', { messageId, conversationId, clinicId }, {
     jobId: 'aurora:' + messageId,
     attempts: 3,
     backoff: { type: 'exponential', delay: 5000 },
   });
   ```
   Caso especial: contato **sem** `opted_in_at` recebe automaticamente a mensagem de opt-in (B.3.2) via `omniOutboundQueue` direto, sem passar por reasoning.

8. **Worker `aurora-reasoning.processor` [NOVO]** consome `auroraReasoningQueue`:
   - 8a. `loadContext(conversationId)` — últimas 20 mensagens via Redis (TTL 300 s); miss → fetch Postgres + repopula cache.
   - 8b. `piiRedactor.redact(messagesContent)` — substitui CPF/email/telefone/RG/CNS por tokens (`<CPF_REDACTED>` etc.); mais detalhes em Anexo B §B.4.
   - 8c. `classifyIntent()` — primeiro regex/keyword sobre a mensagem nova; se ambíguo, chama LLM judge (Haiku 4.5, prompt curto) com tool-call retornando `{ intent: enum, confidence: number }`. Cache de classificação por hash da mensagem (TTL 1 h).
   - 8d. **Guardrails** (Anexo B §B.5): `diagnostico`, `prescricao`, `promessa_resultado`. Se positivo, gera resposta padrão (B.3.11/12/14), pula tool-use, **mas ainda persiste** mensagem da Aurora.
   - 8e. **Tool-use** com Anthropic SDK envolto em `opossum`. Tools mapeiam para a taxonomia B.1: `consultarHorarios`, `reservarSlot`, `confirmarAgendamento`, `cancelarAgendamento`, `buscarAppointmentDoContato`, `transferirParaHumano`, `consultarKnowledgeBase`. Cada tool é um wrapper TypeScript que chama serviços já existentes (`scheduling.service`, `omni.service`).
   - 8f. **Persiste resposta** em `omni.messages` (sender_type='ai_agent', status='pending', sender_agent_id=auroraId).
   - 8g. `omniOutboundQueue.add('send', { messageId }, { jobId: 'out:'+messageId, attempts: 5 })`.

9. **Worker `omni-outbound.processor` [NOVO]** consome `omniOutboundQueue`:
   - POST `https://graph.facebook.com/v20.0/{phoneNumberId}/messages` (wrapper opossum, timeout 10 s).
   - On success: `UPDATE omni.messages SET status='sent', sent_at=NOW(), external_message_id=$wamid WHERE id=$id`.
   - On error: `UPDATE … status='failed'` e log estruturado; BullMQ retenta.

10. **Status callbacks** (delivered/read/failed) voltam pelo **mesmo** `/api/v1/webhooks/whatsapp` e são enfileirados como jobs de tipo `'status'` ([`webhooks.route.ts:286-300`](../../apps/api/src/modules/omni/webhooks.route.ts)). O processor existente atualiza `delivered_at` / `read_at` / `failed_at` em `omni.messages`.

### A.4.3 Garantias

- **Entrega no banco:** at-least-once via BullMQ + idempotência por `external_message_id`.
- **Resposta da Aurora:** at-least-once com `jobId` `aurora:{messageId}` — duplicatas são detectadas pela presença de uma mensagem `ai_agent` com o mesmo `metadata.in_reply_to=messageId`.
- **RLS:** todo INSERT/SELECT da Aurora roda dentro de `withClinicContext` — leak entre clínicas é impossível pelo role `dermaos_app`/`dermaos_worker`.
- **Auditoria:** cada decisão da Aurora gera `audit.domain_events` (`event_type='aurora.message_handled'`) com payload `{ intent, guardrailHit, model, tokensIn, tokensOut, breakerState, latencyMs }` — **sem** conteúdo plaintext.
- **Falha de provedor:** circuit breaker abre em 50% de erros sobre janela de 10 chamadas; durante `open`, fallback degrada graciosamente: Anthropic → Ollama → resposta B.3.7 (transferência humana).
- **Sem PHI no log:** redactors de Pino + ausência de `content` em todos os campos logados pela Aurora.

---

## A.5 Resumo dos artefatos novos

| Componente | Tipo | Caminho-alvo |
|---|---|---|
| `AuroraService` | Módulo Node | `apps/api/src/modules/aurora/aurora.service.ts` |
| `aurora-reasoning.processor` | Worker BullMQ | `apps/worker/src/processors/aurora-reasoning.processor.ts` |
| `omni-outbound.processor` | Worker BullMQ | `apps/worker/src/processors/omni-outbound.processor.ts` |
| `auroraReasoningQueue`, `omniOutboundQueue` | Filas | `apps/api/src/jobs/queues.ts` |
| `pii-redactor` | Lib | `apps/api/src/lib/pii-redactor.ts` |
| `intent-classifier`, `guardrails` | Libs | `apps/api/src/modules/aurora/{intent,guardrails}/*.ts` |
| `circuit-breaker` (opossum wrapper) | Lib | `apps/api/src/lib/circuit-breaker.ts` |
| `scheduling_holds` | Tabela | `db/init/006_scheduling_holds.sql` |
| `reserveTentativeSlot`, `confirmHeldSlot`, `releaseHold` | Funções | `apps/api/src/modules/scheduling/scheduling.service.ts` |
| `clinicContextExtension` | Prisma extension (opcional) | `packages/db-prisma/src/withClinicContext.ts` |

---

**Cross-reference:** decisões de produto, taxonomia, prompts, mensagens, dados proibidos e guardrails operacionais estão em [Anexo-B-Conteudo.md](./Anexo-B-Conteudo.md).
