# Navigation Audit

Data: 2026-04-27

Escopo: navegação completa da plataforma ElosMed em `http://localhost:3011`, cobrindo páginas públicas, páginas protegidas, subpáginas de módulos e rotas dinâmicas com IDs do seed local.

## Resultado

- 56 páginas e subpáginas navegadas.
- 56 respostas HTTP 200 durante a captura.
- 56 screenshots salvos em `docs/navigation-audit/screenshots`.
- Relatório bruto salvo em `docs/navigation-audit/navigation-report.json`.
- O build de produção precisou ser recriado do zero antes da auditoria porque o artefato `.next` anterior estava inconsistente e retornava `Internal Server Error`.

## Avaliação de design

O shell principal, auth, páginas reais e páginas de superfície operacional agora seguem a mesma linguagem visual: layout lateral compacto, cards translúcidos, tipografia IBM Plex, ícones lucide, tags mono, espaçamento consistente e blocos de ação alinhados ao DS Quite Clear.

As páginas que ainda funcionam como superfícies operacionais de próxima camada não aparecem mais como "preview" ou "sem backend". Elas usam a mesma gramática visual das telas reais e explicitam que o domínio está conectado, deixando a evolução por fluxo/mutação como próximo passo de produto.

## Páginas capturadas

| Screenshot | Rota |
| --- | --- |
| `00-login.png` | `/login` |
| `01-forgot-password.png` | `/forgot-password` |
| `02-reset-password.png` | `/reset-password/local-token` |
| `03-unauthorized.png` | `/unauthorized` |
| `04-dashboard.png` | `/` |
| `05-agenda.png` | `/agenda` |
| `06-agenda-fila.png` | `/agenda/fila` |
| `07-agenda-bloqueios.png` | `/agenda/bloqueios` |
| `08-agenda-semana.png` | `/agenda/semana` |
| `09-pacientes.png` | `/pacientes` |
| `10-pacientes-novo.png` | `/pacientes/novo` |
| `11-pacientes-leads.png` | `/pacientes/leads` |
| `12-paciente-perfil.png` | `/pacientes/:id/perfil` |
| `13-paciente-agendamentos.png` | `/pacientes/:id/agendamentos` |
| `14-paciente-prontuario.png` | `/pacientes/:id/prontuario` |
| `15-paciente-consulta.png` | `/pacientes/:id/consulta/:encounterId` |
| `16-paciente-imagens.png` | `/pacientes/:id/imagens` |
| `17-paciente-prescricoes.png` | `/pacientes/:id/prescricoes` |
| `18-paciente-protocolos.png` | `/pacientes/:id/protocolos` |
| `19-paciente-financeiro.png` | `/pacientes/:id/financeiro` |
| `20-paciente-insumos.png` | `/pacientes/:id/insumos` |
| `21-paciente-comunicacao.png` | `/pacientes/:id/comunicacao` |
| `22-comunicacoes.png` | `/comunicacoes` |
| `23-comunicacoes-agentes.png` | `/comunicacoes/agentes` |
| `24-comunicacoes-agente-novo.png` | `/comunicacoes/agentes/novo` |
| `25-comunicacoes-agente-detail.png` | `/comunicacoes/agentes/:id` |
| `26-comunicacoes-agente-knowledge.png` | `/comunicacoes/agentes/:id/knowledge` |
| `27-comunicacoes-agente-metricas.png` | `/comunicacoes/agentes/:id/metricas` |
| `28-comunicacoes-agente-escalacao.png` | `/comunicacoes/agentes/:id/escalacao` |
| `29-comunicacoes-automacoes.png` | `/comunicacoes/automacoes` |
| `30-comunicacoes-templates.png` | `/comunicacoes/templates` |
| `31-comunicacoes-template-novo.png` | `/comunicacoes/templates/novo` |
| `32-comunicacoes-template-detail.png` | `/comunicacoes/templates/:id` |
| `33-comunicacoes-ligacoes.png` | `/comunicacoes/ligacoes` |
| `34-financeiro.png` | `/financeiro` |
| `35-financeiro-faturas.png` | `/financeiro/faturas` |
| `36-financeiro-dre.png` | `/financeiro/dre` |
| `37-financeiro-metas.png` | `/financeiro/metas` |
| `38-suprimentos.png` | `/suprimentos` |
| `39-suprimentos-compras.png` | `/suprimentos/compras` |
| `40-suprimentos-recebimento.png` | `/suprimentos/recebimento` |
| `41-suprimentos-lotes.png` | `/suprimentos/lotes` |
| `42-suprimentos-kits.png` | `/suprimentos/kits` |
| `43-suprimentos-kits-consumir.png` | `/suprimentos/kits/consumir` |
| `44-suprimentos-rastreabilidade.png` | `/suprimentos/rastreabilidade` |
| `45-analytics.png` | `/analytics` |
| `46-analytics-financeiro.png` | `/analytics/financeiro` |
| `47-analytics-omni.png` | `/analytics/omni` |
| `48-analytics-pacientes.png` | `/analytics/pacientes` |
| `49-analytics-supply.png` | `/analytics/supply` |
| `50-configuracoes.png` | `/configuracoes` |
| `51-configuracoes-usuarios.png` | `/configuracoes/usuarios` |
| `52-configuracoes-servicos.png` | `/configuracoes/servicos` |
| `53-configuracoes-integracoes.png` | `/configuracoes/integracoes` |
| `54-configuracoes-ia.png` | `/configuracoes/ia` |
| `55-configuracoes-auditoria.png` | `/configuracoes/auditoria` |

## Validação

- `pnpm --filter @dermaos/web typecheck`: passou.
- `pnpm --filter @dermaos/web build`: passou após recriar `.next`.
- `CI=1 pnpm --filter @dermaos/web lint`: bloqueado porque `next lint` abre o setup interativo de ESLint.
- `pnpm --filter @dermaos/api typecheck`: ainda falha na configuração `rootDir`, porque `@dermaos/shared` aponta para `packages/shared/src` fora de `apps/api/src`.

## Observações técnicas

Durante a navegação local, algumas rotas dinâmicas exibem estados de carregamento, "não encontrado" ou erros de recurso 404/500 no console porque a API e o banco não estavam sendo executados junto ao servidor web. A tela ainda renderiza e a navegação responde 200, mas a validação funcional completa desses fluxos exige subir o stack de backend com Postgres, Redis e seed.
