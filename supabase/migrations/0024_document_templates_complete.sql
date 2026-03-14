-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 0024: Document Templates Complete (idempotent re-run safe)
-- Fixes: uses auth.users for FK, corrects RLS to use user_id pattern
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. document_templates ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  doc_type           TEXT NOT NULL
                     CHECK (doc_type IN (
                       'waf','direction_to_pay','assignment_of_benefits',
                       'certificate_of_completion','property_access','contents_release',
                       'photo_consent','mold_auth','scope_of_work','final_report',
                       'proof_of_loss','contents_inventory','liability_waiver',
                       'staff_nda','subcontractor_agreement','safety_briefing','other'
                     )),
  description        TEXT,
  storage_path       TEXT,
  file_name          TEXT,
  file_size          INTEGER,
  -- Inline HTML template body (supports {{merge_tags}})
  body_html          TEXT,
  requires_signature BOOLEAN DEFAULT true,
  signature_fields   JSONB DEFAULT '[]',
  merge_tags         JSONB DEFAULT '[]',
  is_active          BOOLEAN DEFAULT true,
  sort_order         INTEGER DEFAULT 0,
  created_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. job_documents ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  template_id        UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
  doc_type           TEXT NOT NULL DEFAULT 'other',
  name               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','viewed','signed','declined','expired')),
  filled_data        JSONB DEFAULT '{}',
  body_html_filled   TEXT,            -- rendered HTML with merge tags replaced
  storage_path       TEXT,
  signed_pdf_path    TEXT,
  sent_to_email      TEXT,
  sent_to_phone      TEXT,
  sent_at            TIMESTAMPTZ,
  viewed_at          TIMESTAMPTZ,
  signed_at          TIMESTAMPTZ,
  signed_by_name     TEXT,
  signed_by_ip       TEXT,
  signature_data     TEXT,
  sign_token         UUID DEFAULT gen_random_uuid(),
  sign_token_expires TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  notes              TEXT,
  created_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_doc_templates_company  ON public.document_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_doc_type ON public.document_templates(doc_type);
CREATE INDEX IF NOT EXISTS idx_doc_templates_active   ON public.document_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_job_docs_job_id        ON public.job_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_job_docs_status        ON public.job_documents(status);
CREATE INDEX IF NOT EXISTS idx_job_docs_sign_token    ON public.job_documents(sign_token);
CREATE INDEX IF NOT EXISTS idx_job_docs_created_by    ON public.job_documents(created_by);

-- ─── 4. Updated_at trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doc_templates_updated ON public.document_templates;
CREATE TRIGGER trg_doc_templates_updated
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_job_docs_updated ON public.job_documents;
CREATE TRIGGER trg_job_docs_updated
  BEFORE UPDATE ON public.job_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 5. Row Level Security ───────────────────────────────────────────────────
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_documents       ENABLE ROW LEVEL SECURITY;

-- Templates: owner manages, team members can read
DROP POLICY IF EXISTS doc_templates_select ON public.document_templates;
DROP POLICY IF EXISTS doc_templates_insert ON public.document_templates;
DROP POLICY IF EXISTS doc_templates_update ON public.document_templates;
DROP POLICY IF EXISTS doc_templates_delete ON public.document_templates;

CREATE POLICY doc_templates_select ON public.document_templates
  FOR SELECT TO authenticated
  USING (company_id = auth.uid());

CREATE POLICY doc_templates_insert ON public.document_templates
  FOR INSERT TO authenticated
  WITH CHECK (company_id = auth.uid());

CREATE POLICY doc_templates_update ON public.document_templates
  FOR UPDATE TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

CREATE POLICY doc_templates_delete ON public.document_templates
  FOR DELETE TO authenticated
  USING (company_id = auth.uid());

-- Job documents: job owner manages
DROP POLICY IF EXISTS job_docs_select ON public.job_documents;
DROP POLICY IF EXISTS job_docs_insert ON public.job_documents;
DROP POLICY IF EXISTS job_docs_update ON public.job_documents;
DROP POLICY IF EXISTS job_docs_delete ON public.job_documents;
DROP POLICY IF EXISTS job_docs_sign   ON public.job_documents;

CREATE POLICY job_docs_select ON public.job_documents
  FOR SELECT TO authenticated
  USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY job_docs_insert ON public.job_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY job_docs_update ON public.job_documents
  FOR UPDATE TO authenticated
  USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  )
  WITH CHECK (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY job_docs_delete ON public.job_documents
  FOR DELETE TO authenticated
  USING (
    job_id IN (SELECT id FROM public.jobs WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

-- Public signing: anon can update via sign_token (no auth required for clients)
CREATE POLICY job_docs_sign ON public.job_documents
  FOR UPDATE TO anon, authenticated
  USING (sign_token IS NOT NULL)
  WITH CHECK (true);

-- ─── 6. Storage bucket for document templates ─────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-templates',
  'document-templates',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg','image/jpg','image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Template storage RLS (scoped to userId folder)
DROP POLICY IF EXISTS tmpl_bucket_upload  ON storage.objects;
DROP POLICY IF EXISTS tmpl_bucket_select  ON storage.objects;
DROP POLICY IF EXISTS tmpl_bucket_delete  ON storage.objects;

CREATE POLICY tmpl_bucket_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY tmpl_bucket_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY tmpl_bucket_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 7. Verify ────────────────────────────────────────────────────────────────
SELECT
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('document_templates', 'job_documents')
GROUP BY table_name
ORDER BY table_name;
