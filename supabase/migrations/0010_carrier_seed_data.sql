-- ============================================================
-- RoomLens Pro: Carrier Seed Data (corrected)
-- Migration: 0010_carrier_seed_data
-- 
-- NOTE: insurer_profiles requires user_id (multi-tenant table).
-- Replace the UUID below with your user's UUID from auth.users.
-- This was run with user: nasser.o@911restoration.com
-- ============================================================

-- Intact Insurance
INSERT INTO insurer_profiles (
  user_id, insurer_name, carrier_slug, claims_platform, secondary_platform,
  tpa_name, vendor_program_name, vendor_onboarding_url, vendor_phone,
  report_24hr_deadline_hours, scope_deadline_days, equipment_max_days,
  requires_daily_logs, xactanalysis_integration, preferred_contact_method,
  emergency_contact_deadline_minutes, site_arrival_deadline_minutes,
  estimate_deadline_hours, estimate_revision_hours, final_invoice_deadline_days,
  requires_24hr_report, requires_hazmat_3stage_photos, export_format,
  priority_score, market_share_pct, carrier_color, is_active, notes
) VALUES (
  '5a5d58fe-b41e-4cb3-9054-8df9020e0496',
  'Intact Insurance', 'intact', 'Cotality/Symbility + Xactimate', 'CoreLogic Workspace',
  NULL, 'Intact Rely Network',
  'https://www.intact.ca/en/personal-insurance/claims/contractors-repair-shops',
  '1-855-464-6228',
  24, 7, 3, true, false, 'phone',
  120, 240, 168, 24, 7, true, false, 'ESX_XML',
  5, 16.8, '#003DA5', true,
  'Largest Canadian P&C carrier. Intact owns On Side Restoration — out-document the captive vendor.'
) ON CONFLICT (carrier_slug) DO UPDATE SET
  claims_platform = EXCLUDED.claims_platform,
  priority_score = EXCLUDED.priority_score,
  updated_at = now();

-- Aviva Canada
INSERT INTO insurer_profiles (
  user_id, insurer_name, carrier_slug, claims_platform, secondary_platform,
  tpa_name, vendor_program_name, vendor_onboarding_url, vendor_phone,
  report_24hr_deadline_hours, scope_deadline_days, equipment_max_days,
  requires_daily_logs, xactanalysis_integration, preferred_contact_method,
  emergency_contact_deadline_minutes, site_arrival_deadline_minutes,
  estimate_deadline_hours, estimate_revision_hours, final_invoice_deadline_days,
  requires_24hr_report, requires_hazmat_3stage_photos, export_format,
  priority_score, market_share_pct, carrier_color, is_active, notes
) VALUES (
  '5a5d58fe-b41e-4cb3-9054-8df9020e0496',
  'Aviva Canada', 'aviva', 'CoreLogic Workspace', 'Xactimate',
  NULL, 'Aviva Premier Network',
  'https://www.aviva.ca/en/business/risk-management/our-specialist-partner-network/',
  '1-800-387-4518',
  24, 5, 3, true, false, 'phone',
  30, 120, 48, 24, 7, true, true, 'CORELOGIC',
  5, 7.2, '#E30613', true,
  'STRICTEST SLAs in Canada. 30-min emergency contact. Hazmat 3-stage photos required.'
) ON CONFLICT (carrier_slug) DO UPDATE SET
  emergency_contact_deadline_minutes = EXCLUDED.emergency_contact_deadline_minutes,
  updated_at = now();

-- Desjardins General Insurance
INSERT INTO insurer_profiles (
  user_id, insurer_name, carrier_slug, claims_platform, secondary_platform,
  tpa_name, vendor_program_name, vendor_onboarding_url, vendor_phone,
  report_24hr_deadline_hours, scope_deadline_days, equipment_max_days,
  requires_daily_logs, emergency_contact_deadline_minutes, site_arrival_deadline_minutes,
  estimate_deadline_hours, estimate_revision_hours, final_invoice_deadline_days,
  requires_24hr_report, requires_hazmat_3stage_photos, export_format,
  priority_score, market_share_pct, carrier_color, is_active, notes
) VALUES (
  '5a5d58fe-b41e-4cb3-9054-8df9020e0496',
  'Desjardins General Insurance', 'desjardins', 'Cotality/Symbility', 'Xactimate',
  'Alacrity (if TPA assigned)', 'Desjardins Vendor Program',
  'https://www.desjardins.com/ca/about-us/supplier-centre/supplier-relations/',
  '1-800-224-7737',
  24, 7, 3, true, 120, 240, 168, 24, 7, true, false, 'ESX_XML',
  5, 10.35, '#009A44', true,
  'Second largest Canadian P&C carrier. If Alacrity TPA assigned, submit ALL docs to Alacrity portal.'
) ON CONFLICT (carrier_slug) DO UPDATE SET
  claims_platform = EXCLUDED.claims_platform,
  updated_at = now();

-- The Co-operators
INSERT INTO insurer_profiles (
  user_id, insurer_name, carrier_slug, claims_platform,
  vendor_program_name, vendor_onboarding_url, vendor_phone, vendor_email,
  report_24hr_deadline_hours, scope_deadline_days, equipment_max_days,
  requires_daily_logs, emergency_contact_deadline_minutes, site_arrival_deadline_minutes,
  estimate_deadline_hours, estimate_revision_hours, final_invoice_deadline_days,
  requires_24hr_report, requires_hazmat_3stage_photos, export_format,
  priority_score, market_share_pct, carrier_color, is_active, notes
) VALUES (
  '5a5d58fe-b41e-4cb3-9054-8df9020e0496',
  'The Co-operators', 'cooperators', 'Xactimate + Symbility',
  'Co-operators Claims Vendor Network',
  'https://www.cooperators.ca/en/accounts-services/make-a-claim/claims-vendor',
  '1-800-265-2662', 'Inquiries_cvm@cooperators.ca',
  24, 7, 3, true, 60, 240, 168, 24, 7, false, false, 'ESX_XML',
  5, 5.6, '#0066CC', true,
  'Strong Ontario/Ottawa presence. 1-hour emergency contact. Vendor onboarding via email.'
) ON CONFLICT (carrier_slug) DO UPDATE SET
  claims_platform = EXCLUDED.claims_platform,
  updated_at = now();

-- Definity Financial (Economical)
INSERT INTO insurer_profiles (
  user_id, insurer_name, carrier_slug, claims_platform, secondary_platform,
  tpa_name, vendor_program_name, vendor_onboarding_url, vendor_phone,
  report_24hr_deadline_hours, scope_deadline_days, equipment_max_days,
  requires_daily_logs, emergency_contact_deadline_minutes, site_arrival_deadline_minutes,
  estimate_deadline_hours, estimate_revision_hours, final_invoice_deadline_days,
  requires_24hr_report, requires_hazmat_3stage_photos, export_format,
  priority_score, market_share_pct, carrier_color, is_active, notes
) VALUES (
  '5a5d58fe-b41e-4cb3-9054-8df9020e0496',
  'Definity Financial (Economical)', 'definity', 'Cotality/Symbility', 'Contractor Connection Portal',
  'Contractor Connection', 'Definity/Economical Vendor Network',
  'https://www.contractorconnection.com/for-contractors',
  '1-877-876-4010',
  24, 7, 3, true, 60, 240, 168, 24, 7, false, false, 'ESX_XML',
  4, 4.1, '#FF6600', true,
  'Uses Contractor Connection TPA. All documentation through CC portal.'
) ON CONFLICT (carrier_slug) DO UPDATE SET
  claims_platform = EXCLUDED.claims_platform,
  updated_at = now();

-- ── Checklist Templates ───────────────────────────────────────

-- INTACT (14 items)
DELETE FROM carrier_checklist_templates WHERE carrier_slug = 'intact';
INSERT INTO carrier_checklist_templates
  (carrier_slug,step_number,step_category,step_title,step_description,is_required,photo_label,photo_direction,warning_message,blocking,sort_order)
VALUES
  ('intact',1,'warning','On Side Restoration Alert','Intact owns On Side Restoration. Every photo, log, and timestamp must be documented precisely.',true,NULL,NULL,'⚠️ INTACT ALERT: On Side Restoration is an Intact subsidiary. Out-document them at every step.',false,10),
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

-- AVIVA (16 items)
DELETE FROM carrier_checklist_templates WHERE carrier_slug = 'aviva';
INSERT INTO carrier_checklist_templates
  (carrier_slug,step_number,step_category,step_title,step_description,is_required,photo_label,photo_direction,warning_message,blocking,sort_order)
VALUES
  ('aviva',1,'warning','🚨 30-MINUTE EMERGENCY CONTACT DEADLINE','Aviva Premier Network requires first contact with the policyholder within 30 minutes of job assignment.',true,NULL,NULL,'🚨 CRITICAL: Call policyholder within 30 MINUTES. Document the call time. Missing this = non-payment.',true,5),
  ('aviva',2,'warning','Ovation Premium Client Check','Check if this is an Ovation-tier policy in CoreLogic. Ovation clients: estimate due in 24 hours.',true,NULL,NULL,'⭐ OVATION CLIENT? Emergency estimate due in 24 HOURS (not 48). Scope due in 5 DAYS (not 7).',false,8),
  ('aviva',3,'photo','Room Photos — Labeled With Direction','Every room photo MUST include the room name AND compass direction in the filename.',true,'AVIVA-[RoomName]-[Direction]-[Sequence]','room_labeled_with_direction',NULL,true,10),
  ('aviva',4,'photo','Exterior Elevations — Labeled by Slope/Side','All exterior elevations labeled by slope and compass direction.',true,'AVIVA-EXTERIOR-[Side]-[Slope]','exterior_labeled_elevation',NULL,false,20),
  ('aviva',5,'photo','☢️ HAZMAT Stage 1 — Pre-Tearout','REQUIRED for Category 2/3 losses. Photograph hazardous materials BEFORE any demolition begins.',true,'AVIVA-HAZMAT-STAGE1-PRETEAROUT-[Room]','hazmat_pre_tearout','☢️ HAZMAT: This photo MUST be taken BEFORE demolition. Stage 1 of 3.',true,30),
  ('aviva',6,'photo','☢️ HAZMAT Stage 2 — Containment','Photograph containment barriers fully installed.',true,'AVIVA-HAZMAT-STAGE2-CONTAINMENT-[Room]','hazmat_containment_setup','☢️ HAZMAT: Stage 2 of 3 — CONTAINMENT. Show poly sq ft, tension poles, zipper.',true,40),
  ('aviva',7,'photo','☢️ HAZMAT Stage 3 — Post-Remediation','Photograph the area after hazardous material removal is complete.',true,'AVIVA-HAZMAT-STAGE3-POSTREMEDIATION-[Room]','hazmat_post_remediation','☢️ HAZMAT: Stage 3 of 3 — POST-REMEDIATION. Area must be clear and clean.',true,50),
  ('aviva',8,'photo','Daily Drying Progress Photos','Photograph drying equipment and affected areas on EVERY site visit. Mandatory.',true,'AVIVA-DRYING-DAY[VisitNum]-[Room]','daily_drying_progress',NULL,true,60),
  ('aviva',9,'document','24-Hour Report','Upload 24-Hour Report to CoreLogic Workspace within 24 hours of INITIAL SITE VISIT.',true,NULL,NULL,'⏰ 24-HR REPORT: Must upload within 24 hours of first site visit. Missing this = SLA breach.',true,70),
  ('aviva',10,'document','Emergency Estimate','Upload Emergency Estimate to CoreLogic within 48 hours (24 hours for Ovation clients).',true,NULL,NULL,'⏰ EMERGENCY ESTIMATE: Due within 48 hrs (Ovation = 24 hrs).',true,80),
  ('aviva',11,'document','Repair Estimate','Upload full repair estimate within 7 days. Xactimate or CoreLogic format.',true,NULL,NULL,NULL,false,90),
  ('aviva',12,'document','Daily Drying Logs','Submit drying log for EVERY site visit. Include psychrometric data, moisture readings.',true,NULL,NULL,NULL,true,100),
  ('aviva',13,'document','Signed Change Orders','Any scope change requires a signed change order uploaded BEFORE additional work begins.',true,NULL,NULL,NULL,true,110),
  ('aviva',14,'document','Sub-Trade Quotes (>$10,000)','Written quotes required for all subcontracted work exceeding $10,000.',true,NULL,NULL,NULL,false,120),
  ('aviva',15,'document','Certificate of Completion','Signed certificate of completion required. Upload to CoreLogic Workspace.',true,NULL,NULL,NULL,true,130),
  ('aviva',16,'action','CoreLogic Workspace Status Updates','Update CoreLogic Workspace job status at EVERY phase.',true,NULL,NULL,'⚠️ AVIVA: CoreLogic status must be updated at every phase. Missing updates = SLA penalty.',true,140);

-- CO-OPERATORS (12 items)
DELETE FROM carrier_checklist_templates WHERE carrier_slug = 'cooperators';
INSERT INTO carrier_checklist_templates
  (carrier_slug,step_number,step_category,step_title,step_description,is_required,photo_label,photo_direction,warning_message,blocking,sort_order)
VALUES
  ('cooperators',1,'warning','⏱️ 1-HOUR FIRST CONTACT DEADLINE','The Co-operators requires first contact with policyholder within 1 HOUR of job assignment.',true,NULL,NULL,'⏱️ CRITICAL: Contact policyholder within 60 MINUTES. Document exact call time.',true,5),
  ('cooperators',2,'warning','Vendor Onboarding Reminder','Not yet in Co-operators vendor network? Email Inquiries_cvm@cooperators.ca immediately.',true,NULL,NULL,'📧 NOT A CO-OP VENDOR YET? Email Inquiries_cvm@cooperators.ca to start onboarding.',false,8),
  ('cooperators',3,'photo','Before Mitigation — All Affected Areas','Photograph all damaged areas before any work begins.',true,'COOP-BEFORE-[Room]','room_all_corners',NULL,true,10),
  ('cooperators',4,'photo','Moisture Readings With Meter Visible','Photo at each moisture reading point. Meter display must be visible.',true,'COOP-MOISTURE-[Location]-[Value]','moisture_reading',NULL,false,20),
  ('cooperators',5,'photo','Equipment Running On Site','All placed dehumidifiers and air movers photographed and running.',true,'COOP-EQUIP-[Type]-[Serial]','equipment_running',NULL,false,30),
  ('cooperators',6,'photo','After Mitigation — All Affected Areas','After completion photos matching before-photo angles.',true,'COOP-AFTER-[Room]','room_all_corners',NULL,true,40),
  ('cooperators',7,'document','Signed Work Authorization','Work authorization signed by property owner BEFORE work begins.',true,NULL,NULL,NULL,true,50),
  ('cooperators',8,'document','Estimate (Xactimate ESX Format)','Full estimate in Xactimate ESX format. Due within 7 days.',true,NULL,NULL,NULL,false,60),
  ('cooperators',9,'document','Daily Drying Logs','Complete drying log for every site visit.',true,NULL,NULL,NULL,false,70),
  ('cooperators',10,'document','Certificate of Completion','Signed completion certificate uploaded at close-out.',true,NULL,NULL,NULL,true,80),
  ('cooperators',11,'action','Document First Contact Call','Record exact time of first call to policyholder in RoomLens job log.',true,NULL,NULL,'📞 LOG YOUR CALL: Record exact timestamp of first policyholder contact for SLA evidence.',true,90),
  ('cooperators',12,'action','Submit Final Invoice Within 7 Days','Final invoice must be submitted within 7 days of job completion.',true,NULL,NULL,NULL,false,100);

-- DEFINITY (13 items)
DELETE FROM carrier_checklist_templates WHERE carrier_slug = 'definity';
INSERT INTO carrier_checklist_templates
  (carrier_slug,step_number,step_category,step_title,step_description,is_required,photo_label,photo_direction,warning_message,blocking,sort_order)
VALUES
  ('definity',1,'warning','Contractor Connection TPA Required','Definity uses Contractor Connection as TPA. ALL documentation goes through CC portal.',true,NULL,NULL,'⚠️ DEFINITY: Use Contractor Connection portal for ALL uploads. Direct submission to Definity will be rejected.',true,5),
  ('definity',2,'warning','CC Portal Registration Check','Not registered on Contractor Connection? Apply at contractorconnection.com/for-contractors.',true,NULL,NULL,'🔗 NOT ON CC PORTAL? Register at contractorconnection.com before accepting Definity jobs.',false,8),
  ('definity',3,'photo','Before Mitigation — All Affected Rooms','Photograph all affected areas before work begins. Wide-angle corner shots.',true,'DEFIN-BEFORE-[RoomName]','room_all_corners',NULL,true,10),
  ('definity',4,'photo','Exterior Damage Documentation','All exterior damage photographed with compass direction labels.',true,'DEFIN-EXTERIOR-[Direction]','exterior_damage',NULL,false,20),
  ('definity',5,'photo','Moisture Reading Locations','Photo of each moisture reading point. Meter must be visible.',true,'DEFIN-MOISTURE-[Location]-[Value]','moisture_reading',NULL,false,30),
  ('definity',6,'photo','Equipment Placement Photos','All dehumidifiers and air movers photographed showing serial numbers.',true,'DEFIN-EQUIP-[Type]-[Serial]','equipment_placement',NULL,false,40),
  ('definity',7,'photo','After Mitigation — All Affected Rooms','After completion photos. Must match before-photo angles exactly.',true,'DEFIN-AFTER-[RoomName]','room_all_corners',NULL,true,50),
  ('definity',8,'document','Signed Work Authorization','Signed work authorization from property owner before work begins.',true,NULL,NULL,NULL,true,60),
  ('definity',9,'document','Scope Estimate — CC Portal Upload','Upload scope estimate to Contractor Connection portal within 7 days.',true,NULL,NULL,'⏰ ESTIMATE: Upload to CC portal within 7 days. Do NOT send directly to Definity.',false,70),
  ('definity',10,'document','Daily Drying Logs','Drying log for every site visit with psychrometric data.',true,NULL,NULL,NULL,false,80),
  ('definity',11,'document','Sub-Trade Quotes (>$10,000)','Written quotes for all subcontracted work over $10,000.',true,NULL,NULL,NULL,false,90),
  ('definity',12,'document','Certificate of Completion — CC Portal','Upload signed completion certificate to Contractor Connection portal.',true,NULL,NULL,NULL,true,100),
  ('definity',13,'action','Submit Final Invoice via CC Portal','Final invoice submitted through Contractor Connection within 7 days of completion.',true,NULL,NULL,'💳 INVOICE: Must go through CC portal. Direct invoicing to Definity = delayed payment.',false,110);
