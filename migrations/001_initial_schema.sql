-- ====================================================================
-- ABDULKAREM LIVE MEETING & HSE ENTERPRISE INTEGRATION
-- Supabase PostgreSQL Migration: 001_initial_schema.sql
-- Complete Persistent Relational Storage & Row-Level Security
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'host',
    'co-host',
    'participant',
    'hse_officer',
    'hse_manager',
    'admin'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE meeting_status AS ENUM (
    'scheduled',
    'active',
    'ended',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE capa_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE action_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. COMPANIES & PROJECTS
CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company_id VARCHAR(128) REFERENCES companies(id) ON DELETE CASCADE,
  site_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. USERS (Enterprise Accounts & Verified Credentials)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  role user_role NOT NULL DEFAULT 'participant',
  company_id VARCHAR(128) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MEETINGS TABLE
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(64) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  host_id VARCHAR(128) NOT NULL,
  company_id VARCHAR(128) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status meeting_status DEFAULT 'active',
  is_locked BOOLEAN DEFAULT FALSE,
  waiting_room_enabled BOOLEAN DEFAULT FALSE,
  password_hash VARCHAR(255),
  
  -- HSE Safety Board Context Metadata
  site_id VARCHAR(128),
  project_id VARCHAR(128),
  ncr_number VARCHAR(64),
  incident_id VARCHAR(64),
  capa_id VARCHAR(64),
  toolbox_topic VARCHAR(255),
  hse_category VARCHAR(64) DEFAULT 'general',
  hse_context_json JSONB DEFAULT '{}'::jsonb,
  
  scheduled_start_at TIMESTAMPTZ,
  actual_start_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INVITATIONS (Bound to specific room_code and company_id)
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(64) NOT NULL REFERENCES meetings(room_code) ON DELETE CASCADE,
  company_id VARCHAR(128) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  role user_role DEFAULT 'participant',
  max_uses INT DEFAULT 1,
  used_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(128) PRIMARY KEY,
  room_code VARCHAR(64) NOT NULL REFERENCES meetings(room_code) ON DELETE CASCADE,
  sender_peer_id VARCHAR(128) NOT NULL,
  sender_name VARCHAR(128) NOT NULL,
  sender_role user_role DEFAULT 'participant',
  text TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. MEETING DECISIONS
CREATE TABLE IF NOT EXISTS meeting_decisions (
  id VARCHAR(128) PRIMARY KEY,
  room_code VARCHAR(64) NOT NULL REFERENCES meetings(room_code) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  decision_text TEXT NOT NULL,
  approved_by VARCHAR(128) NOT NULL,
  status VARCHAR(32) DEFAULT 'approved',
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ACTION ITEMS & CAPA
CREATE TABLE IF NOT EXISTS action_items (
  id VARCHAR(128) PRIMARY KEY,
  room_code VARCHAR(64) NOT NULL REFERENCES meetings(room_code) ON DELETE CASCADE,
  task TEXT NOT NULL,
  assignee VARCHAR(128) NOT NULL,
  due_date VARCHAR(64) NOT NULL,
  priority capa_priority DEFAULT 'medium',
  status action_status DEFAULT 'pending',
  hse_ref VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AUDIT LOGS (Security and sensitive operations - no passwords or secrets stored)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(128) PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  actor_id VARCHAR(128) NOT NULL,
  actor_name VARCHAR(128) NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_id VARCHAR(128),
  details_json JSONB DEFAULT '{}'::jsonb,
  ip VARCHAR(45)
);

-- 11. INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_meetings_room_code ON meetings(room_code);
CREATE INDEX IF NOT EXISTS idx_meetings_company ON meetings(company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_room ON invitations(room_code);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_code);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- 12. ROW-LEVEL SECURITY (RLS) POLICIES
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Meetings: accessible to company members or invited users
CREATE POLICY meetings_company_isolation ON meetings
  FOR ALL
  USING (
    company_id = current_setting('request.jwt.claims', true)::json->>'companyId'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );

-- Invitations: visible to host, co-host, or company admin
CREATE POLICY invitations_company_isolation ON invitations
  FOR ALL
  USING (
    company_id = current_setting('request.jwt.claims', true)::json->>'companyId'
  );

-- Audit logs: readable only by admin or meeting host
CREATE POLICY audit_logs_access ON audit_logs
  FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );

-- Hardened tenant boundary: administrators remain scoped to their company.
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_company_scope ON companies;
CREATE POLICY companies_company_scope ON companies
  FOR ALL USING (id = current_setting('request.jwt.claims', true)::json->>'companyId');

DROP POLICY IF EXISTS projects_company_scope ON projects;
CREATE POLICY projects_company_scope ON projects
  FOR ALL USING (company_id = current_setting('request.jwt.claims', true)::json->>'companyId');

DROP POLICY IF EXISTS users_company_scope ON users;
CREATE POLICY users_company_scope ON users
  FOR ALL USING (company_id = current_setting('request.jwt.claims', true)::json->>'companyId');

CREATE UNIQUE INDEX IF NOT EXISTS companies_id_company_key ON companies(id);
CREATE UNIQUE INDEX IF NOT EXISTS meetings_room_company_key ON meetings(room_code, company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_site ON projects(company_id, site_id);
