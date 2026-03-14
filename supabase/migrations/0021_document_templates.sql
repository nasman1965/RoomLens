-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 0021: Document Templates, Auto-Fill & E-Signature System
-- RoomLensPro – Restoration Industry Document Management
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. document_templates ───────────────────────────────────────────────────
-- Stores blank PDF/HTML templates uploaded by admins, with merge-tag metadata
CREATE TABLE IF NOT EXISTS document_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,                         -- e.g. "Work Authorization Form"
  doc_type         TEXT NOT NULL                          -- 'waf','direction_to_pay','assignment_of_benefits','certificate_of_completion',
                                                          -- 'property_access','contents_release','photo_consent','mold_auth',
                                                          -- 'scope_of_work','final_report','subcontractor_agreement','other'
                   CHECK (doc_type IN (
                     'waf','direction_to_pay','assignment_of_benefits',
                     'certificate_of_completion','property_access','contents_release',
                     'photo_consent','mold_auth','scope_of_work','final_report',
                     'proof_of_loss','contents_inventory','liability_waiver',
                     'staff_nda','subcontractor_agreement','safety_briefing','other'
                   )),
  description      TEXT,
  storage_path     TEXT,                                  -- path in Supabase 'document-templates' bucket
  file_name        TEXT,
  file_size        INTEGER,
  requires_signature BOOLEAN DEFAULT true,
  signature_fields JSONB DEFAULT '[]',                   -- [{name, x, y, page, type: "signature"|"initials"|"date"}]
  merge_tags       JSONB DEFAULT '[]',                   -- [{tag, label, source_field}] e.g. [{tag:"{{client_name}}", label:"Client Name", source_field:"jobs.contact_name"}]
  is_active        BOOLEAN DEFAULT true,
  sort_order       INTEGER DEFAULT 0,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. job_documents ────────────────────────────────────────────────────────
-- Tracks every document generated / sent for a specific job
CREATE TABLE IF NOT EXISTS job_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  template_id       UUID REFERENCES document_templates(id) ON DELETE SET NULL,
  doc_type          TEXT NOT NULL,
  name              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft'        -- 'draft','sent','viewed','signed','declined','expired'
                    CHECK (status IN ('draft','sent','viewed','signed','declined','expired')),
  filled_data       JSONB DEFAULT '{}',                  -- snapshot of merged field values at send time
  storage_path      TEXT,                                -- final (signed) PDF path in 'documents' bucket
  signed_pdf_path   TEXT,                                -- signed version path
  sent_to_email     TEXT,
  sent_to_phone     TEXT,
  sent_at           TIMESTAMPTZ,
  viewed_at         TIMESTAMPTZ,
  signed_at         TIMESTAMPTZ,
  signed_by_name    TEXT,
  signed_by_ip      TEXT,
  signature_data    TEXT,                                -- base64 SVG/PNG of drawn signature
  sign_token        UUID DEFAULT gen_random_uuid(),      -- public signing token (no auth required)
  sign_token_expires TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  notes             TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_document_templates_company  ON document_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_doc_type ON document_templates(doc_type);
CREATE INDEX IF NOT EXISTS idx_job_documents_job_id        ON job_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_status        ON job_documents(status);
CREATE INDEX IF NOT EXISTS idx_job_documents_sign_token    ON job_documents(sign_token);

-- ─── 4. Updated_at trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_templates_updated ON document_templates;
CREATE TRIGGER trg_document_templates_updated
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_document_updated_at();

DROP TRIGGER IF EXISTS trg_job_documents_updated ON job_documents;
CREATE TRIGGER trg_job_documents_updated
  BEFORE UPDATE ON job_documents
  FOR EACH ROW EXECUTE FUNCTION update_document_updated_at();

-- ─── 5. Row Level Security ───────────────────────────────────────────────────
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_documents       ENABLE ROW LEVEL SECURITY;

-- Templates: company admins manage, all authenticated can read active ones
DROP POLICY IF EXISTS doc_templates_read   ON document_templates;
DROP POLICY IF EXISTS doc_templates_write  ON document_templates;

CREATE POLICY doc_templates_read ON document_templates
  FOR SELECT TO authenticated
  USING (
    company_id = auth.uid()
    OR company_id IN (
      SELECT tm.user_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.is_active = true
    )
    OR company_id IN (
      SELECT j.created_by FROM jobs j
      JOIN team_members tm2 ON tm2.user_id = auth.uid()
      WHERE j.company_id = tm2.user_id
    )
  );

CREATE POLICY doc_templates_write ON document_templates
  FOR ALL TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

-- Job documents: job's company can manage
DROP POLICY IF EXISTS job_docs_read  ON job_documents;
DROP POLICY IF EXISTS job_docs_write ON job_documents;
DROP POLICY IF EXISTS job_docs_sign  ON job_documents;

CREATE POLICY job_docs_read ON job_documents
  FOR SELECT TO authenticated
  USING (
    job_id IN (SELECT id FROM jobs WHERE created_by = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY job_docs_write ON job_documents
  FOR ALL TO authenticated
  USING (
    job_id IN (SELECT id FROM jobs WHERE created_by = auth.uid())
    OR created_by = auth.uid()
  )
  WITH CHECK (
    job_id IN (SELECT id FROM jobs WHERE created_by = auth.uid())
    OR created_by = auth.uid()
  );

-- Public signing: unauthenticated clients can update their own doc via sign_token
CREATE POLICY job_docs_sign ON job_documents
  FOR UPDATE TO anon, authenticated
  USING (sign_token = current_setting('request.jwt.claims', true)::jsonb->>'sign_token'
         OR sign_token IS NOT NULL)  -- allow via API route with service key
  WITH CHECK (true);

-- ─── 6. Storage bucket for templates ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-templates',
  'document-templates',
  false,
  52428800,  -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg','image/jpg','image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Template bucket RLS
DROP POLICY IF EXISTS tmpl_upload  ON storage.objects;
DROP POLICY IF EXISTS tmpl_select  ON storage.objects;
DROP POLICY IF EXISTS tmpl_delete  ON storage.objects;

CREATE POLICY tmpl_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY tmpl_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'document-templates'
         AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY tmpl_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'document-templates'
         AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─── 7. Seed default merge tags reference (informational, stored as comment) ──
-- Available merge tags for templates:
-- {{client_name}}        → jobs.contact_name
-- {{client_phone}}       → jobs.contact_phone
-- {{client_email}}       → jobs.contact_email
-- {{property_address}}   → jobs.address
-- {{claim_number}}       → jobs.claim_number
-- {{insurance_company}}  → jobs.insurance_company
-- {{adjuster_name}}      → jobs.adjuster_name
-- {{adjuster_phone}}     → jobs.adjuster_phone
-- {{date_of_loss}}       → jobs.date_of_loss
-- {{job_number}}         → jobs.job_number (or id)
-- {{company_name}}       → users.company_name
-- {{tech_name}}          → dispatched tech name
-- {{today_date}}         → current date at signing
-- {{sign_date}}          → date signed

-- ─── 8. Verify ────────────────────────────────────────────────────────────────
SELECT
  'document_templates' AS table_name, COUNT(*) AS rows FROM document_templates
UNION ALL
SELECT 'job_documents', COUNT(*) FROM job_documents
UNION ALL
SELECT 'storage_bucket', COUNT(*) FROM storage.buckets WHERE id = 'document-templates';
