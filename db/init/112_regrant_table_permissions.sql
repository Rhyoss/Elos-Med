-- ============================================================================
-- DermaOS — Re-grant table permissions on all current tables
-- ----------------------------------------------------------------------------
-- `GRANT ... ON ALL TABLES IN SCHEMA x` only covers tables that exist at
-- grant time. Tables created in later migrations (e.g. scheduling_holds in
-- 006, lesions in 012, etc.) were not covered by the initial grants in 004.
-- Running this after all schema migrations ensures every role has the correct
-- privileges on every table, regardless of creation order.
-- ============================================================================

-- ─── shared ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA shared TO dermaos_app;
GRANT SELECT, INSERT, UPDATE         ON ALL TABLES IN SCHEMA shared TO dermaos_worker;
GRANT SELECT                         ON ALL TABLES IN SCHEMA shared TO dermaos_readonly;
GRANT ALL                            ON ALL TABLES IN SCHEMA shared TO dermaos_admin;

-- ─── clinical ────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA clinical TO dermaos_app;
GRANT SELECT, INSERT, UPDATE         ON ALL TABLES IN SCHEMA clinical TO dermaos_worker;
GRANT SELECT                         ON ALL TABLES IN SCHEMA clinical TO dermaos_readonly;
GRANT ALL                            ON ALL TABLES IN SCHEMA clinical TO dermaos_admin;

-- ─── omni ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA omni TO dermaos_app;
GRANT SELECT, INSERT, UPDATE         ON ALL TABLES IN SCHEMA omni TO dermaos_worker;
GRANT SELECT                         ON ALL TABLES IN SCHEMA omni TO dermaos_readonly;
GRANT ALL                            ON ALL TABLES IN SCHEMA omni TO dermaos_admin;

-- ─── supply ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA supply TO dermaos_app;
GRANT SELECT, INSERT, UPDATE         ON ALL TABLES IN SCHEMA supply TO dermaos_worker;
GRANT SELECT                         ON ALL TABLES IN SCHEMA supply TO dermaos_readonly;
GRANT ALL                            ON ALL TABLES IN SCHEMA supply TO dermaos_admin;

-- ─── financial ───────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA financial TO dermaos_app;
GRANT SELECT, INSERT, UPDATE         ON ALL TABLES IN SCHEMA financial TO dermaos_worker;
GRANT SELECT                         ON ALL TABLES IN SCHEMA financial TO dermaos_readonly;
GRANT ALL                            ON ALL TABLES IN SCHEMA financial TO dermaos_admin;

-- ─── analytics ───────────────────────────────────────────────────────────────
GRANT SELECT                         ON ALL TABLES IN SCHEMA analytics TO dermaos_app;
GRANT SELECT                         ON ALL TABLES IN SCHEMA analytics TO dermaos_worker;
GRANT SELECT                         ON ALL TABLES IN SCHEMA analytics TO dermaos_readonly;
GRANT ALL                            ON ALL TABLES IN SCHEMA analytics TO dermaos_admin;

-- ─── audit ───────────────────────────────────────────────────────────────────
GRANT INSERT ON ALL TABLES IN SCHEMA audit TO dermaos_app;
GRANT INSERT ON ALL TABLES IN SCHEMA audit TO dermaos_worker;
GRANT ALL    ON ALL TABLES IN SCHEMA audit TO dermaos_admin;

-- ─── sequences ───────────────────────────────────────────────────────────────
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA shared    TO dermaos_app, dermaos_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA clinical  TO dermaos_app, dermaos_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA omni      TO dermaos_app, dermaos_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA supply    TO dermaos_app, dermaos_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA financial TO dermaos_app, dermaos_worker;
