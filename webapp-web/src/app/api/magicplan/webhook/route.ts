import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── magicplan Webhook Receiver ────────────────────────────────────────────────
// POST /api/magicplan/webhook
//
// magicplan sends this payload when the tech presses the "Custom Export" button
// in the magicplan app (configured in magicplan Cloud → API & Integrations → Webhook).
//
// Expected payload from magicplan:
// {
//   "project_id": "mp-uuid",
//   "external_reference_id": "our-job-uuid",
//   "email": "tech@email.com",
//   "event": "project.exported"   (may vary)
// }
//
// On receipt we:
//  1. Verify the secret token (MAGICPLAN_WEBHOOK_SECRET)
//  2. Find our magicplan_projects record by external_reference_id (= job_id)
//  3. Mark status = 'exported'
//  4. Optionally fetch the ESX download link from magicplan API and store it
//  5. Return 200 so magicplan shows "Export Successful" to the tech

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key missing.');
  return createClient(url, key);
}

function getMagicplanHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.MAGICPLAN_API_KEY || '',
    'x-customer-id': process.env.MAGICPLAN_CUSTOMER_ID || '',
  };
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Verify webhook secret (optional but recommended) ─────────────────────
    const webhookSecret = process.env.MAGICPLAN_WEBHOOK_SECRET;
    if (webhookSecret) {
      const incoming = req.headers.get('x-magicplan-secret') || req.headers.get('x-webhook-secret') || '';
      if (incoming !== webhookSecret) {
        console.warn('[magicplan webhook] Invalid secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // ── 2. Parse payload ─────────────────────────────────────────────────────────
    const payload = await req.json();
    console.log('[magicplan webhook] received:', JSON.stringify(payload, null, 2));

    const magicplanProjectId = payload?.project_id || payload?.id;
    const externalRefId      = payload?.external_reference_id; // = our job_id
    const techEmail          = payload?.email || payload?.user_email;

    if (!magicplanProjectId && !externalRefId) {
      return NextResponse.json({ error: 'No project_id or external_reference_id in payload' }, { status: 400 });
    }

    const sb = getServiceSupabase();

    // ── 3. Find our record ───────────────────────────────────────────────────────
    let query = sb.from('magicplan_projects').select('*');
    if (externalRefId) {
      query = query.eq('external_ref', externalRefId);
    } else {
      query = query.eq('magicplan_project_id', magicplanProjectId);
    }

    const { data: record, error: findErr } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr) {
      console.error('[magicplan webhook] DB lookup error:', findErr.message);
      // Return 200 anyway so magicplan doesn't retry indefinitely
      return NextResponse.json({ received: true, warning: findErr.message });
    }

    // ── 4. Optionally fetch ESX download URL from magicplan API ─────────────────
    let esxFileUrl: string | null = null;
    let roomsJson: any[] = [];
    let totalAreaSqft: number | null = null;

    if (magicplanProjectId && process.env.MAGICPLAN_API_KEY) {
      try {
        // Try fetching project details including file exports
        const mpRes = await fetch(
          `https://cloud.magicplan.app/api/v2/projects/${magicplanProjectId}`,
          { headers: getMagicplanHeaders() }
        );

        if (mpRes.ok) {
          const mpData = await mpRes.json();

          // Extract ESX export URL if available
          const exports = mpData?.exports || mpData?.files || [];
          const esxExport = exports.find((f: any) =>
            f?.type === 'esx' || f?.format === 'esx' || f?.name?.toLowerCase().includes('.esx')
          );
          if (esxExport) esxFileUrl = esxExport.url || esxExport.download_url;

          // Extract room data
          const rooms = mpData?.rooms || mpData?.floors?.[0]?.rooms || [];
          if (rooms.length > 0) {
            roomsJson = rooms.map((r: any) => ({
              name: r.name || r.title || 'Room',
              area: r.area ? Math.round(r.area * 10.764) : null, // m² → ft²
              width: r.width || null,
              length: r.length || null,
            }));
            totalAreaSqft = Math.round(rooms.reduce((s: number, r: any) => s + (r.area || 0), 0) * 10.764);
          }
        }
      } catch (fetchErr: any) {
        console.warn('[magicplan webhook] Could not fetch project details:', fetchErr.message);
      }
    }

    // ── 5. Update our database record ────────────────────────────────────────────
    const updateData: Record<string, any> = {
      status: 'exported',
      esx_received_at: new Date().toISOString(),
    };
    if (magicplanProjectId) updateData.magicplan_project_id = magicplanProjectId;
    if (esxFileUrl)         updateData.esx_file_url = esxFileUrl;
    if (roomsJson.length)   updateData.rooms_json = roomsJson;
    if (totalAreaSqft)      updateData.total_area_sqft = totalAreaSqft;
    if (roomsJson.length)   updateData.room_count = roomsJson.length;
    if (techEmail)          updateData.notes = `Exported by: ${techEmail}`;

    if (record) {
      await sb.from('magicplan_projects').update(updateData).eq('id', record.id);
    } else if (externalRefId) {
      // No existing record — create one from webhook data (manual export case)
      await sb.from('magicplan_projects').insert({
        job_id:               externalRefId,
        user_id:              '00000000-0000-0000-0000-000000000000', // service insert
        magicplan_project_id: magicplanProjectId,
        external_ref:         externalRefId,
        ...updateData,
      });
    }

    // ── 6. Respond 200 ───────────────────────────────────────────────────────────
    return NextResponse.json({
      received: true,
      job_id: externalRefId || record?.job_id,
      esx_available: !!esxFileUrl,
    });

  } catch (err: any) {
    console.error('[magicplan webhook] Error:', err);
    // Always return 200 to prevent magicplan from showing error to tech
    return NextResponse.json({ received: true, error: err.message });
  }
}
