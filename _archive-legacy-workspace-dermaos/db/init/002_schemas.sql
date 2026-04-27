-- ============================================================================
-- DermaOS — Database Schemas
-- Cada schema isola um domínio da plataforma
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS shared;     -- Entidades compartilhadas (clinics, users, patients)
CREATE SCHEMA IF NOT EXISTS clinical;   -- Prontuários, consultas, imagens, protocolos
CREATE SCHEMA IF NOT EXISTS omni;       -- Comunicação omnichannel, IA de atendimento
CREATE SCHEMA IF NOT EXISTS supply;     -- Gestão de estoque e suprimentos hospitalares
CREATE SCHEMA IF NOT EXISTS financial;  -- Financeiro, faturamento, NF-e
CREATE SCHEMA IF NOT EXISTS analytics; -- BI, métricas agregadas, dashboards
CREATE SCHEMA IF NOT EXISTS audit;      -- Logs de auditoria, eventos de domínio

-- Comentários documentando intenção de cada schema
COMMENT ON SCHEMA shared    IS 'Entidades base compartilhadas entre todos os módulos';
COMMENT ON SCHEMA clinical  IS 'Dados clínicos: prontuários, imagens, protocolos LGPD PHI';
COMMENT ON SCHEMA omni      IS 'Comunicação omnichannel: WhatsApp, email, chat, IA';
COMMENT ON SCHEMA supply    IS 'Supply chain: estoque, fornecedores, pedidos, NF-e';
COMMENT ON SCHEMA financial IS 'Financeiro: caixa, contas, cobranças, relatórios';
COMMENT ON SCHEMA analytics IS 'Analytics: métricas pré-calculadas, cubos OLAP';
COMMENT ON SCHEMA audit     IS 'Trilha de auditoria LGPD: quem, o quê, quando, de onde';
