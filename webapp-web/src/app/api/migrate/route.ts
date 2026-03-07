import { NextResponse } from 'next/server';

// Migration helper — columns are now added via Supabase SQL editor.
// This route is kept as a status check endpoint.
export async function GET() {
  return NextResponse.json({
    message: 'Migration 0002 was applied manually via Supabase SQL editor.',
    columns: [
      'lead_source', 'lead_source_detail',
      'created_by_name', 'created_by_phone', 'created_by_email',
      'dispatched_to_name', 'dispatched_to_phone', 'dispatched_to_email',
      'dispatched_at', 'dispatch_notes', 'eta_minutes',
      'work_auth_status', 'work_auth_sent_at', 'work_auth_signed_at',
      'work_auth_signed_by', 'work_auth_doc_url',
    ],
    status: 'applied',
  });
}
