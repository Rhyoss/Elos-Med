# ADR-002: Criptografia AES-256-GCM versionada por tenant

**Status:** Accepted
**Data:** 2026-04-10
**Autores:** Backend Lead, Security Lead

## Contexto

DermaOS armazena PHI (Protected Health Information) — nome, CPF, email,
telefone, endereço, registros clínicos. A LGPD (art. 46) exige medidas
técnicas adequadas para proteção desses dados, e o art. 11 estabelece
proteções específicas para dados sensíveis (saúde).

Restrições adicionais:

- **Multi-tenancy:** dados de tenants diferentes não podem ser
  recuperáveis com a mesma chave. Mesmo que um tenant tenha sua chave
  comprometida, outros tenants permanecem seguros.
- **Rotação:** precisamos rotacionar a chave mestra sem reescrever todo o
  banco de dados em uma janela de manutenção (operação inviável para
  bases com milhões de pacientes).
- **Lookup determinístico:** `WHERE cpf = ?` precisa funcionar sem
  descriptografar todas as linhas — caso contrário toda busca por CPF
  carrega toda a tabela na memória.

Criptografia a nível de coluna (`pgcrypto`) deixa a chave próxima do banco
e não permite separação clara entre tenants.

## Decisão

Implementar `EncryptionService` na camada de aplicação com:

- **Algoritmo:** AES-256-GCM (autenticado, sem padding oracle).
- **IV:** 12 bytes (96 bits) aleatórios — *nunca* reutilizar.
- **Auth tag:** 16 bytes, validado em decrypt.
- **AAD obrigatório:** `clinic_id` em UTF-8. Previne reutilização de
  ciphertext entre tenants — mesmo se um atacante copiar bytes de uma
  clínica para outra, GCM falha a verificação.
- **Derivação de chave:** `masterKey(version)` → HKDF-SHA256 com
  `info='dermaos-clinic-key-v1:<clinic_id>'`. 32 bytes derivados por
  tenant, sem estado a persistir.
- **Versionamento:** ciphertext leva prefixo `v{N}:` (ex: `v1:iv:tag:ct`).
  Master keys antigas ficam em `MASTER_KEY_V1`, `MASTER_KEY_V2`, ... Com
  isso, rotação é instantânea: nova versão começa a ser usada em writes,
  reads continuam funcionando contra ciphertext antigo.
- **Hash determinístico para lookup:** HMAC-SHA256(value, TENANT_HMAC_SECRET)
  para `cpf_hash`, `email_hash`. Permite WHERE = HMAC(input) sem
  descriptografar. Segredo nunca sai do servidor.

Implementação em [apps/api/src/lib/encryption.ts](../../apps/api/src/lib/encryption.ts).

## Consequências

### Positivas

- Comprometimento da master key v1 não compromete dados escritos em v2+.
- Comprometimento de uma clínica não compromete outras (HKDF + AAD).
- Rotação de chave é operação online — nada precisa ser reencriptado em
  batch (mas há `reEncryptIfStale` que faz re-write oportunístico em reads).
- Auditoria por tenant é trivial: todo decrypt requer clinic_id explícito.

### Negativas

- Custo de CPU por operação (HKDF + AES-GCM): ~50 µs por campo. Em queries
  que descriptografam 1000 pacientes ao mesmo tempo (export LGPD), isso
  fica perceptível — mitigado por cache de chaves derivadas em memória.
- Devs não podem inspecionar dados via psql diretamente. Para debug em
  produção é necessário um helper que loga clinic_id + decrypt.
- Master keys são parte do segredo crítico — gerenciamento via
  Vault/Azure Key Vault em produção (não no .env).

### Neutras

- `cpf_hash` é determinístico, então um atacante com banco vazado pode
  fazer rainbow table contra uma lista de CPFs conhecidos. Mitigamos com
  TENANT_HMAC_SECRET (sem ele, tabela é inutilizável). Se o secret também
  vazar, o atacante consegue reverter o hash mas nem assim os campos
  `*_encrypted` são lidos.

## Alternativas consideradas

### pgcrypto / TDE (Transparent Data Encryption)

Descartado: chave fica próxima do banco, sem isolamento por tenant.
Cumpre LGPD em sentido amplo mas não atinge nosso objetivo de blast
radius limitado.

### Vault dynamic secrets por tenant

Descartado para v1: complexidade operacional alta e dependência de Vault
em runtime para cada operação. Pode ser adotado em v2 se número de
tenants crescer.

### KMS por tenant (AWS KMS / Azure Key Vault)

Descartado: latência (10-50ms por operação) inviabiliza em queries que
descriptografam batches. Pode ser usado para envelope encryption — chave
KMS protege a master key, mas decrypt do field continua local.

## Referências

- LGPD art. 46 — segurança e sigilo de dados
- NIST SP 800-38D — GCM mode
- RFC 5869 — HKDF
- Implementação: [encryption.ts](../../apps/api/src/lib/encryption.ts)
