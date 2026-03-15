import { NextRequest, NextResponse } from 'next/server';

// ─── Unified AI generation endpoint ────────────────────────────────────────────
// POST /api/ai/generate
// Body: { type, ...context }
//
// Supported types:
//   job_notes         – rough field notes → professional paragraphs
//   insurance_summary – job data → formatted insurance adjuster summary
//   dispatch_message  – job + staff data → SMS dispatch text
//   damage_description – photo URL → damage description for report
//   performance_summary – staff stats → HR performance summary
//   job_report        – full job data → complete job completion report
//   incident_note     – staff + incident → formal HR incident note
//   daily_summary     – jobs array → end-of-day summary
//   thermal_scan      – FLIR thermal photo → hidden moisture/mould JSON analysis

async function callOpenAI(systemPrompt: string, userPrompt: string, maxTokens = 600): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured. Add OPENAI_API_KEY in Vercel → Settings → Environment Variables.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${err}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content?.trim() || '';
}

async function callOpenAIVision(systemPrompt: string, userPrompt: string, imageUrl: string, maxTokens = 400): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI vision error (${res.status}): ${err}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content?.trim() || '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type } = body;

    if (!type) return NextResponse.json({ error: 'Missing type' }, { status: 400 });

    let result = '';

    // ── 1. JOB NOTES ────────────────────────────────────────────────────────────
    if (type === 'job_notes') {
      const { field_notes, job_context } = body;
      if (!field_notes?.trim()) return NextResponse.json({ error: 'field_notes required' }, { status: 400 });

      const system = `You are a professional restoration technician's assistant writing for a Canadian restoration company. 
Rewrite rough field notes into 2-3 clear, professional paragraphs. 
Plain English only. No bullet points, no headings. 
Use restoration industry terminology where appropriate (water intrusion, affected materials, drying protocol, etc.).`;

      const user = job_context
        ? `Job: ${job_context.insured_name} at ${job_context.property_address}. Loss type: ${job_context.job_type || 'water damage'}.\n\nTech notes: ${field_notes}`
        : field_notes;

      result = await callOpenAI(system, user, 500);
    }

    // ── 2. INSURANCE SUMMARY ────────────────────────────────────────────────────
    else if (type === 'insurance_summary') {
      const { job } = body;
      if (!job) return NextResponse.json({ error: 'job data required' }, { status: 400 });

      const system = `You are a senior restoration project manager writing formal insurance claim summaries for Canadian insurance adjusters.
Write a clear, professional summary in 3-4 paragraphs covering: initial assessment, scope of damage, work performed/planned, and current status.
Use formal language. Include all claim details provided. Do not add details not provided.`;

      const user = `Generate an insurance summary for the following job:

Insured: ${job.insured_name}
Property: ${job.property_address}${job.property_city ? ', ' + job.property_city : ''}
Claim #: ${job.claim_number || 'TBD'}
Insurer: ${job.insurer_name || 'Unknown'}
Loss Date: ${job.loss_date || 'Unknown'}
Loss Category: ${job.loss_category ? 'Category ' + job.loss_category : 'Unknown'}
Loss Class: ${job.loss_class ? 'Class ' + job.loss_class : 'Unknown'}
Job Type: ${job.job_type || 'Water Damage Restoration'}
Current Status: ${job.status}
Job Notes: ${job.notes || 'No notes available'}`;

      result = await callOpenAI(system, user, 700);
    }

    // ── 3. DISPATCH MESSAGE ─────────────────────────────────────────────────────
    else if (type === 'dispatch_message') {
      const { job, staff_name, eta_minutes } = body;
      if (!job || !staff_name) return NextResponse.json({ error: 'job and staff_name required' }, { status: 400 });

      const system = `You are dispatching field technicians for a restoration company.
Write a clear, professional SMS dispatch message. Keep it under 160 characters if possible.
Include: technician's first name, property address, key job details, ETA if provided.
Be friendly but professional. End with company name "RoomLens Pro".`;

      const user = `Write a dispatch SMS for:
Technician: ${staff_name}
Job Address: ${job.property_address}${job.property_city ? ', ' + job.property_city : ''}
Insured: ${job.insured_name}
Job Type: ${job.job_type || 'Water Damage'}
${eta_minutes ? 'ETA: ' + eta_minutes + ' minutes' : ''}
${job.dispatch_notes ? 'Notes: ' + job.dispatch_notes : ''}`;

      result = await callOpenAI(system, user, 200);
    }

    // ── 4. DAMAGE DESCRIPTION (Vision) ──────────────────────────────────────────
    else if (type === 'damage_description') {
      const { photo_url, job_context, room_name } = body;
      if (!photo_url) return NextResponse.json({ error: 'photo_url required' }, { status: 400 });

      const system = `You are a certified water damage restoration inspector writing photo descriptions for insurance claims.
Describe visible damage in 2-3 sentences: material affected, extent of damage, severity. 
Use professional restoration terminology. Be specific and factual. No speculation.`;

      const user = `Describe the damage visible in this photo for an insurance claim report.
${room_name ? 'Room/Area: ' + room_name : ''}
${job_context?.job_type ? 'Loss Type: ' + job_context.job_type : ''}`;

      result = await callOpenAIVision(system, user, photo_url, 300);
    }

    // ── 5. PERFORMANCE SUMMARY ──────────────────────────────────────────────────
    else if (type === 'performance_summary') {
      const { staff, stats } = body;
      if (!staff) return NextResponse.json({ error: 'staff data required' }, { status: 400 });

      const system = `You are an HR manager at a restoration company writing professional performance summaries.
Write a concise 2-paragraph performance summary based on the data provided.
Be professional, objective, and constructive. Highlight strengths and note areas for growth if applicable.
Do not invent details not in the data.`;

      const user = `Write a performance summary for:

Name: ${staff.full_name}
Role: ${staff.role}
Member Since: ${staff.created_at}
Status: ${staff.invite_status === 'active' ? 'Active' : 'Pending'}
NDA Signed: ${staff.nda_accepted ? 'Yes' : 'No'}

Performance Data:
- Total Jobs Assigned: ${stats.total_jobs}
- Active Jobs: ${stats.active_jobs}
- Completed Jobs: ${stats.completed_jobs}
- Clock Sessions: ${stats.clock_sessions}
- Total Hours Logged: ${stats.total_hours.toFixed(1)} hours
- Last Active: ${stats.last_login || 'Unknown'}`;

      result = await callOpenAI(system, user, 400);
    }

    // ── 6. JOB REPORT ───────────────────────────────────────────────────────────
    else if (type === 'job_report') {
      const { job, workflow_steps, staff_names } = body;
      if (!job) return NextResponse.json({ error: 'job data required' }, { status: 400 });

      const system = `You are a senior project manager at a Canadian restoration company writing formal job completion reports.
Write a comprehensive job report covering: executive summary, scope of work, work performed, materials and equipment, team members, current status, and recommendations.
Format with clear section headers. Professional tone. Use Canadian English.`;

      const completedSteps = (workflow_steps || [])
        .filter((s: any) => s.status === 'complete')
        .map((s: any) => `Step ${s.step_number}: ${s.step_name || s.title || 'Completed'}`)
        .join(', ');

      const user = `Generate a job completion report:

CLAIM INFORMATION:
- Insured: ${job.insured_name}
- Property: ${job.property_address}${job.property_city ? ', ' + job.property_city : ''}
- Claim #: ${job.claim_number || 'TBD'}
- Insurer: ${job.insurer_name || 'Unknown'}
- Loss Date: ${job.loss_date || 'Unknown'}
- Loss Category: ${job.loss_category ? 'Category ' + job.loss_category : 'N/A'}
- Loss Class: ${job.loss_class ? 'Class ' + job.loss_class : 'N/A'}

JOB STATUS: ${job.status?.toUpperCase()}
JOB TYPE: ${job.job_type || 'Water Damage Restoration'}
${staff_names?.length ? 'ASSIGNED STAFF: ' + staff_names.join(', ') : ''}
${completedSteps ? 'COMPLETED STEPS: ' + completedSteps : ''}
${job.notes ? 'FIELD NOTES: ' + job.notes : ''}
${job.stop_reason ? 'STOP REASON: ' + job.stop_reason + (job.stop_notes ? ' - ' + job.stop_notes : '') : ''}`;

      result = await callOpenAI(system, user, 900);
    }

    // ── 7. INCIDENT NOTE ────────────────────────────────────────────────────────
    else if (type === 'incident_note') {
      const { staff_name, staff_role, incident_description, date } = body;
      if (!staff_name || !incident_description) {
        return NextResponse.json({ error: 'staff_name and incident_description required' }, { status: 400 });
      }

      const system = `You are an HR manager writing formal incident documentation for a restoration company.
Write a professional, factual incident note suitable for an employee file.
Neutral tone. Include: date, parties involved, description of incident, and recommended follow-up action.`;

      const user = `Write a formal incident note for:
Employee: ${staff_name} (${staff_role || 'Staff'})
Date: ${date || new Date().toLocaleDateString('en-CA')}
Incident Description: ${incident_description}`;

      result = await callOpenAI(system, user, 400);
    }

    // ── 8. DAILY SUMMARY ────────────────────────────────────────────────────────
    else if (type === 'daily_summary') {
      const { jobs, date, company_name } = body;
      if (!jobs?.length) return NextResponse.json({ error: 'jobs array required' }, { status: 400 });

      const system = `You are writing a professional end-of-day operations summary for a restoration company manager.
Write a concise 2-3 paragraph daily briefing covering active jobs, key updates, staff activity, and any concerns.
Professional tone. Highlight anything requiring attention.`;

      const jobSummary = jobs.map((j: any) =>
        `- ${j.insured_name} (${j.property_address}): ${j.status} — ${j.job_type || 'restoration'}`
      ).join('\n');

      const user = `Daily summary for ${company_name || 'RoomLens Pro'} — ${date || new Date().toLocaleDateString('en-CA')}:

ACTIVE JOBS:
${jobSummary}`;

      result = await callOpenAI(system, user, 500);
    }

    // ── 9. THERMAL SCAN INTERPRETATION (Vision) ─────────────────────────────────
    else if (type === 'thermal_scan') {
      const { thermal_photo_url, visible_photo_url, room_name, ambient_temp_c, job_context } = body;
      if (!thermal_photo_url) return NextResponse.json({ error: 'thermal_photo_url required' }, { status: 400 });

      const system = `You are a certified IICRC water damage and mould remediation inspector with expertise in infrared thermography.
Analyze the thermal image to detect hidden moisture, mould heat signatures, wet insulation, saturated bottom plates, or wet subfloors.
Return a JSON object ONLY with these exact fields:
{
  "anomaly_type": "wet_insulation" | "mould_heat" | "cold_bridge" | "subfloor_wet" | "bottom_plate" | "normal",
  "moisture_probability": 0-100,
  "mould_risk": "low" | "medium" | "high" | "critical",
  "surface_temp_c": number or null,
  "temp_delta_c": number or null,
  "affected_area_sf": number or null,
  "height_from_floor_cm": number or null,
  "anomaly_height_cm": number or null,
  "recommendation": "one sentence action recommendation",
  "confidence_notes": "brief explanation of findings"
}
Only return valid JSON. No markdown, no explanation text outside the JSON.`;

      const user = `Analyze this thermal infrared image for hidden moisture and damage.
Room/Area: ${room_name || 'Unknown'}
Ambient temperature: ${ambient_temp_c != null ? ambient_temp_c + '°C' : 'Unknown'}
Loss type: ${job_context?.job_type || 'water damage'}
${visible_photo_url ? 'A matching visible-light photo is also provided for reference.' : ''}
Identify any temperature anomalies, cold spots (wet insulation), warm spots (mould), or moisture patterns.`;

      // Use vision with thermal image (+ visible if provided)
      const result_raw = await callOpenAIVision(system, user, thermal_photo_url, 500);

      // Try to parse JSON from AI response
      try {
        const parsed = JSON.parse(result_raw.replace(/```json|```/g, '').trim());
        return NextResponse.json({ result: result_raw, parsed, type });
      } catch {
        return NextResponse.json({ result: result_raw, type });
      }
    }

    else {
      return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }

    if (!result) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    return NextResponse.json({ result, type });

  } catch (err: any) {
    console.error('[/api/ai/generate]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
