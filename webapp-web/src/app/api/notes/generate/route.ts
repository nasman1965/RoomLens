import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── Supabase admin client ─────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SYSTEM_PROMPT = `You are a restoration technician's assistant. Take the tech's rough field notes and rewrite them as 2-3 clear professional paragraphs. Plain English only. No bullet points, no headings, no tables. Just clean readable general notes about what was observed at the property.`;

// ─── POST /api/notes/generate ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { field_notes, job_id, save } = body as {
      field_notes: string;
      job_id?: string;
      save?: boolean;
    };

    if (!field_notes || !field_notes.trim()) {
      return NextResponse.json(
        { error: 'field_notes is required and cannot be empty.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'PASTE_YOUR_NEW_KEY_HERE') {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured.' },
        { status: 500 }
      );
    }

    // ── Call OpenAI via fetch (no SDK dependency) ──────────────────────────────
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: field_notes.trim() },
        ],
        temperature: 0.4,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return NextResponse.json(
        { error: `OpenAI error (${response.status}): ${errBody}` },
        { status: response.status }
      );
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const generated = data.choices[0]?.message?.content?.trim() || '';

    if (!generated) {
      return NextResponse.json(
        { error: 'OpenAI returned an empty response.' },
        { status: 500 }
      );
    }

    // ── Optionally save to Supabase ────────────────────────────────────────────
    if (save && job_id) {
      const { error: dbErr } = await supabase
        .from('jobs')
        .update({ notes: generated, updated_at: new Date().toISOString() })
        .eq('id', job_id);

      if (dbErr) {
        return NextResponse.json({ generated, saved: false, save_error: dbErr.message });
      }
      return NextResponse.json({ generated, saved: true });
    }

    return NextResponse.json({ generated, saved: false });

  } catch (err: unknown) {
    console.error('[/api/notes/generate] Error:', err);
    const msg = err instanceof Error ? err.message : 'Internal server error.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
