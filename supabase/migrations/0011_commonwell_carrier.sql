-- ============================================================
-- RoomLens Pro: The Commonwell Mutual Insurance Group
-- Migration: 0011_commonwell_carrier
-- 
-- Key facts:
--   Platform:  Xactimate ESX (standard Ontario mutual format)
--   TPA:       ClaimsPro (after-hours 24/7 emergency handling)
--   Program:   ACE — Accredited Commonwell Experts
--   HQ:        Lindsay ON + Perth ON (rural/Eastern Ontario focus)
--   Claims:    1-855-436-5883 (24/7)
--   Market:    Kawartha Lakes, Lanark, Renfrew, rural Eastern Ontario
--   Priority:  3 (regional mutual, lower volume than nationals)
--   Notes:     Community-focused mutual. Flexible adjuster relationships
--              possible, but ACE program standards still enforced.
--              ClaimsPro handles after-hours — document emergency contact.
-- ============================================================

-- 1. Seed insurer_profiles
INSERT INTO insurer_profiles (
  user_id, insurer_name, carrier_slug, claims_platform, secondary_platform,
  tpa_name, vendor_program_name, vendor_onboarding_url, vendor_phone, vendor_email,
  report_24hr_deadline_hours, scope_deadline_days, equipment_max_days,
  requires_daily_logs, xactanalysis_integration, preferred_contact_method,
  emergency_contact_deadline_minutes, site_arrival_deadline_minutes,
  estimate_deadline_hours, estimate_revision_hours, final_invoice_deadline_days,
  requires_24hr_report, requires_hazmat_3stage_photos, export_format,
  priority_score, market_share_pct, carrier_color, is_active, notes
) VALUES (
  '5a5d58fe-b41e-4cb3-9054-8df9020e0496',
  'The Commonwell Mutual Insurance Group',
  'commonwell',
  'Xactimate',
  'Guidewire ClaimCenter (internal)',
  'ClaimsPro (after-hours TPA)',
  'ACE — Accredited Commonwell Experts',
  'https://thecommonwell.ca/making-a-claim/',
  '1-855-436-5883',
  'generalmailbox@thecommonwell.ca',
  24, 7, 3,
  true, false, 'phone',
  120, 240,
  168, 48, 7,
  false, false,
  'ESX_XML',
  3, 2.1,
  '#1B4F8A',
  true,
  'Regional Ontario mutual (Lindsay + Perth HQ). ACE program = Accredited Commonwell Experts vendor list. After-hours claims handled by ClaimsPro 24/7. Rural Eastern Ontario focus — Kawartha Lakes, Lanark, Renfrew. Adjuster relationships more direct than nationals. Xactimate ESX standard format. No dedicated contractor portal — submit docs directly to adjuster.'
) ON CONFLICT (carrier_slug) DO UPDATE SET
  claims_platform = EXCLUDED.claims_platform,
  tpa_name = EXCLUDED.tpa_name,
  updated_at = now();

-- 2. Seed checklist templates (13 items)
DELETE FROM carrier_checklist_templates WHERE carrier_slug = 'commonwell';

INSERT INTO carrier_checklist_templates
  (carrier_slug, step_number, step_category, step_title, step_description,
   is_required, photo_label, photo_direction, warning_message, blocking, sort_order)
VALUES
  -- WARNINGS (2)
  (
    'commonwell', 1, 'warning',
    'ACE Program — Accredited Vendor Check',
    'The Commonwell uses the ACE (Accredited Commonwell Experts) vendor network. Confirm your company is on the approved contractor list before accepting the job.',
    true, NULL, NULL,
    '⚠️ ACE VENDOR CHECK: Confirm you are on The Commonwell ACE contractor list. Non-ACE contractors may face delayed payment approval. Check: thecommonwell.ca/making-a-claim',
    false, 5
  ),
  (
    'commonwell', 2, 'warning',
    'ClaimsPro After-Hours Contact',
    'After-hours and emergency claims are handled by ClaimsPro on behalf of The Commonwell. If assigned after hours, contact ClaimsPro at 1-855-436-5883. Document the call.',
    true, NULL, NULL,
    '🕐 AFTER-HOURS: The Commonwell uses ClaimsPro for 24/7 emergency claims. Call 1-855-436-5883. Log the ClaimsPro rep name and timestamp.',
    false, 8
  ),

  -- PHOTOS (5)
  (
    'commonwell', 3, 'photo',
    'Before Mitigation — All Affected Rooms',
    'Photograph every affected room BEFORE any work begins. Wide-angle corner shots required.',
    true, 'CW-BEFORE-[RoomName]', 'room_all_corners', NULL, true, 10
  ),
  (
    'commonwell', 4, 'photo',
    'Exterior Elevations — All Sides',
    'All four exterior elevations photographed. Label by compass direction.',
    true, 'CW-EXTERIOR-[Direction]', 'exterior_all_elevations', NULL, false, 20
  ),
  (
    'commonwell', 5, 'photo',
    'Moisture Reading Locations',
    'Photograph each moisture reading point with the meter display clearly visible in the frame.',
    true, 'CW-MOISTURE-[Location]-[Value]', 'moisture_reading_point', NULL, false, 30
  ),
  (
    'commonwell', 6, 'photo',
    'Equipment Placed On Site',
    'Photograph all dehumidifiers and air movers showing make, model, and serial number.',
    true, 'CW-EQUIP-[Type]-[Serial]', 'equipment_placement', NULL, false, 40
  ),
  (
    'commonwell', 7, 'photo',
    'After Mitigation — All Affected Rooms',
    'After-completion photos of every affected room. Must match before-photo angles exactly.',
    true, 'CW-AFTER-[RoomName]', 'room_all_corners', NULL, true, 50
  ),

  -- DOCUMENTS (4)
  (
    'commonwell', 8, 'document',
    'Signed Work Authorization',
    'Signed work authorization from property owner MUST be obtained before any work begins. Submit to adjuster directly (no portal — email or in person).',
    true, NULL, NULL, NULL, true, 60
  ),
  (
    'commonwell', 9, 'document',
    'Scope Estimate — Xactimate ESX Format',
    'Prepare and submit full scope estimate in Xactimate ESX format within 7 days of site visit. Send directly to The Commonwell adjuster — no third-party portal.',
    true, NULL, NULL,
    '⏰ ESTIMATE DEADLINE: Submit Xactimate ESX estimate to adjuster within 7 days. No portal — email directly.',
    false, 70
  ),
  (
    'commonwell', 10, 'document',
    'Daily Drying Logs',
    'Complete drying log for every site visit. Include psychrometric readings, moisture data, equipment runtime hours.',
    true, NULL, NULL, NULL, false, 80
  ),
  (
    'commonwell', 11, 'document',
    'Sub-Trade Quotes (>$10,000)',
    'Written quotes required for any subcontracted work exceeding $10,000. Submit with estimate package.',
    true, NULL, NULL, NULL, false, 90
  ),
  (
    'commonwell', 12, 'document',
    'Certificate of Completion',
    'Upload or email signed certificate of completion to The Commonwell adjuster upon job close-out.',
    true, NULL, NULL, NULL, true, 100
  ),

  -- ACTIONS (1)
  (
    'commonwell', 13, 'action',
    'Submit Final Invoice Within 7 Days',
    'Final invoice must be submitted to The Commonwell adjuster within 7 days of job completion. Direct submission — no portal required.',
    true, NULL, NULL,
    '💳 INVOICE: Send directly to your assigned adjuster at The Commonwell. Lindsay: 705-324-2146 | Perth: 613-267-5554.',
    false, 110
  );

-- 3. Verify
SELECT carrier_slug, COUNT(*) as items
FROM carrier_checklist_templates
WHERE carrier_slug = 'commonwell'
GROUP BY carrier_slug;
