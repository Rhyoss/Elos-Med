# `packages/ui/src/_archive/` — Reserva técnica do Design System

Componentes e layouts **fora do fluxo ativo**, mantidos aqui para inspeção/restauração.
Esta pasta é **excluída do `tsconfig.json`** e dos barrel exports — não compila no build, não aparece no IntelliSense de `import { ... } from '@dermaos/ui'`.

## Conteúdo

### `layouts/app-shell.tsx`
- **Status**: Substituído pelo DS `Shell` em `packages/ui/src/ds/layouts/Shell.tsx`.
- **Por quê está aqui**: O `<AppShell>` legado (Tailwind/shadcn) foi sucedido pelo Shell do Quite Clear DS (inline-style, tokens canônicos, RBAC + realtime + CommandPalette).
- **Quando usar**: Apenas se for necessário reverter ao layout antigo durante alguma comparação A/B.

### `primitives/radio-group.tsx`
- **Status**: 0 callers em `apps/web` ou `apps/api`.
- **Por quê está aqui**: Primitive shadcn do Radix UI Radio Group, válido tecnicamente, mas nenhum form atual o usa (a maioria usa `Select` ou `Toggle`).
- **Quando usar**: Reservado para forms futuros que precisem de seleção exclusiva inline (ex: gênero, prioridade triagem).

## Como restaurar

1. Mover o arquivo de volta para o caminho de origem (ex: `packages/ui/src/primitives/radio-group.tsx`).
2. Re-adicionar a linha de export no barrel correspondente (ex: `packages/ui/src/primitives/index.ts`).
3. `pnpm --filter @dermaos/ui typecheck`.
