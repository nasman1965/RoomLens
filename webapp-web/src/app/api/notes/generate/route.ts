import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// ─── OpenAI client (server-side only) ─────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── Supabase admin client ─────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    // Validate
    if (!field_notes || !field_notes.trim()) {
      return NextResponse.json(
        { error: 'field_notes is required and cannot be empty.' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'PASTE_YOUR_NEW_KEY_HERE') {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Please add OPENAI_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    // ── Call OpenAI ────────────────────────────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: field_notes.trim() },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    const generated = completion.choices[0]?.message?.content?.trim() || '';

    if (!generated) {
      return NextResponse.json(
        { error: 'OpenAI returned an empty response. Please try again.' },
        { status: 500 }
      );
    }

    // ── Optionally save to Supabase ────────────────────────────────────────────
    if (save && job_id) {
      const { error: dbErr } = await supabase
        .from('jobs')
        .update({
          notes: generated,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job_id);

      if (dbErr) {
        // Return generated text but warn about save failure
        return NextResponse.json({
          generated,
          saved: false,
          save_error: dbErr.message,
        });
      }

      return NextResponse.json({ generated, saved: true });
    }

    return NextResponse.json({ generated, saved: false });

  } catch (err: unknown) {
    console.error('[/api/notes/generate] Error:', err);

    // Surface OpenAI-specific errors clearly
    if (err instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI error (${err.status}): ${err.message}` },
        { status: err.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}
