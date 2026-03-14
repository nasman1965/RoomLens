-- ============================================================
-- 0022_fix_reports_table.sql
-- Creates reports table if missing, or fixes the report_type
-- CHECK constraint to match what the frontend sends.
-- Frontend values: '24hr_report', 'daily_moisture', 'scope_estimate', 'completion_report'
-- Run in: https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new
-- ============================================================

-- ── 1. Create reports table if it doesn't exist ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  report_type TEXT        NOT NULL,
  content     TEXT,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Drop the broken CHECK constraint (wrong allowed values) ────────────────
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_report_type_check;

-- ── 3. Add the correct CHECK constraint matching frontend values ──────────────
ALTER TABLE public.reports
  ADD CONSTRAINT reports_report_type_check
  CHECK (report_type IN (
    '24hr_report',
    'daily_moisture',
    'scope_estimate',
    'completion_report',
    'adjuster_summary',
    'equipment_log',
    'photo_report',
    'final_report',
    'custom'
  ));

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reports_job_id     ON public.reports(job_id);
CREATE INDEX IF NOT EXISTS idx_reports_type       ON public.reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- ── 5. Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS Policies ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reports_select" ON public.reports;
CREATE POLICY "reports_select"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR job_id IN (
      SELECT id FROM public.jobs WHERE created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reports_insert" ON public.reports;
CREATE POLICY "reports_insert"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (
    job_id IN (
      SELECT id FROM public.jobs WHERE created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reports_delete" ON public.reports;
CREATE POLICY "reports_delete"
  ON public.reports FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR job_id IN (
      SELECT id FROM public.jobs WHERE created_by = auth.uid()
    )
  );

-- ── 7. Verify ─────────────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'reports'
ORDER BY ordinal_position;

-- Also verify the constraint is correct
SELECT
  conname   AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.reports'::regclass
  AND contype  = 'c';
