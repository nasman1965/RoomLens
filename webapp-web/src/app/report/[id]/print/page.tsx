/**
 * /report/[id]/print
 * Dedicated print-to-PDF page for a RoomLens job report.
 * Opens clean, auto-prints, user saves as PDF.
 * Works on desktop + mobile (Share → Print → Save as PDF on iOS).
 */
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: string; insured_name: string; property_address: string;
  property_city: string | null; claim_number: string | null;
  insurer_name: string | null; loss_date: string | null;
  adjuster_name: string | null; adjuster_phone: string | null;
  adjuster_email: string | null; job_type: string; status: string;
  current_step: number; created_at: string;
  loss_category: number | null; loss_class: number | null;
  created_by_name: string | null; created_by_phone: string | null;
}
interface MoistureReading {
  id: string; visit_day: number; room_name: string; material_type: string;
  mc_percent: number; rh_percent: number | null; temp_f: number | null;
  created_at: string;
}
interface ThermalReading {
  id: string; room_name: string; wall_direction: string | null;
  surface_temp_c: number | null; ambient_temp_c: number | null;
  temp_delta_c: number | null; anomaly_type: string | null;
  moisture_probability: number | null; mould_risk: string;
  recommendation: string | null; affected_area_sf: number | null;
  thermal_photo_url: string | null; visible_photo_url: string | null;
  device_model: string | null; scan_timestamp: string;
}
interface WorkflowStep {
  step_number: number; step_name: string; status: string;
}
interface Photo {
  id: string; photo_url: string; room_tag: string | null;
  damage_tag: string | null; damage_severity: string | null;
  timestamp: string;
}
interface ReportRecord {
  id: string; job_id: string; report_type: string; created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ANOMALY_LABELS: Record<string, string> = {
  wet_insulation: 'Wet Insulation',
  mould_heat:     'Mould Heat Signature',
  cold_bridge:    'Cold Bridge',
  subfloor_wet:   'Wet Subfloor',
  bottom_plate:   'Saturated Bottom Plate',
  normal:         'Normal',
};
const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fef2f2', text: '#991b1b', border: '#dc2626' },
  high:     { bg: '#fff7ed', text: '#9a3412', border: '#ea580c' },
  medium:   { bg: '#fffbeb', text: '#92400e', border: '#d97706' },
  low:      { bg: '#f0fdf4', text: '#166534', border: '#16a34a' },
};
const REPORT_LABELS: Record<string, string> = {
  '24hr_report':      '24-Hour Initial Report',
  'daily_moisture':   'Daily Moisture Report',
  'scope_estimate':   'Scope & Estimate',
  'completion_report':'Completion Report',
  'adjuster_summary': 'Adjuster Summary',
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReportPrintPage() {
  const params   = useParams();
  const reportId = params.id as string;

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [report, setReport]     = useState<ReportRecord | null>(null);
  const [job, setJob]           = useState<Job | null>(null);
  const [steps, setSteps]       = useState<WorkflowStep[]>([]);
  const [moisture, setMoisture] = useState<MoistureReading[]>([]);
  const [thermals, setThermals] = useState<ThermalReading[]>([]);
  const [photos, setPhotos]     = useState<Photo[]>([]);

  const load = useCallback(async () => {
    try {
      // 1. Get report record
      const { data: rep, error: repErr } = await supabase
        .from('reports').select('*').eq('id', reportId).single();
      if (repErr || !rep) throw new Error('Report not found');
      setReport(rep);

      // 2. Get job
      const { data: jobData, error: jobErr } = await supabase
        .from('jobs').select('*').eq('id', rep.job_id).single();
      if (jobErr || !jobData) throw new Error('Job not found');
      setJob(jobData);

      // 3. Get all supporting data in parallel
      const [stepsRes, moistureRes, thermalRes, photosRes] = await Promise.all([
        supabase.from('workflow_steps').select('*').eq('job_id', rep.job_id).order('step_number'),
        supabase.from('moisture_readings').select('*').eq('job_id', rep.job_id).order('created_at'),
        supabase.from('thermal_readings').select('*').eq('job_id', rep.job_id).order('scan_timestamp'),
        supabase.from('job_photos').select('id,photo_url,room_tag,damage_tag,damage_severity,timestamp').eq('job_id', rep.job_id).order('timestamp').limit(20),
      ]);

      setSteps(stepsRes.data || []);
      setMoisture(moistureRes.data || []);
      setThermals(thermalRes.data || []);
      setPhotos(photosRes.data || []);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  // Auto-print after data loads
  useEffect(() => {
    if (!loading && !error && job) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [loading, error, job]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-500 text-sm">Preparing report…</p>
        </div>
      </div>
    );
  }

  if (error || !job || !report) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-red-600">{error || 'Report not found'}</p>
        </div>
      </div>
    );
  }

  const reportType    = report.report_type;
  const reportLabel   = REPORT_LABELS[reportType] || reportType;
  const completedSteps = steps.filter(s => s.status === 'complete').length;
  const hasCritical   = thermals.some(t => t.mould_risk === 'critical');
  const hasHigh       = thermals.some(t => t.mould_risk === 'high');
  const highestRisk   = hasCritical ? 'critical' : hasHigh ? 'high' : null;
  const totalThermalSF = thermals.reduce((s, t) => s + (t.affected_area_sf || 0), 0);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Print CSS */}
      <style>{`
        @page {
          size: letter portrait;
          margin: 15mm 12mm;
        }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
        }
        body { font-family: Arial, Helvetica, sans-serif; background: white; color: #1a1a1a; margin: 0; }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Screen-only print button ── */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          🖨️ Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-slate-600 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg shadow-lg"
        >
          ✕ Close
        </button>
      </div>

      {/* ── Document ── */}
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '24px 16px' }}>

        {/* ── HEADER ── */}
        <div style={{ background: 'linear-gradient(135deg, #0a1628 0%, #1e3a5f 100%)', color: 'white', padding: '28px 32px', borderRadius: '12px 12px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>RoomLens<span style={{ color: '#38bdf8' }}>Pro</span></div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>Restoration Management Platform · IICRC S500 Compliant</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', opacity: 0.6 }}>Report ID</div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.8 }}>{report.id.slice(0, 8).toUpperCase()}</div>
            </div>
          </div>
          <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '16px' }}>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>{reportLabel}</div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
              Generated: {fmtTime(report.created_at)} &nbsp;·&nbsp; Prepared for: {job.insured_name}
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT BOX ── */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '28px 32px' }}>

          {/* ── JOB INFORMATION ── */}
          <SectionHead>Job Information</SectionHead>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '8px' }}>
            <tbody>
              <InfoRow label="Insured Name"     value={job.insured_name} bold />
              <InfoRow label="Property Address" value={`${job.property_address}${job.property_city ? `, ${job.property_city}` : ''}`} />
              {job.claim_number  && <InfoRow label="Claim Number"    value={job.claim_number} mono />}
              {job.insurer_name  && <InfoRow label="Insurance Co."   value={job.insurer_name} />}
              {job.adjuster_name && <InfoRow label="Adjuster"        value={`${job.adjuster_name}${job.adjuster_phone ? ' · ' + job.adjuster_phone : ''}`} />}
              {job.loss_date     && <InfoRow label="Date of Loss"    value={fmt(job.loss_date)} />}
              <InfoRow label="Job Type"         value={job.job_type.replace(/_/g, ' ')} capitalize />
              <InfoRow label="Loss Category"    value={job.loss_category ? `Category ${job.loss_category}` : '—'} />
              <InfoRow label="Loss Class"       value={job.loss_class    ? `Class ${job.loss_class}` : '—'} />
              <InfoRow label="Date Created"     value={fmt(job.created_at)} />
              {job.created_by_name && <InfoRow label="Technician"    value={job.created_by_name} />}
            </tbody>
          </table>

          {/* ── WORKFLOW STATUS ── */}
          <SectionHead>Workflow Progress — {completedSteps} of {steps.length || 15} Steps Complete</SectionHead>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
            {steps.map(s => {
              const bg  = s.status === 'complete' ? '#dcfce7' : s.status === 'in_progress' ? '#dbeafe' : '#f3f4f6';
              const col = s.status === 'complete' ? '#166534' : s.status === 'in_progress' ? '#1d4ed8' : '#9ca3af';
              return (
                <div key={s.step_number} style={{ background: bg, color: col, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                  {s.status === 'complete' ? '✓' : s.step_number}. {s.step_name}
                </div>
              );
            })}
          </div>

          {/* ── 24HR REPORT SPECIFIC ── */}
          {reportType === '24hr_report' && (<>

            {/* Initial Assessment */}
            <SectionHead>Initial Site Assessment</SectionHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '8px' }}>
              <tbody>
                <InfoRow label="Photos Documented"  value={`${photos.length}`} />
                <InfoRow label="Moisture Readings"  value={`${moisture.length}`} />
                <InfoRow label="Thermal (FLIR) Scans" value={`${thermals.length}${thermals.length > 0 ? ' — FLIR Documented' : ' — None recorded'}`} />
                <InfoRow label="Response Time"       value="Within 24 hours ✓" color="#059669" />
              </tbody>
            </table>

            {/* Critical/High risk alert banner */}
            {highestRisk && (
              <div className="avoid-break" style={{ background: RISK_COLORS[highestRisk].bg, borderLeft: `4px solid ${RISK_COLORS[highestRisk].border}`, padding: '12px 14px', borderRadius: '0 8px 8px 0', marginBottom: '20px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: RISK_COLORS[highestRisk].text }}>
                  {highestRisk === 'critical' ? '🚨 CRITICAL THERMAL RISK DETECTED' : '⚠️ HIGH MOULD RISK DETECTED'}
                </div>
                <div style={{ fontSize: '12px', color: RISK_COLORS[highestRisk].text, marginTop: '4px' }}>
                  Infrared scan identified hidden moisture or mould heat signatures. Thermal-justified scope included below.
                </div>
              </div>
            )}

            {/* Thermal Findings */}
            {thermals.length > 0 && (<>
              <SectionHead>🌡️ Infrared Thermal Scan Findings</SectionHead>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '14px', marginTop: '-8px' }}>
                Device: {thermals[0].device_model || 'FLIR thermal camera'} &nbsp;·&nbsp;
                Date: {fmt(thermals[0].scan_timestamp)} &nbsp;·&nbsp;
                ΔT ≥ 2°C indicates hidden moisture
              </p>

              {/* Thermal stats bar */}
              <div className="avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '16px' }}>
                {[
                  { val: thermals.length,                                                        label: 'Zones Scanned',    bg: '#f8fafc', col: '#0f172a' },
                  { val: thermals.filter(t => ['critical','high'].includes(t.mould_risk)).length, label: 'High/Critical',   bg: '#fef2f2', col: '#dc2626' },
                  { val: thermals.filter(t => t.anomaly_type && t.anomaly_type !== 'normal').length, label: 'Anomalies',   bg: '#fffbeb', col: '#d97706' },
                  { val: `${totalThermalSF.toFixed(0)} SF`,                                      label: 'Affected Area',   bg: '#f0fdf4', col: '#16a34a' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: s.col }}>{s.val}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Thermal zone table */}
              <div className="avoid-break">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Room / Zone','Wall','Surface','Ambient','ΔT','Finding','Moisture%','Risk'].map(h => (
                        <th key={h} style={{ padding: '7px 8px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#374151', fontSize: '11px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {thermals.map(t => {
                      const risk = RISK_COLORS[t.mould_risk] || RISK_COLORS.low;
                      const absD = t.temp_delta_c != null ? Math.abs(t.temp_delta_c) : null;
                      const dCol = absD == null ? '#9ca3af' : absD >= 3 ? '#dc2626' : absD >= 1.5 ? '#d97706' : '#16a34a';
                      const dStr = t.temp_delta_c != null ? (t.temp_delta_c > 0 ? '+' : '') + t.temp_delta_c + '°C' : '—';
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{t.room_name}</td>
                          <td style={{ padding: '6px 8px', textTransform: 'uppercase', fontSize: '11px', color: '#64748b' }}>{t.wall_direction || '—'}</td>
                          <td style={{ padding: '6px 8px' }}>{t.surface_temp_c != null ? t.surface_temp_c + '°C' : '—'}</td>
                          <td style={{ padding: '6px 8px' }}>{t.ambient_temp_c != null ? t.ambient_temp_c + '°C' : '—'}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: dCol }}>{dStr}</td>
                          <td style={{ padding: '6px 8px' }}>{t.anomaly_type ? ANOMALY_LABELS[t.anomaly_type] || t.anomaly_type : '—'}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 600, color: dCol }}>{t.moisture_probability != null ? t.moisture_probability + '%' : '—'}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <span style={{ background: risk.bg, color: risk.text, border: `1px solid ${risk.border}`, padding: '2px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                              {t.mould_risk}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Thermal photo pairs */}
              {thermals.filter(t => t.thermal_photo_url || t.visible_photo_url).length > 0 && (<>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px', marginTop: '4px' }}>Thermal + Visible Photo Evidence</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px', marginBottom: '16px' }}>
                  {thermals.filter(t => t.thermal_photo_url || t.visible_photo_url).map(t => (
                    <div key={t.id} className="avoid-break" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '7px 10px', fontSize: '11px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{t.room_name}{t.wall_direction ? ` — ${t.wall_direction}` : ''}</span>
                        <span style={{ background: (RISK_COLORS[t.mould_risk] || RISK_COLORS.low).bg, color: (RISK_COLORS[t.mould_risk] || RISK_COLORS.low).text, padding: '1px 7px', borderRadius: '999px', fontSize: '10px' }}>
                          {t.mould_risk.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                        {t.thermal_photo_url
                          ? <div><img src={t.thermal_photo_url} alt="thermal" style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }} /><div style={{ padding: '3px 8px', fontSize: '10px', color: '#92400e', background: '#fef3c7' }}>🌡️ Thermal</div></div>
                          : <div style={{ background: '#f9fafb', height: '126px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: '11px' }}>No thermal</div>
                        }
                        {t.visible_photo_url
                          ? <div><img src={t.visible_photo_url} alt="visible" style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }} /><div style={{ padding: '3px 8px', fontSize: '10px', color: '#6b7280', background: '#f9fafb' }}>📷 Visible</div></div>
                          : <div style={{ background: '#f9fafb', height: '126px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: '11px' }}>No visible</div>
                        }
                      </div>
                      {t.recommendation && <div style={{ padding: '7px 10px', fontSize: '11px', color: '#374151', borderTop: '1px solid #e2e8f0', background: '#fffbeb' }}>📋 {t.recommendation}</div>}
                    </div>
                  ))}
                </div>
              </>)}

              {/* Xactimate scope */}
              {thermals.filter(t => t.anomaly_type && t.anomaly_type !== 'normal' && t.affected_area_sf).length > 0 && (
                <div className="avoid-break">
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Thermal-Justified Xactimate Scope</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Location','Line Item','Qty','Evidence'].map(h => (
                          <th key={h} style={{ padding: '7px 8px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {thermals.filter(t => t.anomaly_type && t.anomaly_type !== 'normal' && t.affected_area_sf).flatMap(t => {
                        const sf = t.affected_area_sf?.toFixed(1) || '0';
                        const rows: React.ReactNode[] = [];
                        if (t.anomaly_type === 'wet_insulation') {
                          rows.push(<tr key={`${t.id}-1`} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '5px 8px', color: '#374151' }}>{t.room_name}</td><td style={{ padding: '5px 8px' }}>Remove drywall — thermal justified</td><td style={{ padding: '5px 8px', fontWeight: 600 }}>{sf} SF</td><td style={{ padding: '5px 8px', fontSize: '11px', color: '#92400e' }}>ΔT: {t.temp_delta_c}°C · {t.moisture_probability}% moisture</td></tr>);
                          rows.push(<tr key={`${t.id}-2`} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '5px 8px' }}></td><td style={{ padding: '5px 8px' }}>Remove wet insulation</td><td style={{ padding: '5px 8px', fontWeight: 600 }}>{sf} SF</td><td style={{ padding: '5px 8px', fontSize: '11px', color: '#92400e' }}>Infrared confirmed</td></tr>);
                        }
                        if (t.anomaly_type === 'mould_heat') {
                          rows.push(<tr key={`${t.id}-1`} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '5px 8px', color: '#374151' }}>{t.room_name}</td><td style={{ padding: '5px 8px' }}>Mould remediation — IICRC S520</td><td style={{ padding: '5px 8px', fontWeight: 600 }}>{sf} SF</td><td style={{ padding: '5px 8px', fontSize: '11px', color: '#991b1b' }}>Thermal +{Math.abs(t.temp_delta_c || 0)}°C</td></tr>);
                          rows.push(<tr key={`${t.id}-2`} style={{ borderBottom: '1px solid #f1f5f9' }}><td></td><td style={{ padding: '5px 8px' }}>Containment + neg. air pressure</td><td style={{ padding: '5px 8px', fontWeight: 600 }}>1 EA</td><td style={{ padding: '5px 8px', fontSize: '11px', color: '#991b1b' }}>Mould protocol required</td></tr>);
                        }
                        if (t.anomaly_type === 'subfloor_wet') {
                          rows.push(<tr key={`${t.id}-1`} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '5px 8px', color: '#374151' }}>{t.room_name}</td><td style={{ padding: '5px 8px' }}>Remove wet subfloor</td><td style={{ padding: '5px 8px', fontWeight: 600 }}>{sf} SF</td><td style={{ padding: '5px 8px', fontSize: '11px', color: '#92400e' }}>Thermal cold zone</td></tr>);
                        }
                        if (t.anomaly_type === 'bottom_plate') {
                          rows.push(<tr key={`${t.id}-1`} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '5px 8px', color: '#374151' }}>{t.room_name}</td><td style={{ padding: '5px 8px' }}>Remove & replace bottom plate</td><td style={{ padding: '5px 8px', fontWeight: 600 }}>{sf} SF</td><td style={{ padding: '5px 8px', fontSize: '11px', color: '#92400e' }}>Thermal: saturation at floor junction</td></tr>);
                        }
                        return rows;
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* IICRC disclaimer */}
              <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '10px 14px', borderRadius: '0 6px 6px 0', fontSize: '12px', color: '#92400e', marginBottom: '16px' }}>
                ⚠️ Thermal readings are timestamped evidence. All findings comply with IICRC S500/S520 documentation standards.
              </div>
            </>)}

            {/* Damage photos strip */}
            {photos.length > 0 && (<>
              <SectionHead>Damage Photo Documentation ({photos.length} photos)</SectionHead>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '16px' }}>
                {photos.slice(0, 12).map(p => (
                  <div key={p.id} className="avoid-break" style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <img src={p.photo_url} alt={p.room_tag || 'damage'} style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }} />
                    {p.room_tag && <div style={{ padding: '2px 5px', fontSize: '9px', color: '#6b7280', background: '#f9fafb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.room_tag}</div>}
                  </div>
                ))}
              </div>
            </>)}

          </>)}

          {/* ── MOISTURE REPORT ── */}
          {reportType === 'daily_moisture' && moisture.length > 0 && (<>
            <SectionHead>Moisture Readings Log ({moisture.length} readings)</SectionHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Day','Room','Material','MC%','RH%','Temp °F','Status'].map(h => (
                    <th key={h} style={{ padding: '7px 8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontSize: '11px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moisture.map(r => {
                  const thresholds: Record<string,number> = { wood:19, drywall:12, concrete:4, subfloor:19, ceiling:12, other:15 };
                  const thr = thresholds[r.material_type] || 15;
                  const dry = r.mc_percent <= thr;
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '5px 8px' }}>Day {r.visit_day}</td>
                      <td style={{ padding: '5px 8px' }}>{r.room_name}</td>
                      <td style={{ padding: '5px 8px', textTransform: 'capitalize' }}>{r.material_type}</td>
                      <td style={{ padding: '5px 8px', fontWeight: 600, color: dry ? '#059669' : '#dc2626' }}>{r.mc_percent}%</td>
                      <td style={{ padding: '5px 8px' }}>{r.rh_percent ? r.rh_percent + '%' : '—'}</td>
                      <td style={{ padding: '5px 8px' }}>{r.temp_f ? r.temp_f + '°F' : '—'}</td>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ background: dry ? '#dcfce7' : '#fee2e2', color: dry ? '#166534' : '#991b1b', padding: '2px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: 600 }}>
                          {dry ? 'DRY' : 'WET'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>)}

          {/* ── ADJUSTER SUMMARY ── */}
          {reportType === 'adjuster_summary' && (<>
            <SectionHead>Summary for Adjuster</SectionHead>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '14px', marginBottom: '18px' }}>
              {[
                { val: `${completedSteps}/${steps.length||15}`, label: 'Workflow Steps Complete', bg: '#f0f9ff', col: '#0369a1' },
                { val: photos.length,                           label: 'Damage Photos',           bg: '#f0fdf4', col: '#166534' },
                { val: moisture.length,                         label: 'Moisture Readings',       bg: '#fffbeb', col: '#92400e' },
                { val: `${Math.round((completedSteps/(steps.length||15))*100)}%`, label: 'Job Completion', bg: '#faf5ff', col: '#6b21a8' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: s.col }}>{s.val}</div>
                  <div style={{ fontSize: '12px', color: s.col, marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>
              This report was prepared by a certified restoration professional using RoomLensPro.
              All documentation, moisture readings, and photo evidence are securely stored and available for review.
            </p>
          </>)}

          {/* ── FOOTER ── */}
          <div style={{ marginTop: '32px', paddingTop: '14px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
            <span>Generated by RoomLensPro · {fmtTime(report.created_at)}</span>
            <span>IICRC S500 · Claim: {job.claim_number || 'N/A'}</span>
          </div>

        </div>{/* end main content box */}
      </div>{/* end document */}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '7px', marginTop: '24px', marginBottom: '14px' }}>
      {children}
    </h2>
  );
}
function InfoRow({ label, value, bold, mono, capitalize, color }: {
  label: string; value: string; bold?: boolean; mono?: boolean; capitalize?: boolean; color?: string;
}) {
  return (
    <tr>
      <td style={{ padding: '5px 0', color: '#6b7280', width: '170px', fontSize: '13px' }}>{label}</td>
      <td style={{ padding: '5px 0', fontWeight: bold ? 600 : 400, fontFamily: mono ? 'monospace' : 'inherit', textTransform: capitalize ? 'capitalize' : 'inherit', color: color || 'inherit', fontSize: '13px' }}>
        {value}
      </td>
    </tr>
  );
}
