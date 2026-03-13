import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── magicplan API Integration ─────────────────────────────────────────────────
// Handles all magicplan operations for RoomLensPro
//
// POST /api/magicplan   { action: 'create_project', job_id, job_data }
//   → Creates a magicplan project linked to the RoomLens job
//
// GET  /api/magicplan?job_id=xxx
//   → Returns the magicplan project record for this job
//
// POST /api/magicplan   { action: 'sync_status', magicplan_project_id }
//   → Polls magicplan API for latest status / retrieves floor plan data

const MAGICPLAN_BASE = 'https://cloud.magicplan.app/api/v2';

function getMagicplanHeaders() {
  const apiKey    = process.env.MAGICPLAN_API_KEY;
  const customerId = process.env.MAGICPLAN_CUSTOMER_ID;
  if (!apiKey || !customerId) {
    throw new Error(
      'magicplan credentials missing. Add MAGICPLAN_API_KEY and MAGICPLAN_CUSTOMER_ID to Vercel environment variables.'
    );
  }
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'x-customer-id': customerId,
  };
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key missing.');
  return createClient(url, key);
}

// ─── GET: fetch magicplan project record for a job ─────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get('job_id');
    if (!jobId) return NextResponse.json({ error: 'job_id required' }, { status: 400 });

    const sb = getServiceSupabase();
    const { data, error } = await sb
      .from('magicplan_projects')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST: create project, sync status, or mark ready ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 });

    // ── 1. CREATE PROJECT in magicplan + record in Supabase ─────────────────────
    if (action === 'create_project') {
      const { job_id, user_id, job_data } = body;
      if (!job_id || !user_id) return NextResponse.json({ error: 'job_id and user_id required' }, { status: 400 });

      const sb = getServiceSupabase();

      // Check for existing active project
      const { data: existing } = await sb
        .from('magicplan_projects')
        .select('id, status, magicplan_project_id')
        .eq('job_id', job_id)
        .not('status', 'eq', 'error')
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          project: existing,
          message: 'Project already exists',
          already_exists: true,
        });
      }

      // Build a human-readable project name for magicplan
      const projectName = [
        'RoomLens',
        job_data?.insured_name || '',
        job_data?.property_address || '',
        new Date().toLocaleDateString('en-CA'),
      ].filter(Boolean).join(' – ');

      // Call magicplan API to create project
      let magicplanProjectId: string | null = null;
      let magicplanError: string | null = null;

      try {
        const mpRes = await fetch(`${MAGICPLAN_BASE}/projects`, {
          method: 'POST',
          headers: getMagicplanHeaders(),
          body: JSON.stringify({
            name: projectName,
            external_reference_id: job_id, // links magicplan project back to our job
            description: [
              `RoomLens Job ID: ${job_id}`,
              job_data?.claim_number ? `Claim #: ${job_data.claim_number}` : null,
              job_data?.insurer_name  ? `Insurer: ${job_data.insurer_name}` : null,
              job_data?.job_type      ? `Loss Type: ${job_data.job_type}` : null,
            ].filter(Boolean).join('\n'),
          }),
        });

        if (mpRes.ok) {
          const mpData = await mpRes.json();
          magicplanProjectId = mpData?.id || mpData?.project_id || null;
        } else {
          const errText = await mpRes.text();
          magicplanError = `magicplan API error (${mpRes.status}): ${errText}`;
        }
      } catch (fetchErr: any) {
        magicplanError = `magicplan API unreachable: ${fetchErr.message}`;
      }

      // Store in Supabase regardless — even if magicplan call failed,
      // we create a local record so the tech can proceed manually
      const { data: record, error: dbErr } = await sb
        .from('magicplan_projects')
        .insert({
          job_id,
          user_id,
          magicplan_project_id: magicplanProjectId,
          external_ref: job_id,
          status: magicplanError ? 'error' : 'created',
          error_message: magicplanError,
          notes: `Project: ${projectName}`,
        })
        .select()
        .single();

      if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

      return NextResponse.json({
        project: record,
        magicplan_project_id: magicplanProjectId,
        error: magicplanError,
      });
    }

    // ── 2. SYNC STATUS from magicplan ───────────────────────────────────────────
    if (action === 'sync_status') {
      const { magicplan_record_id, magicplan_project_id } = body;
      if (!magicplan_project_id) {
        return NextResponse.json({ error: 'magicplan_project_id required' }, { status: 400 });
      }

      const sb = getServiceSupabase();

      try {
        const mpRes = await fetch(`${MAGICPLAN_BASE}/projects/${magicplan_project_id}`, {
          headers: getMagicplanHeaders(),
        });

        if (!mpRes.ok) {
          return NextResponse.json({ error: `magicplan sync failed (${mpRes.status})` }, { status: 502 });
        }

        const mpData = await mpRes.json();

        // Extract floor plan data if available
        const rooms = mpData?.rooms || mpData?.floors?.[0]?.rooms || [];
        const totalArea = rooms.reduce((sum: number, r: any) => sum + (r.area || 0), 0);

        const updatePayload: Record<string, any> = {
          status: 'scanning',
        };

        if (rooms.length > 0) {
          updatePayload.status = 'exported';
          updatePayload.room_count = rooms.length;
          updatePayload.total_area_sqft = Math.round(totalArea * 10.764); // m² → ft²
          updatePayload.rooms_json = rooms.map((r: any) => ({
            name: r.name || r.title || 'Room',
            area: r.area ? Math.round(r.area * 10.764) : null,
            width: r.width || null,
            length: r.length || null,
          }));
        }

        if (magicplan_record_id) {
          await sb.from('magicplan_projects').update(updatePayload).eq('id', magicplan_record_id);
        }

        return NextResponse.json({ synced: true, data: mpData, rooms });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    // ── 3. MARK READY — tech has exported ESX from magicplan manually ───────────
    if (action === 'mark_scanning') {
      const { record_id } = body;
      if (!record_id) return NextResponse.json({ error: 'record_id required' }, { status: 400 });

      const sb = getServiceSupabase();
      await sb.from('magicplan_projects').update({ status: 'scanning' }).eq('id', record_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (err: any) {
    console.error('[/api/magicplan]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
