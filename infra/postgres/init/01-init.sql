-- =====================================================================
-- CX-ORBIT — PostgreSQL bootstrap (Phase 1)
--
-- Runs once on first container start (empty data volume). Keeps Phase 1
-- minimal: enables extensions and creates logical schemas that later
-- phases populate. Table DDL/migrations live with each owning service.
-- =====================================================================

-- UUID + crypto helpers used across services (ids, hashing).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Logical separation by bounded context (see ADR-009). Each owning
-- service manages its own tables within its schema.
CREATE SCHEMA IF NOT EXISTS customer;   -- Customer Service (Phase 5)
CREATE SCHEMA IF NOT EXISTS routing;    -- Routing Service (Phase 7)
CREATE SCHEMA IF NOT EXISTS config;     -- Business/system configuration
CREATE SCHEMA IF NOT EXISTS incident;   -- Incident definitions (Phase 10)
CREATE SCHEMA IF NOT EXISTS outbox;     -- Transactional outbox (ADR-005)

-- Sanity marker so `docker compose logs postgres` shows init ran.
DO $$
BEGIN
  RAISE NOTICE 'CX-ORBIT postgres init complete: extensions + schemas ready';
END $$;
