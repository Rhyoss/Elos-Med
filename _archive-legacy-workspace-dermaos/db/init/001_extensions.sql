-- ============================================================================
-- DermaOS — PostgreSQL Extensions
-- Executado automaticamente pelo entrypoint do container postgres
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_bytes(), crypt()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- busca trigram (LIKE otimizado)
CREATE EXTENSION IF NOT EXISTS "vector";       -- pgvector — embeddings IA
CREATE EXTENSION IF NOT EXISTS "btree_gin";    -- índices GIN compostos
CREATE EXTENSION IF NOT EXISTS "unaccent";     -- busca sem acentuação
