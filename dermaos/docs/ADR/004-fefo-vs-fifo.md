# ADR-004: FEFO (não FIFO) para controle de lotes

**Status:** Accepted
**Data:** 2026-04-20
**Autores:** Supply Chain Lead, Backend Lead

## Contexto

O módulo de estoque do DermaOS gerencia produtos com **prazo de validade**:
toxina botulínica, ácido hialurônico, vitaminas injetáveis, anestésicos.
Aplicar um produto vencido em paciente é:

- **Risco clínico:** alguns ativos perdem eficácia; outros se degradam em
  metabólitos potencialmente alergênicos.
- **Não-conformidade ANVISA:** uso de produto vencido é proibido pela
  RDC 67/2007 e gera autuação em fiscalização.
- **Risco financeiro/processual:** se houve reação adversa de paciente
  com produto vencido, a clínica responde civil e criminalmente.

A política tradicional de estoque "First In, First Out" (FIFO) consome
o lote que **chegou primeiro**, independente de validade. Isso é correto
para commodities (parafusos, cabos), mas perigoso para produtos com
validade.

Cenário concreto: um lote A foi recebido em 2026-01 com validade
2027-12. Em 2026-04 chega lote B com validade 2026-08 (curta porque foi
de promoção do fornecedor). Sob FIFO, o lote A é consumido primeiro e o
lote B vence no estoque, gerando perda financeira E exposição se o
sistema não detectar a vencimento.

## Decisão

Adotar **FEFO (First Expired, First Out)** como política única e
obrigatória do módulo de estoque, implementada na seleção de lotes em:

- Consumo automático via `supply-consumption.processor`
  ([apps/worker/src/processors/supply-consumption.processor.ts](../../apps/worker/src/processors/supply-consumption.processor.ts))
- Consumo manual via `consumption.service.ts`
- Sugestões de lote no app web ao registrar uso fora do kit

Query padrão:

```sql
SELECT id, quantity_current FROM supply.inventory_lots
WHERE clinic_id = $1
  AND product_id = $2
  AND quantity_current > 0
  AND is_quarantined = false
ORDER BY expiry_date NULLS LAST, received_at  -- FEFO
FOR UPDATE
```

`expiry_date NULLS LAST` garante que lotes sem validade declarada
(commodities ou kits especiais) são consumidos por último, depois de
todos os datados terem sido esgotados.

## Consequências

### Positivas

- Reduz drasticamente o risco de aplicação de produto vencido.
- Reduz perda financeira por produto vencendo no estoque.
- Conformidade direta com expectativa de auditoria ANVISA.
- Lógica única e testável — testes em `cross-domain-encounter-stock.test.ts`
  validam FEFO em cenário de múltiplos lotes.

### Negativas

- Custo de query: ORDER BY em coluna sem índice é lento. Mitigado pelo
  índice parcial `idx_inventory_lots_available` em
  `(clinic_id, product_id, expiry_date) WHERE quantity_current > 0`.
- Lotes sem `expiry_date` ficam por último — pode levar a estoque parado
  se o usuário esquecer de preencher. Mitigado por validação no NF-e
  parser e alerta no UI ao criar lote sem validade.

### Neutras

- Worker `supply-alerts.processor` checa diariamente lotes com
  `expiry_date < NOW() + 30 days` e gera notificação para admins. Isso é
  complementar ao FEFO: FEFO consome o que está mais perto, alerta avisa
  quando algo está perto demais para confiar só no consumo.

## Alternativas consideradas

### FIFO com filtro pré-vencimento

Descartado: complica a query sem ganho. Já que precisamos ordenar de
qualquer jeito, ordenar por validade é mais simples e mais seguro.

### LIFO (último a entrar, primeiro a sair)

Descartado: pior dos mundos para produtos com validade. Era opção
considerada para insumos importados onde último lote tem documentação
mais recente, mas a clínica não tem essa exigência.

### Política configurável por produto

Descartado para v1: aumenta complexidade sem caso de uso real. Toxina
botulínica e ácido hialurônico — os dois maiores em valor — devem
sempre ser FEFO.

## Referências

- RDC ANVISA 67/2007 — manipulação de medicamentos
- RDC ANVISA 304/2019 — boas práticas de armazenamento
- [030_supply_tables.sql:217](../../db/init/030_supply_tables.sql) —
  índice parcial para lotes disponíveis
- Implementação: [supply-consumption.processor.ts](../../apps/worker/src/processors/supply-consumption.processor.ts)
