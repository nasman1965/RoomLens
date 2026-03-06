// lib/api/floorPlanExport.ts
// ─────────────────────────────────────────────────────────────────────────────
// Future integration point for ShutoffMap standalone app.
//
// ShutoffMap is a separate product that imports floor plans from RoomLensPro
// to build a utility shutoff map (gas, water, electrical panels) on top of
// the dimensioned floor plan produced by the 360° scan module.
//
// When ShutoffMap is ready to integrate, it will call:
//   POST /api/jobs/{job_id}/floor-plans/export
//
// This function is the RoomLensPro side of that handshake.
// ─────────────────────────────────────────────────────────────────────────────

export interface FloorPlanExportPayload {
  svg_url: string;          // Publicly accessible URL to the generated SVG floor plan
  pdf_url?: string;         // Optional PDF version
  floor_count: number;      // Number of floors in the building
  job_address: string;      // Property address for cross-reference
  job_id: string;           // RoomLensPro job UUID
  exported_at: string;      // ISO timestamp of export
}

/**
 * exportFloorPlanForShutoffMap
 *
 * Fetches the completed floor plan scan record for a given job and returns
 * the data needed by the ShutoffMap standalone app to display and annotate
 * the floor plan with utility shutoff locations.
 *
 * Implementation (when active):
 *   1. Query floor_plan_scans WHERE job_id = jobId AND status = 'complete'
 *   2. Fetch associated jobs record for property_address + floor_count
 *   3. Return { svg_url, pdf_url, floor_count, job_address, job_id, exported_at }
 *
 * ShutoffMap will POST this payload to its own ingestion endpoint:
 *   POST https://api.shutoffmap.com/v1/import/floor-plan
 *
 * @param jobId  RoomLensPro job UUID
 * @returns      FloorPlanExportPayload
 * @throws       Error if floor plan is not yet complete or jobId is invalid
 */
export async function exportFloorPlanForShutoffMap(
  jobId: string
): Promise<FloorPlanExportPayload> {
  // ── NOT YET ACTIVE ───────────────────────────────────────────────────────
  // Uncomment and implement once:
  //   1. ShutoffMap API endpoint is live
  //   2. Supabase floor_plan_scans table is populated with real data
  //   3. Authentication between the two apps is agreed upon
  //
  // Example implementation:
  //
  // import { supabase } from '../src/services/supabase';
  //
  // const { data: scan, error } = await supabase
  //   .from('floor_plan_scans')
  //   .select('*, jobs(property_address)')
  //   .eq('job_id', jobId)
  //   .eq('status', 'complete')
  //   .order('created_at', { ascending: false })
  //   .limit(1)
  //   .single();
  //
  // if (error || !scan) throw new Error(`No completed floor plan found for job ${jobId}`);
  //
  // return {
  //   svg_url:      scan.floor_plan_svg_url,
  //   pdf_url:      scan.floor_plan_pdf_url ?? undefined,
  //   floor_count:  scan.room_data_json?.floor_count ?? 1,
  //   job_address:  scan.jobs.property_address,
  //   job_id:       jobId,
  //   exported_at:  new Date().toISOString(),
  // };
  // ─────────────────────────────────────────────────────────────────────────

  throw new Error(
    'ShutoffMap API integration — not yet active. ' +
    'See lib/api/floorPlanExport.ts for implementation instructions.'
  );
}
