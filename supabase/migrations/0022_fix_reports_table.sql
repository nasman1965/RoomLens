-- ============================================================
-- 0022_fix_reports_table.sql  (updated to match real schema)
-- Real reports table columns: id, job_id, report_type, pdf_url,
-- shared_via, share_token, share_expires, generated_at
-- Only fixes the report_type CHECK constraint
-- ============================================================

ALTER TABLE public.reports 
  DROP CONSTRAINT IF EXISTS reports_report_type_check;

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

SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.reports'::regclass 
AND contype = 'c';
