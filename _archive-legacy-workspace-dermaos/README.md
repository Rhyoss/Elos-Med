# `_archive-legacy-workspace-dermaos/` — Workspace duplicado legado

## Status: Reserva técnica, fora do build

Esta pasta é um **workspace pnpm completo e independente** (1.3GB, ~605 arquivos tracked) que foi importado durante o PR `feat/full-platform-merge` e **não faz parte do build atual**.

## Por que está aqui

- O `pnpm-workspace.yaml` na raiz lista apenas `apps/*` e `packages/*`. Esta pasta **não** está no workspace.
- Nenhum `import` em `apps/web`, `apps/api`, `apps/worker` ou `apps/ai` aponta para qualquer arquivo deste diretório.
- Foi mantida (em vez de deletada) para inspeção histórica — contém uma versão anterior dos prompts 01–23 com possível código de referência útil.

## O que tem dentro

```
_archive-legacy-workspace-dermaos/
  apps/
    api/
    ai/
    patient-portal/    ← PWA do paciente, não migrada para o workspace ativo
    web/
    worker/
  packages/
    shared/
    ui/
  db/
  docker-compose.yml
  package.json         ← name: "dermaos" — workspace independente
  pnpm-workspace.yaml  ← workspace próprio
  pnpm-lock.yaml
  ...
```

## Quando referenciar

- Comparar implementações antigas vs atuais para entender decisões de design
- Recuperar features experimentais (ex: `patient-portal/`) caso sejam priorizadas
- Auditoria de evolução do código

## Quando deletar

Quando o usuário tiver inspecionado e confirmar que não precisa mais. Sugere-se:
1. Garantir que features úteis (ex: patient-portal) foram migradas para `apps/`
2. `git rm -r _archive-legacy-workspace-dermaos/`
3. Commitar liberação de ~150MB de objetos no histórico (nota: arquivos tracked permanecem na história git mesmo após delete; rebase/filter-branch necessário para limpeza profunda)

## ⚠️ Não importar daqui

Qualquer `import` que aponte para este diretório deve ser revertido — código aqui não compila, não é tipado, não recebe atualizações.
