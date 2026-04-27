# ADR-001: tRPC interno + REST para webhooks e uploads

**Status:** Accepted
**Data:** 2026-04-01
**Autores:** Tech Lead

## Contexto

DermaOS tem três fronteiras de API com requisitos distintos:

1. **Front-end interno** (apps/web e apps/patient-portal): consumido pelo
   nosso próprio cliente Next.js. Mudanças de schema acontecem várias vezes
   por dia. O custo de errar tipos no contrato (mutation vs query, parâmetro
   opcional vs obrigatório) é alto: gera bug em produção e suporte.
2. **Webhooks externos** (Meta WhatsApp, Stripe, hCaptcha, Z-API): o
   provider chama nosso endpoint REST com payload definido por *eles*. Não
   temos controle do shape, e precisamos validar HMAC do payload bruto.
3. **Uploads** (lesões, prescrições assinadas, logos): multipart/form-data,
   não cabe no envelope JSON do tRPC e tem requisitos específicos de
   streaming e validação de mime type.

OpenAPI/REST puro força nós a manter spec separada da implementação,
e o cliente do front-end não pode importar tipos diretamente do back-end.
GraphQL exigiria runtime adicional (Apollo, codegen) e introspecção
desnecessária para um produto não-público.

## Decisão

Adotar **tRPC v11 para todo o tráfego interno** (front ↔ back) e **REST
para webhooks e uploads**.

- tRPC: `/api/trpc/*` — registrado via `fastifyTRPCPlugin`. Tipos são
  importados diretamente no cliente via `type AppRouter`.
- REST: rotas registradas no Fastify diretamente, com validação Zod do
  body (ou raw body para HMAC quando aplicável). Localizadas em
  `apps/api/src/modules/<dominio>/*.route.ts`.
- Schemas Zod compartilhados ficam em `packages/shared/src/schemas/`.

## Consequências

### Positivas

- Type-safety completa no front-end sem codegen — refactor de procedure
  altera o cliente automaticamente.
- Webhooks ficam isolados em rotas REST, com validação de signature
  apropriada (HMAC sobre raw body, que tRPC não expõe).
- Upload routes têm acesso direto a `@fastify/multipart` e validação
  customizada de imagem (sharp).

### Negativas

- Cliente não-Node.js (ex.: app mobile nativo futuro) não pode consumir
  tRPC diretamente — precisaria gerar OpenAPI a partir do router ou usar
  `trpc-openapi`.
- Documentação automática (Swagger UI) requer setup adicional.
- Time precisa entender duas convenções de "rota": `router({...})` para
  tRPC e `app.post(...)` para REST.

### Neutras

- Mantemos `/api/v1/*` como prefixo REST quando precisamos de URL pública
  (webhooks externos, integrações). tRPC fica em `/api/trpc/*`.

## Alternativas consideradas

### REST puro com OpenAPI

Descartado: custo de manter spec sincronizada e gerar tipos é alto. Time
de 5 devs não compensa o overhead.

### GraphQL com Apollo

Descartado: introspecção pública não é desejável para SaaS B2B (vaza
schema), e pagination cursor-based já é padrão na nossa stack tRPC sem
Apollo.

## Referências

- [tRPC v11 docs](https://trpc.io)
- [Fastify TRPC plugin](https://trpc.io/docs/server/adapters/fastify)
- PR inicial: `feat: setup tRPC + Fastify base`
