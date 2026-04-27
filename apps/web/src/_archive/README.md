# `apps/web/src/_archive/` — Reserva técnica do app web

Componentes do app `apps/web` **fora do fluxo ativo**, mantidos aqui para inspeção/restauração.
Esta pasta é **excluída do `tsconfig.json`** — não compila no build do Next.js, não interfere com hot reload.

## Conteúdo

### `components/auth/protected-route.tsx`
- **Status**: 0 callers em `apps/web/src/app/`.
- **Por quê está aqui**: Wrapper React legado para proteção de rotas no client. Substituído pela auth via cookie + middleware Next.js + `auth.ts` (`requireSession()`/`requirePermission()` no server) + `useAuthStore` no client.
- **Quando usar**: Apenas se houver mudança fundamental no modelo de auth (ex: SPA sem SSR).

## Como restaurar

1. Mover o arquivo de volta para o caminho de origem.
2. Adicionar import no caller (ex: `pacientes/[id]/imagens/page.tsx`).
3. `pnpm --filter @dermaos/web typecheck`.
