-- ============================================================
-- Multi-Tenant Architecture for RoomLens Pro
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. TENANTS (subscriber companies) ────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,        -- e.g. "11restoration" → 11restoration.roomlenspro.com
  company_name  TEXT NOT NULL,
  owner_email   TEXT NOT NULL,
  owner_name    TEXT,
  phone         TEXT,
  address       TEXT,
  logo_url      TEXT,
  plan          TEXT NOT NULL DEFAULT 'starter',  -- free | starter | pro | enterprise
  plan_price    NUMERIC(10,2) DEFAULT 0,
  billing_cycle TEXT DEFAULT 'monthly',           -- monthly | annual
  status        TEXT NOT NULL DEFAULT 'active',   -- active | suspended | cancelled | trial
  trial_ends_at TIMESTAMPTZ,
  billing_starts_at TIMESTAMPTZ,
  next_billing_at   TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  max_users     INT DEFAULT 5,
  max_jobs      INT DEFAULT 50,
  max_storage_gb NUMERIC DEFAULT 10,
  integrations  JSONB DEFAULT '{}',    -- { clockinproof: {api_key: "..."}, encircle: {...} }
  notes         TEXT,                  -- super admin internal notes
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. TENANT USERS (staff per company) ──────────────────────
-- Links Supabase auth users to a tenant with a role
CREATE TABLE IF NOT EXISTS tenant_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'staff',   -- owner | admin | staff
  is_active   BOOLEAN DEFAULT TRUE,
  invited_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- ── 3. SUPER ADMINS (Nasser only) ────────────────────────────
CREATE TABLE IF NOT EXISTS super_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. SUBSCRIPTION PLANS (catalog) ──────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,   -- Free | Starter | Pro | Enterprise
  slug         TEXT UNIQUE NOT NULL,
  price_monthly NUMERIC(10,2) DEFAULT 0,
  price_annual  NUMERIC(10,2) DEFAULT 0,
  max_users    INT DEFAULT 1,
  max_jobs     INT DEFAULT 10,
  max_storage_gb NUMERIC DEFAULT 1,
  features     JSONB DEFAULT '[]',
  is_active    BOOLEAN DEFAULT TRUE,
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. INVOICES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL,
  currency     TEXT DEFAULT 'usd',
  status       TEXT DEFAULT 'pending',   -- pending | paid | failed | refunded
  period_start TIMESTAMPTZ,
  period_end   TIMESTAMPTZ,
  stripe_invoice_id TEXT,
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. SUPER ADMIN AUDIT LOG ──────────────────────────────────
CREATE TABLE IF NOT EXISTS super_admin_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,     -- e.g. 'tenant.created', 'tenant.suspended'
  target_type TEXT,              -- 'tenant' | 'user' | 'plan'
  target_id   UUID,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Add tenant_id to existing jobs/team_members ────────────
ALTER TABLE jobs         ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE damage_photos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- ── 8. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_slug       ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status     ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user   ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant         ON jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant     ON invoices(tenant_id);

-- ── 9. Default subscription plans ────────────────────────────
INSERT INTO subscription_plans (name, slug, price_monthly, price_annual, max_users, max_jobs, max_storage_gb, features, sort_order)
VALUES
  ('Free',       'free',       0,    0,    1,   5,   1,  '["5 jobs", "1 user", "1GB storage", "Basic reporting"]', 0),
  ('Starter',    'starter',    49,   470,  3,   25,  10, '["25 jobs", "3 users", "10GB storage", "Photo upload", "Reports", "Email support"]', 1),
  ('Pro',        'pro',        99,   950,  10,  999, 50, '["Unlimited jobs", "10 users", "50GB storage", "Stop job flow", "Team management", "Priority support"]', 2),
  ('Enterprise', 'enterprise', 199,  1900, 25,  999, 200,'["Unlimited everything", "25 users", "200GB storage", "Custom integrations", "Dedicated support", "White label"]', 3)
ON CONFLICT (slug) DO NOTHING;

-- ── 10. RLS Policies ─────────────────────────────────────────
ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins     ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_log  ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "super_admin_all_tenants" ON tenants
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

CREATE POLICY "super_admin_all_tenant_users" ON tenant_users
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

CREATE POLICY "super_admin_all_invoices" ON invoices
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

CREATE POLICY "super_admin_all_log" ON super_admin_log
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

-- Tenant owners/admins can read their own tenant
CREATE POLICY "tenant_users_read_own_tenant" ON tenants
  FOR SELECT TO authenticated
  USING (id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Tenant users can read members of their tenant
CREATE POLICY "tenant_users_read_own_members" ON tenant_users
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Anyone authenticated can read active plans
CREATE POLICY "plans_public_read" ON subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = TRUE);

-- Super admins can read their own entry
CREATE POLICY "super_admins_self_read" ON super_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── 11. Insert yourself as super admin ────────────────────────
-- IMPORTANT: Replace the email below with your actual Supabase user ID
-- Run this AFTER you have logged in at least once:
-- 
-- INSERT INTO super_admins (user_id, email)
-- SELECT id, email FROM auth.users WHERE email = 'nasser.od@11restoration.com'
-- ON CONFLICT (user_id) DO NOTHING;

SELECT 'Multi-tenant migration complete ✅' as status;
