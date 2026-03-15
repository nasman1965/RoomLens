'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  FileText, Plus, ChevronDown, Loader2, AlertCircle,
  CheckCircle, X, Download, Eye, Clock, FileCheck,
  Send, Printer
} from 'lucide-react';

interface Job {
  id: string;
  insured_name: string;
  property_address: string;
  property_city: string | null;
  claim_number: string | null;
  insurer_name: string | null;
  loss_date: string | null;
  job_type: string;
  status: string;
  current_step: number;
}
interface Report {
  id: string;
  job_id: string;
  report_type: string;
  pdf_url: string | null;
  created_at: string;
  share_token?: string | null;
  is_shared?: boolean;
}

const REPORT_TYPES = [
  { value: '24hr_report', label: '24-Hour Initial Report', icon: '⏱️', description: 'Required within 24 hrs of job start. Covers initial findings, category/class, equipment deployed.' },
  { value: 'daily_moisture', label: 'Daily Moisture Report', icon: '💧', description: 'Daily moisture readings log with IICRC S500 status and drying progress.' },
  { value: 'scope_estimate', label: 'Scope & Estimate', icon: '📋', description: 'Line-item scope of work with Xactimate codes and pricing.' },
  { value: 'completion_report', label: 'Completion Report', icon: '✅', description: 'Final report confirming all materials dried to IICRC standards and equipment removed.' },
  { value: 'adjuster_summary', label: 'Adjuster Summary', icon: '🏢', description: 'Professional summary package for the insurance adjuster with key metrics.' },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_TYPES.map(r => [r.value, `${r.icon} ${r.label}`])
);

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-700/50 text-slate-400',
  generated: 'bg-blue-100 text-cyan-300',
  sent: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
};

export default function ReportsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewReport, setShowNewReport] = useState(false);
  const [selectedType, setSelectedType] = useState('24hr_report');
  const [previewReport, setPreviewReport] = useState<{ job: Job; type: string; content: string } | null>(null);

  // Thermal reading type
  interface ThermalReading {
    id: string;
    room_name: string;
    wall_direction: string | null;
    surface_temp_c: number | null;
    ambient_temp_c: number | null;
    temp_delta_c: number | null;
    anomaly_type: string | null;
    moisture_probability: number | null;
    mould_risk: string;
    recommendation: string | null;
    affected_area_sf: number | null;
    height_from_floor_cm: number | null;
    thermal_photo_url: string | null;
    visible_photo_url: string | null;
    device_model: string | null;
    scan_timestamp: string;
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address, property_city, claim_number, insurer_name, loss_date, job_type, status, current_step')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setJobs(jobsData || []);
      if (jobsData && jobsData.length > 0) setSelectedJobId(jobsData[0].id);
      setLoading(false);
    };
    init();
  }, [router]);

  useEffect(() => {
    if (!selectedJobId) { setReports([]); return; }
    const load = async () => {
      const { data } = await supabase
        .from('reports')
        .select('*')
        .eq('job_id', selectedJobId)
        .order('created_at', { ascending: false });
      setReports(data || []);
    };
    load();
  }, [selectedJobId]);

  const generateReport = async () => {
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) return;

    setGenerating(true); setError('');

    // Fetch supporting data
    const [stepsRes, moistureRes, photosRes, thermalRes] = await Promise.all([
      supabase.from('workflow_steps').select('*').eq('job_id', selectedJobId).order('step_number'),
      supabase.from('moisture_readings').select('*').eq('job_id', selectedJobId).order('created_at', { ascending: false }),
      supabase.from('damage_photos').select('id, tags, created_at').eq('job_id', selectedJobId),
      supabase.from('thermal_readings').select('*').eq('job_id', selectedJobId).order('scan_timestamp', { ascending: true }),
    ]);

    const steps = stepsRes.data || [];
    const readings = moistureRes.data || [];
    const photos = photosRes.data || [];
    const thermals: ThermalReading[] = (thermalRes.data || []);

    // Generate report content as HTML string
    const now = new Date().toLocaleString();
    const typeLabel = REPORT_TYPES.find(r => r.value === selectedType)?.label || selectedType;

    let content = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: linear-gradient(135deg, #0a1628 0%, #1e3a5f 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0;">
          <div style="font-size: 22px; font-weight: bold; margin-bottom: 4px;">RoomLensPro</div>
          <div style="font-size: 14px; opacity: 0.8;">Restoration Management Platform</div>
          <div style="margin-top: 20px; font-size: 18px; font-weight: 600;">${typeLabel}</div>
          <div style="font-size: 13px; opacity: 0.7; margin-top: 4px;">Generated: ${now}</div>
        </div>
        <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">Job Information</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding: 6px 0; color: #6b7280; width: 160px;">Insured Name</td><td style="font-weight: 600;">${job.insured_name}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Property Address</td><td>${job.property_address}${job.property_city ? `, ${job.property_city}` : ''}</td></tr>
            ${job.claim_number ? `<tr><td style="padding: 6px 0; color: #6b7280;">Claim Number</td><td style="font-family: monospace;">${job.claim_number}</td></tr>` : ''}
            ${job.insurer_name ? `<tr><td style="padding: 6px 0; color: #6b7280;">Insurer</td><td>${job.insurer_name}</td></tr>` : ''}
            ${job.loss_date ? `<tr><td style="padding: 6px 0; color: #6b7280;">Loss Date</td><td>${new Date(job.loss_date).toLocaleDateString()}</td></tr>` : ''}
            <tr><td style="padding: 6px 0; color: #6b7280;">Job Type</td><td style="text-transform: capitalize;">${job.job_type.replace(/_/g, ' ')}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Job Status</td><td><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">${job.status.toUpperCase()}</span></td></tr>
          </table>

          <h2 style="font-size: 16px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 24px; margin-bottom: 16px;">Workflow Progress — Step ${job.current_step} of 15</h2>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${steps.map(s => {
              const bg = s.status === 'complete' ? '#dcfce7' : s.status === 'in_progress' ? '#dbeafe' : '#f3f4f6';
              const col = s.status === 'complete' ? '#166534' : s.status === 'in_progress' ? '#1d4ed8' : '#9ca3af';
              return `<div style="background:${bg};color:${col};padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;">
                ${s.status === 'complete' ? '✓' : s.step_number}. ${s.step_name}
              </div>`;
            }).join('')}
          </div>
    `;

    // Type-specific sections
    if (selectedType === '24hr_report') {
      // ── Thermal risk colours ──────────────────────────────────────────────────
      const riskColour: Record<string, { bg: string; text: string; badge: string }> = {
        critical: { bg: '#fef2f2', text: '#991b1b', badge: '#dc2626' },
        high:     { bg: '#fff7ed', text: '#9a3412', badge: '#ea580c' },
        medium:   { bg: '#fffbeb', text: '#92400e', badge: '#d97706' },
        low:      { bg: '#f0fdf4', text: '#166534', badge: '#16a34a' },
      };
      const anomalyLabel: Record<string, string> = {
        wet_insulation:  '❄️ Wet Insulation',
        mould_heat:      '🦠 Mould Heat Signature',
        cold_bridge:     '🌡️ Cold Bridge',
        subfloor_wet:    '💧 Wet Subfloor',
        bottom_plate:    '⚠️ Saturated Bottom Plate',
        normal:          '✅ Normal',
      };

      const hasCritical = thermals.some(t => t.mould_risk === 'critical');
      const hasHigh     = thermals.some(t => t.mould_risk === 'high');
      const highestRisk = hasCritical ? 'critical' : hasHigh ? 'high' : thermals.length > 0 ? thermals[0].mould_risk : null;

      content += `
          <!-- ═══ INITIAL SITE ASSESSMENT ═══════════════════════════════════════ -->
          <h2 style="font-size: 16px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 24px; margin-bottom: 16px;">Initial Site Assessment</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding: 6px 0; color: #6b7280; width: 180px;">Photos Taken</td><td style="font-weight: 600;">${photos.length}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Initial MC Readings</td><td style="font-weight: 600;">${readings.length}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Thermal Scans</td><td style="font-weight: 600;">${thermals.length}${thermals.length > 0 ? ` <span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:700;margin-left:6px;">FLIR Documented</span>` : ' <span style="background:#f3f4f6;color:#9ca3af;padding:1px 6px;border-radius:999px;font-size:10px;">None recorded</span>'}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Response Time</td><td style="color: #059669; font-weight: 600;">Within 24 hours ✓</td></tr>
          </table>

          ${highestRisk && highestRisk !== 'low' ? `
          <div style="background:${riskColour[highestRisk]?.bg};border-left:4px solid ${riskColour[highestRisk]?.badge};padding:14px;border-radius:0 8px 8px 0;margin-top:16px;">
            <div style="font-weight:700;font-size:14px;color:${riskColour[highestRisk]?.text};margin-bottom:4px;">
              ${highestRisk === 'critical' ? '🚨 CRITICAL THERMAL ALERT' : highestRisk === 'high' ? '⚠️ HIGH MOULD RISK DETECTED' : '⚠️ THERMAL ANOMALY DETECTED'}
            </div>
            <div style="font-size:12px;color:${riskColour[highestRisk]?.text};">
              Infrared scan detected hidden moisture or mould heat signatures. Scope includes thermal-justified removal. See Thermal Findings section below.
            </div>
          </div>` : ''}

          ${thermals.length > 0 ? `
          <!-- ═══ THERMAL FINDINGS ════════════════════════════════════════════════ -->
          <h2 style="font-size: 16px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 28px; margin-bottom: 6px;">
            🌡️ Infrared Thermal Scan Findings
          </h2>
          <p style="font-size:12px;color:#6b7280;margin-bottom:14px;">
            Scanned with ${thermals[0].device_model || 'FLIR thermal camera'} on ${new Date(thermals[0].scan_timestamp).toLocaleDateString('en-CA')}.
            Temperature differentials ≥2°C indicate potential hidden moisture. Results are evidence-grade documentation.
          </p>

          <!-- Thermal summary bar -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#0f172a;">${thermals.length}</div>
              <div style="font-size:11px;color:#64748b;">Zones Scanned</div>
            </div>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#dc2626;">${thermals.filter(t => t.mould_risk === 'critical' || t.mould_risk === 'high').length}</div>
              <div style="font-size:11px;color:#dc2626;">High/Critical Risk</div>
            </div>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#d97706;">${thermals.filter(t => t.anomaly_type && t.anomaly_type !== 'normal').length}</div>
              <div style="font-size:11px;color:#d97706;">Anomalies Found</div>
            </div>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#16a34a;">${thermals.reduce((sum, t) => sum + (t.affected_area_sf || 0), 0).toFixed(0)} SF</div>
              <div style="font-size:11px;color:#16a34a;">Affected Area</div>
            </div>
          </div>

          <!-- Per-zone thermal detail table -->
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0;color:#374151;">Room / Zone</th>
                <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0;color:#374151;">Wall</th>
                <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #e2e8f0;color:#374151;">Surface °C</th>
                <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #e2e8f0;color:#374151;">Ambient °C</th>
                <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #e2e8f0;color:#374151;">Δ Temp</th>
                <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0;color:#374151;">Finding</th>
                <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #e2e8f0;color:#374151;">Moisture %</th>
                <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #e2e8f0;color:#374151;">Risk</th>
              </tr>
            </thead>
            <tbody>
              ${thermals.map(t => {
                const risk = riskColour[t.mould_risk] || riskColour.low;
                const deltaAbs = t.temp_delta_c != null ? Math.abs(t.temp_delta_c) : null;
                const deltaColor = deltaAbs == null ? '#9ca3af' : deltaAbs >= 3 ? '#dc2626' : deltaAbs >= 1.5 ? '#d97706' : '#16a34a';
                return `<tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:7px 10px;font-weight:600;color:#1e293b;">${t.room_name}</td>
                  <td style="padding:7px 10px;color:#64748b;text-transform:uppercase;font-size:11px;">${t.wall_direction || '—'}</td>
                  <td style="padding:7px 10px;text-align:center;">${t.surface_temp_c != null ? t.surface_temp_c + '°C' : '—'}</td>
                  <td style="padding:7px 10px;text-align:center;">${t.ambient_temp_c != null ? t.ambient_temp_c + '°C' : '—'}</td>
                  <td style="padding:7px 10px;text-align:center;font-weight:700;color:${deltaColor};">${t.temp_delta_c != null ? (t.temp_delta_c > 0 ? '+' : '') + t.temp_delta_c + '°C' : '—'}</td>
                  <td style="padding:7px 10px;">${t.anomaly_type ? (anomalyLabel[t.anomaly_type] || t.anomaly_type) : '—'}</td>
                  <td style="padding:7px 10px;text-align:center;font-weight:600;color:${deltaColor};">${t.moisture_probability != null ? t.moisture_probability + '%' : '—'}</td>
                  <td style="padding:7px 10px;text-align:center;">
                    <span style="background:${risk.bg};color:${risk.text};border:1px solid ${risk.badge};padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;">
                      ${t.mould_risk}
                    </span>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>

          <!-- Thermal photo pairs -->
          ${thermals.filter(t => t.thermal_photo_url || t.visible_photo_url).length > 0 ? `
          <h3 style="font-size:14px;font-weight:600;color:#374151;margin-top:20px;margin-bottom:10px;">Thermal + Visible Photo Evidence</h3>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
            ${thermals.filter(t => t.thermal_photo_url || t.visible_photo_url).map(t => `
            <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <div style="background:#f8fafc;padding:8px 10px;font-size:11px;font-weight:600;color:#374151;border-bottom:1px solid #e2e8f0;">
                ${t.room_name}${t.wall_direction ? ' — ' + t.wall_direction + ' wall' : ''}
                <span style="float:right;background:${(riskColour[t.mould_risk] || riskColour.low).bg};color:${(riskColour[t.mould_risk] || riskColour.low).text};padding:1px 6px;border-radius:999px;font-size:10px;">${t.mould_risk.toUpperCase()}</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
                ${t.thermal_photo_url ? `<div><img src="${t.thermal_photo_url}" alt="Thermal" style="width:100%;height:120px;object-fit:cover;display:block;"/><div style="padding:4px 8px;font-size:10px;color:#6b7280;background:#fef3c7;">🌡️ Thermal</div></div>` : '<div style="background:#f9fafb;height:140px;display:flex;align-items:center;justify-content:center;color:#d1d5db;font-size:11px;">No thermal photo</div>'}
                ${t.visible_photo_url ? `<div><img src="${t.visible_photo_url}" alt="Visible" style="width:100%;height:120px;object-fit:cover;display:block;"/><div style="padding:4px 8px;font-size:10px;color:#6b7280;background:#f9fafb;">📷 Visible</div></div>` : '<div style="background:#f9fafb;height:140px;display:flex;align-items:center;justify-content:center;color:#d1d5db;font-size:11px;">No visible photo</div>'}
              </div>
              ${t.recommendation ? `<div style="padding:8px 10px;font-size:11px;color:#374151;border-top:1px solid #e2e8f0;background:#fffbeb;">📋 ${t.recommendation}</div>` : ''}
            </div>`).join('')}
          </div>` : ''}

          <!-- Xactimate thermal-justified line items -->
          ${thermals.filter(t => t.anomaly_type && t.anomaly_type !== 'normal' && t.affected_area_sf).length > 0 ? `
          <h3 style="font-size:14px;font-weight:600;color:#374151;margin-top:20px;margin-bottom:10px;">Thermal-Justified Xactimate Scope</h3>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#f8fafc;">
              <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0;">Location</th>
              <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0;">Line Item</th>
              <th style="padding:7px 10px;text-align:center;border-bottom:2px solid #e2e8f0;">Qty</th>
              <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0;">Evidence</th>
            </tr></thead>
            <tbody>
              ${thermals.filter(t => t.anomaly_type && t.anomaly_type !== 'normal' && t.affected_area_sf).flatMap(t => {
                const items: string[] = [];
                const sf = t.affected_area_sf?.toFixed(1) || '0';
                if (t.anomaly_type === 'wet_insulation') {
                  items.push(`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 10px;color:#374151;">${t.room_name}</td><td style="padding:6px 10px;">Remove drywall — thermal justified</td><td style="padding:6px 10px;text-align:center;font-weight:600;">${sf} SF</td><td style="padding:6px 10px;font-size:11px;color:#92400e;">ΔT: ${t.temp_delta_c}°C · ${t.moisture_probability}% moisture probability</td></tr>`);
                  items.push(`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 10px;color:#374151;"></td><td style="padding:6px 10px;">Remove wet insulation</td><td style="padding:6px 10px;text-align:center;font-weight:600;">${sf} SF</td><td style="padding:6px 10px;font-size:11px;color:#92400e;">Infrared confirmed</td></tr>`);
                }
                if (t.anomaly_type === 'mould_heat') {
                  items.push(`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 10px;color:#374151;">${t.room_name}</td><td style="padding:6px 10px;">Mould remediation — IICRC S520</td><td style="padding:6px 10px;text-align:center;font-weight:600;">${sf} SF</td><td style="padding:6px 10px;font-size:11px;color:#991b1b;">Thermal heat signature +${Math.abs(t.temp_delta_c || 0)}°C</td></tr>`);
                  items.push(`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 10px;"></td><td style="padding:6px 10px;">Containment setup + neg. air pressure</td><td style="padding:6px 10px;text-align:center;font-weight:600;">1 EA</td><td style="padding:6px 10px;font-size:11px;color:#991b1b;">Mould protocol required</td></tr>`);
                }
                if (t.anomaly_type === 'bottom_plate') {
                  items.push(`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 10px;color:#374151;">${t.room_name}</td><td style="padding:6px 10px;">Remove & replace bottom plate</td><td style="padding:6px 10px;text-align:center;font-weight:600;">${(t.height_from_floor_cm || 60) / 100 * 3.28} LF</td><td style="padding:6px 10px;font-size:11px;color:#92400e;">Thermal: saturation at floor junction</td></tr>`);
                }
                if (t.anomaly_type === 'subfloor_wet') {
                  items.push(`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 10px;color:#374151;">${t.room_name}</td><td style="padding:6px 10px;">Remove wet subfloor</td><td style="padding:6px 10px;text-align:center;font-weight:600;">${sf} SF</td><td style="padding:6px 10px;font-size:11px;color:#92400e;">Thermal: subfloor cold zone detected</td></tr>`);
                }
                return items;
              }).join('')}
            </tbody>
          </table>` : ''}

          ` : ''}

          <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 0 8px 8px 0; margin-top: 16px; font-size: 13px; color: #92400e;">
            ⚠️ This is an automatically generated 24-hour initial report. All data reflects conditions as recorded at time of initial site visit. Thermal readings are timestamped evidence and comply with IICRC S500 / S520 documentation standards.
          </div>
      `;
    }

    if (selectedType === 'daily_moisture' && readings.length > 0) {
      const byDay: Record<number, typeof readings> = {};
      readings.forEach(r => {
        if (!byDay[r.visit_day]) byDay[r.visit_day] = [];
        byDay[r.visit_day].push(r);
      });
      content += `
          <h2 style="font-size: 16px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 24px; margin-bottom: 16px;">Moisture Readings Log (${readings.length} total)</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead><tr style="background:#f9fafb;">
              <th style="padding: 8px; text-align:left; border-bottom: 2px solid #e5e7eb;">Visit Day</th>
              <th style="padding: 8px; text-align:left; border-bottom: 2px solid #e5e7eb;">Material</th>
              <th style="padding: 8px; text-align:center; border-bottom: 2px solid #e5e7eb;">MC%</th>
              <th style="padding: 8px; text-align:center; border-bottom: 2px solid #e5e7eb;">RH%</th>
              <th style="padding: 8px; text-align:center; border-bottom: 2px solid #e5e7eb;">Temp °F</th>
              <th style="padding: 8px; text-align:center; border-bottom: 2px solid #e5e7eb;">Status</th>
            </tr></thead>
            <tbody>
              ${readings.slice(0, 50).map(r => {
                const dry_threshold: Record<string, number> = { wood: 19, drywall: 12, concrete: 4, subfloor: 19, ceiling: 12, other: 15 };
                const threshold = dry_threshold[r.material_type] || 15;
                const isDry = r.mc_percent <= threshold;
                return `<tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding:6px 8px;">Day ${r.visit_day}</td>
                  <td style="padding:6px 8px; text-transform:capitalize;">${r.material_type}</td>
                  <td style="padding:6px 8px; text-align:center; font-weight:600; color:${isDry ? '#059669' : '#dc2626'};">${r.mc_percent}%</td>
                  <td style="padding:6px 8px; text-align:center;">${r.rh_percent ? r.rh_percent + '%' : '—'}</td>
                  <td style="padding:6px 8px; text-align:center;">${r.temp_f ? r.temp_f + '°F' : '—'}</td>
                  <td style="padding:6px 8px; text-align:center;">
                    <span style="background:${isDry ? '#dcfce7' : '#fee2e2'};color:${isDry ? '#166534' : '#991b1b'};padding:2px 6px;border-radius:999px;font-size:10px;font-weight:600;">
                      ${isDry ? 'DRY' : 'WET'}
                    </span>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
      `;
    }

    if (selectedType === 'adjuster_summary') {
      const completedSteps = steps.filter(s => s.status === 'complete').length;
      content += `
          <h2 style="font-size: 16px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 24px; margin-bottom: 16px;">Summary for Adjuster</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;">
              <div style="font-size:24px;font-weight:bold;color:#0369a1;">${completedSteps}/15</div>
              <div style="font-size:12px;color:#0369a1;">Workflow Steps Complete</div>
            </div>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;">
              <div style="font-size:24px;font-weight:bold;color:#166534;">${photos.length}</div>
              <div style="font-size:12px;color:#166534;">Damage Photos Documented</div>
            </div>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;">
              <div style="font-size:24px;font-weight:bold;color:#92400e;">${readings.length}</div>
              <div style="font-size:12px;color:#92400e;">Moisture Readings Logged</div>
            </div>
            <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;">
              <div style="font-size:24px;font-weight:bold;color:#6b21a8;">${Math.round((completedSteps / 15) * 100)}%</div>
              <div style="font-size:12px;color:#6b21a8;">Overall Job Completion</div>
            </div>
          </div>
          <p style="font-size:13px;color:#374151;line-height:1.6;">This report was prepared by a certified restoration professional using RoomLensPro. All documentation, moisture readings, and photo evidence are securely stored and available for review.</p>
      `;
    }

    content += `
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af;">
            <span>Generated by RoomLensPro · ${now}</span>
            <span>IICRC S500 Compliant Documentation</span>
          </div>
        </div>
      </div>
    `;

    // Save report to DB
    const { data: reportRecord, error: insertErr } = await supabase
      .from('reports')
      .insert({
        job_id: selectedJobId,
        report_type: selectedType,
      })
      .select()
      .single();

    if (insertErr) {
      setError(insertErr.message);
    } else if (reportRecord) {
      setReports(prev => [reportRecord, ...prev]);
      setSuccess(`${typeLabel} generated!`);
      setTimeout(() => setSuccess(''), 4000);
      setShowNewReport(false);
      setPreviewReport({ job, type: selectedType, content });
    }
    setGenerating(false);
  };

  const printReport = (content: string) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>RoomLensPro Report</title></head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-[#0a0f1e]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" /> Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {reports.length} report{reports.length !== 1 ? 's' : ''} · {selectedJob?.insured_name || 'No job selected'}
          </p>
        </div>
        <button
          onClick={() => setShowNewReport(!showNewReport)}
          disabled={!selectedJobId}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
        >
          <Plus className="w-4 h-4" /> Generate Report
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-sm rounded-lg p-3">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
        </div>
      )}

      {/* Job Selector */}
      <div className="relative inline-block">
        <select
          value={selectedJobId}
          onChange={e => setSelectedJobId(e.target.value)}
          className="appearance-none pl-3 pr-8 py-2 border border-slate-600/50 rounded-xl bg-slate-700/50 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        >
          {jobs.length === 0 && <option value="">No jobs yet</option>}
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.insured_name} — {j.property_address}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
      </div>

      {/* New Report Panel */}
      {showNewReport && (
        <div className="bg-white rounded-xl border border-cyan-700/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-200">Select Report Type</h3>
            <button onClick={() => setShowNewReport(false)}><X className="w-4 h-4 text-slate-500" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REPORT_TYPES.map(rt => (
              <button
                key={rt.value}
                onClick={() => setSelectedType(rt.value)}
                className={`text-left p-4 rounded-xl border-2 transition ${
                  selectedType === rt.value
                    ? 'border-blue-500 bg-cyan-500/10'
                    : 'border-slate-700/50 hover:border-blue-300 bg-white'
                }`}
              >
                <div className="text-2xl mb-2">{rt.icon}</div>
                <div className="text-sm font-semibold text-slate-200 mb-1">{rt.label}</div>
                <div className="text-xs text-slate-500 leading-snug">{rt.description}</div>
              </button>
            ))}
          </div>
          <button
            onClick={generateReport}
            disabled={generating}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
            {generating ? 'Generating…' : 'Generate Report'}
          </button>
        </div>
      )}

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-16 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium mb-2">
            {jobs.length === 0 ? 'Create a job first.' : 'No reports generated yet.'}
          </p>
          <p className="text-sm text-slate-600">Click "Generate Report" to create your first report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <div key={report.id} className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-4 flex items-center gap-4 hover:shadow-sm transition">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 truncate">
                  {TYPE_LABELS[report.report_type] || report.report_type}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(report.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {report.pdf_url && (
                  <a href={report.pdf_url} target="_blank" rel="noreferrer"
                    className="p-2 hover:bg-slate-700/50 rounded-lg transition text-slate-500 hover:text-slate-300">
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => {
                    const job = jobs.find(j => j.id === report.job_id);
                    if (job) setPreviewReport({ job, type: report.report_type, content: '<p class="text-slate-500 text-sm p-8 text-center">Re-generate this report to view its content.</p>' });
                  }}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition text-slate-500 hover:text-cyan-400"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('Delete this report?')) return;
                    await supabase.from('reports').delete().eq('id', report.id);
                    setReports(prev => prev.filter(r => r.id !== report.id));
                  }}
                  className="p-2 hover:bg-red-50 rounded-lg transition text-slate-600 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Preview Modal */}
      {previewReport && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewReport(null)}>
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-slate-800/60 border-b border-slate-700/50 flex items-center justify-between p-4 z-10">
              <h3 className="font-semibold text-slate-200">{TYPE_LABELS[previewReport.type] || previewReport.type}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printReport(previewReport.content)}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 border border-slate-600/50 rounded-xl bg-slate-700/50 text-white hover:bg-slate-700/30 transition"
                >
                  <Printer className="w-4 h-4" /> Print / PDF
                </button>
                <button
                  onClick={() => setPreviewReport(null)}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
            <div className="p-6" dangerouslySetInnerHTML={{ __html: previewReport.content }} />
          </div>
        </div>
      )}
    </div>
  );
}
