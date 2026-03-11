// ============================================================
// RoomLens Pro — Carrier SLA Engine
// Supabase Edge Function
// Triggered via DB webhook on jobs INSERT / carrier_slug UPDATE
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SLA_DEFAULTS: Record<string, {
  emergency_contact_minutes: number;
  site_arrival_minutes: number;
  report_24hr: boolean;
  estimate_hours: number;
}> = {
  intact:      { emergency_contact_minutes: 120, site_arrival_minutes: 240, report_24hr: true,  estimate_hours: 168 },
  aviva:       { emergency_contact_minutes: 30,  site_arrival_minutes: 120, report_24hr: true,  estimate_hours: 48  },
  desjardins:  { emergency_contact_minutes: 120, site_arrival_minutes: 240, report_24hr: true,  estimate_hours: 168 },
  cooperators: { emergency_contact_minutes: 60,  site_arrival_minutes: 240, report_24hr: false, estimate_hours: 168 },
  definity:    { emergency_contact_minutes: 60,  site_arrival_minutes: 240, report_24hr: true,  estimate_hours: 168 },
  other:       { emergency_contact_minutes: 120, site_arrival_minutes: 240, report_24hr: false, estimate_hours: 168 },
};

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record ?? body;

    const jobId = record.id;
    const carrierSlug: string = record.carrier_slug;

    if (!jobId || !carrierSlug) {
      return new Response(JSON.stringify({ message: 'No job_id or carrier_slug — skipping' }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Load carrier SLA config from insurer_profiles
    const { data: profile } = await supabase
      .from('insurer_profiles')
      .select('emergency_contact_deadline_minutes, site_arrival_deadline_minutes, estimate_deadline_hours, requires_24hr_report')
      .eq('carrier_slug', carrierSlug)
      .single();

    const defaults = SLA_DEFAULTS[carrierSlug] ?? SLA_DEFAULTS['other'];
    const emergencyMins = profile?.emergency_contact_deadline_minutes ?? defaults.emergency_contact_minutes;
    const siteArrivalMins = profile?.site_arrival_deadline_minutes ?? defaults.site_arrival_minutes;
    const estimateHours = profile?.estimate_deadline_hours ?? defaults.estimate_hours;
    const needs24hrReport = profile?.requires_24hr_report ?? defaults.report_24hr;

    const now = Date.now();

    // Check for existing timers (avoid duplicates)
    const { data: existing } = await supabase
      .from('carrier_sla_timers')
      .select('timer_name')
      .eq('job_id', jobId)
      .eq('carrier_slug', carrierSlug);

    const existingNames = new Set((existing ?? []).map((t: { timer_name: string }) => t.timer_name));

    const timers: { job_id: string; carrier_slug: string; timer_name: string; deadline_at: string; status: string }[] = [];

    if (!existingNames.has('emergency_contact')) {
      timers.push({
        job_id: jobId,
        carrier_slug: carrierSlug,
        timer_name: 'emergency_contact',
        deadline_at: new Date(now + emergencyMins * 60 * 1000).toISOString(),
        status: 'pending',
      });
    }
    if (!existingNames.has('site_arrival')) {
      timers.push({
        job_id: jobId,
        carrier_slug: carrierSlug,
        timer_name: 'site_arrival',
        deadline_at: new Date(now + siteArrivalMins * 60 * 1000).toISOString(),
        status: 'pending',
      });
    }
    if (needs24hrReport && !existingNames.has('24hr_report')) {
      timers.push({
        job_id: jobId,
        carrier_slug: carrierSlug,
        timer_name: '24hr_report',
        deadline_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      });
    }
    if (!existingNames.has('estimate_submission')) {
      timers.push({
        job_id: jobId,
        carrier_slug: carrierSlug,
        timer_name: 'estimate_submission',
        deadline_at: new Date(now + estimateHours * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      });
    }

    if (timers.length > 0) {
      const { error } = await supabase.from('carrier_sla_timers').insert(timers);
      if (error) {
        console.error('SLA timer insert error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }

    return new Response(
      JSON.stringify({ success: true, job_id: jobId, carrier_slug: carrierSlug, timers_created: timers.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('carrier-sla-engine error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
