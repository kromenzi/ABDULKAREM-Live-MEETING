-- ====================================================================
-- ABDULKAREM LIVE MEETING — SUPABASE AUTH PROFILE BRIDGE
-- Links auth.users identity to tenant-scoped enterprise authorization.
-- Passwords remain exclusively managed by Supabase Auth.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  role user_role NOT NULL DEFAULT 'participant',
  company_id VARCHAR(128) NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_email_lower_key
  ON public.user_profiles (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_user_profiles_company
  ON public.user_profiles (company_id);

CREATE OR REPLACE FUNCTION public.set_user_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_user_profiles_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_self_select ON public.user_profiles;
CREATE POLICY user_profiles_self_select
  ON public.user_profiles
  FOR SELECT
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS user_profiles_self_update ON public.user_profiles;
CREATE POLICY user_profiles_self_update
  ON public.user_profiles
  FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid()
    AND role = (SELECT p.role FROM public.user_profiles p WHERE p.auth_user_id = auth.uid())
    AND company_id = (SELECT p.company_id FROM public.user_profiles p WHERE p.auth_user_id = auth.uid())
  );

-- Profile creation and privileged role/company changes are backend-only.
-- The backend uses the protected PostgreSQL connection, while clients cannot
-- self-provision an elevated role or move across tenants.
REVOKE INSERT, DELETE ON public.user_profiles FROM anon, authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT UPDATE (display_name, site_id) ON public.user_profiles TO authenticated;
