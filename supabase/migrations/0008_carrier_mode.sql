-- ============================================================
-- RoomLens Pro: Carrier Mode Schema
-- Migration: 0008_carrier_mode
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Extend insurer_profiles ────────────────────────────────
ALTER TABLE insurer_profiles
  ADD COLUMN IF NOT EXISTS carrier_slug                        TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS claims_platform                     TEXT,
  ADD COLUMN IF NOT EXISTS secondary_platform                  TEXT,
  ADD COLUMN IF NOT EXISTS tpa_name                            TEXT,
  ADD COLUMN IF NOT EXISTS vendor_program_name                 TEXT,
  ADD COLUMN IF NOT EXISTS vendor_onboarding_url               TEXT,
  ADD COLUMN IF NOT EXISTS vendor_phone                        TEXT,
  ADD COLUMN IF NOT EXISTS vendor_email                        TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_deadline_minutes  INT DEFAULT 120,
  ADD COLUMN IF NOT EXISTS site_arrival_deadline_minutes       INT DEFAULT 240,
  ADD COLUMN IF NOT EXISTS estimate_deadline_hours             INT DEFAULT 168,
  ADD COLUMN IF NOT EXISTS estimate_revision_hours             INT DEFAULT 24,
  ADD COLUMN IF NOT EXISTS final_invoice_deadline_days         INT DEFAULT 7,
  ADD COLUMN IF NOT EXISTS requires_24hr_report                BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_hazmat_3stage_photos       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_moisture_mapper_complete   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_moisture_score                  INT,
  ADD COLUMN IF NOT EXISTS requires_drybook                    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_ecoclaim_cert              BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS export_format                       TEXT DEFAULT 'ESX_XML',
  ADD COLUMN IF NOT EXISTS priority_score                      INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS market_share_pct                    DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS carrier_color                       TEXT DEFAULT '#64748b',
  ADD COLUMN IF NOT EXISTS carrier_logo_url                    TEXT,
  ADD COLUMN IF NOT EXISTS is_active                           BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_insurer_profiles_carrier_slug
  ON insurer_profiles(carrier_slug);

-- ── 2. carrier_checklist_templates ───────────────────────────
CREATE TABLE IF NOT EXISTS carrier_checklist_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_slug      TEXT NOT NULL,
  step_number       INT NOT NULL,
  step_category     TEXT NOT NULL CHECK (step_category IN ('photo','document','action','warning')),
  step_title        TEXT NOT NULL,
  step_description  TEXT,
  is_required       BOOLEAN DEFAULT true,
  trigger_condition TEXT,
  photo_label       TEXT,
  photo_direction   TEXT,
  warning_message   TEXT,
  blocking          BOOLEAN DEFAULT false,
  sort_order        INT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_carrier_slug
  ON carrier_checklist_templates(carrier_slug);

ALTER TABLE carrier_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "read_carrier_checklists"
  ON carrier_checklist_templates FOR SELECT USING (true);

-- ── 3. carrier_sla_timers ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS carrier_sla_timers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  carrier_slug   TEXT NOT NULL,
  timer_name     TEXT NOT NULL,
  deadline_at    TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','completed','overdue','warning')),
  completed_at   TIMESTAMPTZ,
  completed_by   UUID,
  notified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sla_timers_job_id ON carrier_sla_timers(job_id);
CREATE INDEX IF NOT EXISTS idx_sla_timers_status  ON carrier_sla_timers(status);

ALTER TABLE carrier_sla_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "rw_sla_timers"
  ON carrier_sla_timers FOR ALL USING (true);

-- ── 4. carrier_job_files ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS carrier_job_files (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  carrier_slug   TEXT NOT NULL,
  file_category  TEXT NOT NULL,
  file_name      TEXT,
  storage_path   TEXT,
  uploaded_by    UUID,
  upload_status  TEXT NOT NULL DEFAULT 'required'
                   CHECK (upload_status IN ('required','uploaded','approved','rejected')),
  carrier_notes  TEXT,
  uploaded_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carrier_files_job_id ON carrier_job_files(job_id);

ALTER TABLE carrier_job_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "rw_carrier_files"
  ON carrier_job_files FOR ALL USING (true);

-- ── 5. Seed: Intact Insurance ─────────────────────────────────
INSERT INTO insurer_profiles (
  insurer_name, carrier_slug, claims_platform, secondary_platform,
  tpa_name, vendor_program_name, vendor_onboarding_url, vendor_phone,
  report_24hr_deadline_hours, scope_deadline_days, equipment_max_days,
  requires_daily_logs, xactanalysis_integration, preferred_contact_method,
  emergency_contact_deadline_minutes, site_arrival_deadline_minutes,
  estimate_deadline_hours, estimate_revision_hours, final_invoice_deadline_days,
  requires_24hr_report, requires_hazmat_3stage_photos, export_format,
  priority_score, market_share_pct, carrier_color, is_active, notes
) VALUES (
  'Intact Insurance', 'intact', 'Cotality/Symbility + Xactimate', 'CoreLogic Workspace',
  NULL, 'Intact Rely Network',
  'https://www.intact.ca/en/personal-insurance/claims/contractors-repair-shops',
  '1-855-464-6228',
  24, 7, 3, true, false, 'phone',
  120, 240, 168, 24, 7,
  true, false, 'ESX_XML',
  5, 16.8, '#003DA5', true,
  'Largest Canadian P&C carrier. Intact owns On Side Restoration — independent contractors must out-document the captive vendor. Rely Network standards apply.'
) ON CONFLICT (carrier_slug) DO UPDATE SET
  claims_platform = EXCLUDED.claims_platform, priority_score = EXCLUDED.priority_score, updated_at = now();

-- Checklist: Intact
INSERT INTO carrier_checklist_templates
  (carrier_slug,step_number,step_category,step_title,step_description,is_required,photo_label,photo_direction,warning_message,blocking,sort_order)
VALUES
  ('intact',1,'warning','On Side Restoration Alert','Intact owns On Side Restoration. You are competing with a captive vendor. Every photo, log, and timestamp must be documented precisely.',true,NULL,NULL,'⚠️ INTACT ALERT: On Side Restoration is an Intact subsidiary. Out-document them at every step or lose the job.',false,10),
  ('intact',2,'photo','Before Mitigation — All Affected Rooms','Photograph every affected room BEFORE any work begins. Wide-angle corner shots.',true,'INTACT-BEFORE-[RoomName]','room_all_corners',NULL,true,20),
  ('intact',3,'photo','Exterior Elevations — All Sides','Photograph all four exterior elevations labeled by compass direction.',true,'INTACT-EXTERIOR-[Direction]','exterior_all_elevations',NULL,false,30),
  ('intact',4,'photo','Moisture Reading Locations','Photo of each moisture reading point with meter visible in frame.',true,'INTACT-MOISTURE-[Location]-[ReadingPct]','moisture_reading_point',NULL,false,40),
  ('intact',5,'photo','Equipment In Use','Photograph all dehumidifiers and air movers. Show make, model, serial number.',true,'INTACT-EQUIP-[EquipType]-[SerialNo]','equipment_placement',NULL,false,50),
  ('intact',6,'photo','After Mitigation — All Affected Rooms','Photograph every affected room AFTER work is complete. Must match before angles.',true,'INTACT-AFTER-[RoomName]','room_all_corners',NULL,true,60),
  ('intact',7,'document','Signed Work Authorization','Signed work authorization MUST be obtained from the property owner BEFORE any work begins.',true,NULL,NULL,NULL,true,70),
  ('intact',8,'document','Initial Scope Estimate','Submit estimate in Cotality/Symbility or Xactimate ESX format within 7 days.',true,NULL,NULL,NULL,false,80),
  ('intact',9,'document','Daily Drying Logs','Complete drying log for every site visit. Include psychrometric data, moisture readings.',true,NULL,NULL,NULL,false,90),
  ('intact',10,'document','Sub-Trade Quotes (>$10,000)','Any subcontracted work over $10,000 requires a written quote uploaded before approval.',true,NULL,NULL,NULL,false,100),
  ('intact',11,'document','Certificate of Completion','Upload signed certificate of completion upon job close-out.',true,NULL,NULL,NULL,true,110),
  ('intact',12,'action','Update Cotality/Symbility Job Status','Update job status at each phase: Assigned → Active → Drying → Repair → Complete.',true,NULL,NULL,NULL,false,120),
  ('intact',13,'action','Submit Final Invoice','Final invoice must be submitted within 7 days of job completion.',true,NULL,NULL,NULL,false,130),
  ('intact',14,'warning','Estimate Deadline Warning','Intact Rely Network: estimate overdue beyond 7 days triggers payment delay.',true,NULL,NULL,'⏰ DEADLINE: Estimate must be submitted within 7 days. Overdue = payment delay.',false,140);

-- ── 6. Seed: Aviva Canada ─────────────────────────────────────
INSERT INTO insurer_profiles (
  insurer_name, carrier_slug, claims_platform, secondary_platform,
  tpa_name, vendor_program_name, vendor_onboarding_url, vendor_phone,
  report_24hr_deadline_hours, scope_deadline_days, equipment_max_days,
  requires_daily_logs, xactanalysis_integration, preferred_contact_method,
  emergency_contact_deadline_minutes, site_arrival_deadline_minutes,
  estimate_deadline_hours, estimate_revision_hours, final_invoice_deadline_days,
  requires_24hr_report, requires_hazmat_3stage_photos, export_format,
  priority_score, market_share_pct, carrier_color, is_active, notes
) VALUES (
  'Aviva Canada', 'aviva', 'CoreLogic Workspace', 'Xactimate',
  NULL, 'Aviva Premier Network',
  'https://www.aviva.ca/en/business/risk-management/our-specialist-partner-network/',
  '1-800-387-4518',
  24, 5, 3, true, false, 'phone',
  30, 120, 48, 24, 7,
  true, true, 'CORELOGIC',
  5, 7.2, '#E30613', true,
  'STRICTEST SLAs in Canada. 30-min emergency contact. Daily drying logs mandatory. Hazmat 3-stage photos required. Ovation premium clients: 24hr estimate, 5-day scope.'
) ON CONFLICT (carrier_slug) DO UPDATE SET
  claims_platform = EXCLUDED.claims_platform, emergency_contact_deadline_minutes = EXCLUDED.emergency_contact_deadline_minutes, updated_at = now();

INSERT INTO carrier_checklist_templates
  (carrier_slug,step_number,step_category,step_title,step_description,is_required,photo_label,photo_direction,warning_message,blocking,sort_order)
VALUES
  ('aviva',1,'warning','🚨 30-MINUTE EMERGENCY CONTACT DEADLINE','Aviva Premier Network requires first contact with the policyholder within 30 minutes of job assignment.',true,NULL,NULL,'🚨 CRITICAL: Call policyholder within 30 MINUTES. Document the call time. Missing this = non-payment.',true,5),
  ('aviva',2,'warning','Ovation Premium Client Check','Check if this is an Ovation-tier policy in CoreLogic. Ovation clients: estimate due in 24 hours.',true,NULL,NULL,'⭐ OVATION CLIENT? Emergency estimate due in 24 HOURS (not 48). Scope due in 5 DAYS (not 7).',false,8),
  ('aviva',3,'photo','Room Photos — Labeled With Direction','Every room photo MUST include the room name AND compass direction in the filename.',true,'AVIVA-[RoomName]-[Direction]-[Sequence]','room_labeled_with_direction',NULL,true,10),
  ('aviva',4,'photo','Exterior Elevations — Labeled by Slope/Side','All exterior elevations labeled by slope and compass direction.',true,'AVIVA-EXTERIOR-[Side]-[Slope]','exterior_labeled_elevation',NULL,false,20),
  ('aviva',5,'photo','☢️ HAZMAT Stage 1 — Pre-Tearout','REQUIRED for Category 2/3 losses. Photograph hazardous materials BEFORE any demolition begins.',true,'AVIVA-HAZMAT-STAGE1-PRETEAROUT-[Room]','hazmat_pre_tearout','☢️ HAZMAT: This photo MUST be taken BEFORE demolition. Stage 1 of 3 — PRE-TEAROUT.',true,30),
  ('aviva',6,'photo','☢️ HAZMAT Stage 2 — Containment','Photograph containment barriers (poly sheeting, tension poles, zippers) fully installed.',true,'AVIVA-HAZMAT-STAGE2-CONTAINMENT-[Room]','hazmat_containment_setup','☢️ HAZMAT: Stage 2 of 3 — CONTAINMENT. Show poly sq ft, tension poles, zipper.',true,40),
  ('aviva',7,'photo','☢️ HAZMAT Stage 3 — Post-Remediation','Photograph the area after hazardous material removal and remediation is complete.',true,'AVIVA-HAZMAT-STAGE3-POSTREMEDIATION-[Room]','hazmat_post_remediation','☢️ HAZMAT: Stage 3 of 3 — POST-REMEDIATION. Area must be clear and clean.',true,50),
  ('aviva',8,'photo','Daily Drying Progress Photos','Photograph drying equipment and affected areas on EVERY site visit. Mandatory.',true,'AVIVA-DRYING-DAY[VisitNum]-[Room]','daily_drying_progress',NULL,true,60),
  ('aviva',9,'document','24-Hour Report','Upload 24-Hour Report to CoreLogic Workspace within 24 hours of INITIAL SITE VISIT.',true,NULL,NULL,'⏰ 24-HR REPORT: Must upload within 24 hours of first site visit. Missing this = SLA breach.',true,70),
  ('aviva',10,'document','Emergency Estimate','Upload Emergency Estimate to CoreLogic within 48 hours (24 hours for Ovation clients).',true,NULL,NULL,'⏰ EMERGENCY ESTIMATE: Due within 48 hrs (Ovation = 24 hrs).',true,80),
  ('aviva',11,'document','Repair Estimate','Upload full repair estimate within 7 days (5 days for Ovation). Xactimate or CoreLogic format.',true,NULL,NULL,NULL,false,90),
  ('aviva',12,'document','Daily Drying Logs','Submit drying log for EVERY site visit. Include psychrometric data, moisture readings.',true,NULL,NULL,NULL,true,100),
  ('aviva',13,'document','Signed Change Orders','Any scope change requires a signed change order uploaded BEFORE the additional work begins.',true,NULL,NULL,NULL,true,110),
  ('aviva',14,'document','Sub-Trade Quotes (>$10,000)','Written quotes required for all subcontracted work exceeding $10,000.',true,NULL,NULL,NULL,false,120),
  ('aviva',15,'document','Certificate of Completion','Signed certificate of completion required. Upload to CoreLogic Workspace.',true,NULL,NULL,NULL,true,130),
  ('aviva',16,'action','CoreLogic Workspace Status Updates','Update CoreLogic Workspace job status at EVERY phase.',true,NULL,NULL,'⚠️ AVIVA: CoreLogic status must be updated at every phase. Missing updates = SLA penalty.',true,140);

-- ── 7. Seed: Desjardins ───────────────────────────────────────
INSERT INTO insurer_profiles (
  insurer_name, carrier_slug, claims_platform, secondary_platform,
  tpa_name, vendor_program_name, vendor_onboarding_url, vendor_phone,
  report_24hr_deadline_hours, scope_deadline_days, equipment_max_days,
  requires_daily_logs, emergency_contact_deadline_minutes, site_arrival_deadline_minutes,
  estimate_deadline_hours, estimate_revision_hours, final_invoice_deadline_days,
  requires_24hr_report, requires_hazmat_3stage_photos, export_format,
  priority_score, market_share_pct, carrier_color, is_active, notes
) VALUES (
  'Desjardins General Insurance', 'desjardins', 'Cotality/Symbility', 'Xactimate',
  'Alacrity (if TPA assigned)', 'Desjardins Vendor Program',
  'https://www.desjardins.com/ca/about-us/supplier-centre/supplier-relations/',
  '1-800-224-7737',
  24, 7, 3, true, 120, 240, 168, 24, 7,
  true, false, 'ESX_XML',
  5, 10.35, '#009A44', true,
  'Second largest Canadian P&C carrier. Quebec-headquartered. If Alacrity TPA assigned, submit ALL docs to Alacrity portal.'
) ON CONFLICT (carrier_slug) DO UPDATE SET claims_platform = EXCLUDED.claims_platform, updated_at = now();

INSERT INTO carrier_checklist_templates
  (carrier_slug,step_number,step_category,step_title,step_description,is_required,photo_label,photo_direction,warning_message,blocking,sort_order)
VALUES
  ('desjardins',1,'warning','Bilingual Documentation Check','Desjardins is Quebec-headquartered. Check if bilingual documentation is required.',true,NULL,NULL,'🇫🇷 DESJARDINS: For Quebec-region claims, documentation may need to be bilingual. Confirm with adjuster.',false,5),
  ('desjardins',2,'warning','TPA Assignment Check','If an Alacrity TPA is assigned, submit ALL documents to the Alacrity portal.',true,NULL,NULL,'⚠️ TPA CHECK: Has Alacrity been assigned? If yes, ALL docs go to Alacrity portal, not Desjardins directly.',false,8),
  ('desjardins',3,'photo','Before Mitigation — All Affected Rooms','Photograph all affected rooms BEFORE any work begins.',true,'DESJ-BEFORE-[RoomName]','room_all_corners',NULL,true,10),
  ('desjardins',4,'photo','Moisture Reading Photos','Photo of each moisture reading location with meter display visible.',true,'DESJ-MOISTURE-[Location]-[Value]','moisture_reading',NULL,false,20),
  ('desjardins',5,'photo','Equipment Placed On Site','Photograph all placed equipment. Show make, model, serial.',true,'DESJ-EQUIP-[Type]-[Serial]','equipment_placement',NULL,false,30),
  ('desjardins',6,'photo','Daily Drying Progress','Photos of affected areas and running equipment on every site visit.',true,'DESJ-DRYING-DAY[N]-[Room]','daily_drying',NULL,false,40),
  ('desjardins',7,'photo','After Mitigation — All Affected Rooms','After photos of all affected rooms post-completion.',true,'DESJ-AFTER-[RoomName]','room_all_corners',NULL,true,50),
  ('desjardins',8,'document','Signed Work Authorization','Must be signed BEFORE any work begins. Upload to Cotality/Symbility.',true,NULL,NULL,NULL,true,60),
  ('desjardins',9,'document','Initial Estimate','Estimate in Cotality/Symbility or Xactimate ESX format. Due within 7 days.',true,NULL,NULL,NULL,false,70),
  ('desjardins',10,'document','Daily Drying Logs','Drying log for every site visit with psychrometric data.',true,NULL,NULL,NULL,false,80),
  ('desjardins',11,'document','Sub-Trade Quotes (>$10,000)','Written quotes for all subcontracted work exceeding $10,000.',true,NULL,NULL,NULL,false,90),
  ('desjardins',12,'document','Certificate of Completion','Upload signed completion certificate to Cotality/Symbility upon close-out.',true,NULL,NULL,NULL,true,100);

-- ── 8. Seed: The Co-operators ─────────────────────────────────
INSERT INTO insurer_profiles (
  insurer_name, carrier_slug, claims_platform,
  vendor_program_name, vendor_onboarding_url, vendor_phone, vendor_email,
  report_24hr_deadline_hours, scope_deadline_days, equipment_max_days,
  requires_daily_logs, emergency_contact_deadline_minutes, site_arrival_deadline_minutes,
  estimate_deadline_hours, estimate_revision_hours, final_invoice_deadline_days,
  requires_24hr_report, requires_hazmat_3stage_photos, export_format,
  priority_score, market_share_pct, carrier_color, is_active, notes
) VALUES (
  'The Co-operators', 'cooperators', 'Xactimate + Symbility',
  'Co-operators Claims Vendor Network',
  'https://www.cooperators.ca/en/accounts-services/make-a-claim/claims-vendor',
  '1-800-265-2662', 'Inquiries_cvm@cooperators.ca',
  24, 7, 3, true, 60, 240, 168, 24, 7,
  false, false, 'ESX_XML',
  5, 5.6, '#0066CC', true,
  'Strong Ontario and Ottawa presence. 1-hour emergency contact deadline. Vendor onboarding: email Inquiries_cvm@cooperators.ca.'
) ON CONFLICT (carrier_slug) DO UPDATE SET claims_platform = EXCLUDED.claims_platform, updated_at = now();

INSERT INTO carrier_checklist_templates
  (carrier_slug,step_number,step_category,step_title,step_description,is_required,photo_label,photo_direction,warning_message,blocking,sort_order)
VALUES
  ('cooperators',1,'warning','⏱️ 1-HOUR FIRST CONTACT DEADLINE','The Co-operators requires first contact with policyholder within 1 HOUR of job assignment.',true,NULL,NULL,'⏱️ CRITICAL: Contact policyholder within 60 MINUTES. Document exact call time.',true,5),
  ('cooperators',2,'warning','Vendor Onboarding Reminder','Not yet in Co-operators vendor network? Email Inquiries_cvm@cooperators.ca immediately.',true,NULL,NULL,'📧 NOT A CO-OP VENDOR YET? Email Inquiries_cvm@cooperators.ca to start onboarding (4-8 week approval).',false,8),
  ('cooperators',3,'photo','Before Mitigation — All Affected Areas','Photograph all damaged areas before any work begins.',true,'COOP-BEFORE-[Room]','room_all_corners',NULL,true,10),
  ('cooperators',4,'photo','Moisture Readings With Meter Visible','Photo at each moisture reading point. Meter display must be visible and readable.',true,'COOP-MOISTURE-[Location]-[Value]','moisture_reading',NULL,false,20),
  ('cooperators',5,'photo','Equipment Running On Site','All placed dehumidifiers and air movers photographed and running.',true,'COOP-EQUIP-[Type]-[Serial]','equipment_running',NULL,false,30),
  ('cooperators',6,'photo','After Mitigation — All Affected Areas','After completion photos matching before-photo angles.',true,'COOP-AFTER-[Room]','room_all_corners',NULL,true,40),
  ('cooperators',7,'document','Signed Work Authorization','Work authorization signed by property owner BEFORE work begins.',true,NULL,NULL,NULL,true,50),
  ('cooperators',8,'document','Estimate (Xactimate ESX Format)','Full estimate in Xactimate ESX format. Due within 7 days.',true,NULL,NULL,NULL,false,60),
  ('cooperators',9,'document','Daily Drying Logs','Complete drying log for every site visit.',true,NULL,NULL,NULL,false,70),
  ('cooperators',10,'document','Certificate of Completion','Signed completion certificate uploaded at close-out.',true,NULL,NULL,NULL,true,80),
  ('cooperators',11,'action','Document First Contact Call','Record exact time of first call to policyholder. Document in RoomLens job log.',true,NULL,NULL,'📞 LOG YOUR CALL: Record exact timestamp of first policyholder contact for SLA evidence.',true,90),
  ('cooperators',12,'action','Submit Final Invoice Within 7 Days','Final invoice must be submitted within 7 days of job completion.',true,NULL,NULL,NULL,false,100);

-- ── 9. Seed: Definity Financial ───────────────────────────────
INSERT INTO insurer_profiles (
  insurer_name, carrier_slug, claims_platform, secondary_platform,
  tpa_name, vendor_program_name, vendor_onboarding_url, vendor_phone,
  report_24hr_deadline_hours, scope_deadline_days, equipment_max_days,
  requires_daily_logs, emergency_contact_deadline_minutes, site_arrival_deadline_minutes,
  estimate_deadline_hours, estimate_revision_hours, final_invoice_deadline_days,
  requires_24hr_report, requires_hazmat_3stage_photos, export_format,
  priority_score, market_share_pct, carrier_color, is_active, notes
) VALUES (
  'Definity Financial (Economical)', 'definity', 'Cotality/Symbility', 'Contractor Connection Portal',
  'Contractor Connection', 'Definity/Economical Vendor Network',
  'https://www.contractorconnection.com/for-contractors',
  '1-888-708-0002',
  24, 7, 3, true, 60, 240, 168, 24, 7,
  true, false, 'ESX_XML',
  4, 4.0, '#FF6600', true,
  'Uses Contractor Connection TPA. All docs go through CC portal. Post-Travelers Canada acquisition: market share growing rapidly from 4% to ~8%.'
) ON CONFLICT (carrier_slug) DO UPDATE SET claims_platform = EXCLUDED.claims_platform, updated_at = now();

INSERT INTO carrier_checklist_templates
  (carrier_slug,step_number,step_category,step_title,step_description,is_required,photo_label,photo_direction,warning_message,blocking,sort_order)
VALUES
  ('definity',1,'warning','🚦 USE CONTRACTOR CONNECTION PORTAL','ALL documentation for Definity claims must be submitted through the Contractor Connection portal.',true,NULL,NULL,'🚦 PORTAL REQUIRED: All docs go to Contractor Connection portal. NOT to Definity directly.',true,5),
  ('definity',2,'warning','Growing Carrier — Priority Attention','Definity acquired Travelers Canada. Their market share is growing rapidly.',true,NULL,NULL,'📈 DEFINITY IS GROWING: Post-Travelers acquisition — market share doubling. Prioritize this relationship.',false,8),
  ('definity',3,'photo','Cause-of-Loss Photo','Clear photo showing the source and origin of the damage.',true,'DEFIN-COL-[LossSource]','cause_of_loss_origin','📸 CAUSE OF LOSS: This photo must clearly show the SOURCE of the damage.',true,10),
  ('definity',4,'photo','Before Mitigation — All Affected Rooms','Before photos of all affected rooms BEFORE work begins.',true,'DEFIN-BEFORE-[Room]','room_all_corners',NULL,true,20),
  ('definity',5,'photo','Moisture Readings','Photo at each moisture reading point with meter value visible.',true,'DEFIN-MOISTURE-[Location]-[Value]','moisture_reading',NULL,false,30),
  ('definity',6,'photo','Equipment In Use','Photos of all placed equipment showing make, model, and serial number.',true,'DEFIN-EQUIP-[Type]-[Serial]','equipment_placement',NULL,false,40),
  ('definity',7,'photo','Daily Drying Progress','Daily progress photos on every site visit.',true,'DEFIN-DRYING-DAY[N]-[Room]','daily_drying',NULL,false,50),
  ('definity',8,'photo','After Mitigation Complete','After completion photos matching before-photo angles.',true,'DEFIN-AFTER-[Room]','room_all_corners',NULL,true,60),
  ('definity',9,'document','Signed Work Authorization','Before any work — signed work authorization. Upload to Contractor Connection portal.',true,NULL,NULL,NULL,true,70),
  ('definity',10,'document','24-Hour Report','Submit 24-Hour Report to Contractor Connection portal within 24 hours of site visit.',true,NULL,NULL,'⏰ 24-HR REPORT: Submit to Contractor Connection portal within 24 hours.',true,80),
  ('definity',11,'document','Initial Estimate (Cotality Format)','Full estimate in Cotality/Symbility format. Submit via Contractor Connection portal.',true,NULL,NULL,NULL,false,90),
  ('definity',12,'document','Daily Drying Logs','Complete drying logs for every visit. Submit via Contractor Connection.',true,NULL,NULL,NULL,false,100),
  ('definity',13,'document','Certificate of Completion','Signed completion certificate uploaded to Contractor Connection portal.',true,NULL,NULL,NULL,true,110);

-- ── Verify ────────────────────────────────────────────────────
SELECT carrier_slug, insurer_name, emergency_contact_deadline_minutes, priority_score
FROM insurer_profiles WHERE carrier_slug IS NOT NULL ORDER BY priority_score DESC;

SELECT carrier_slug, COUNT(*) as checklist_items
FROM carrier_checklist_templates GROUP BY carrier_slug ORDER BY carrier_slug;
