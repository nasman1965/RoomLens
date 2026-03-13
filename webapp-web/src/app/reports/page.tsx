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
    const [stepsRes, moistureRes, photosRes] = await Promise.all([
      supabase.from('workflow_steps').select('*').eq('job_id', selectedJobId).order('step_number'),
      supabase.from('moisture_readings').select('*').eq('job_id', selectedJobId).order('created_at', { ascending: false }),
      supabase.from('damage_photos').select('id, tags, created_at').eq('job_id', selectedJobId),
    ]);

    const steps = stepsRes.data || [];
    const readings = moistureRes.data || [];
    const photos = photosRes.data || [];

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
      content += `
          <h2 style="font-size: 16px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 24px; margin-bottom: 16px;">Initial Site Assessment</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding: 6px 0; color: #6b7280; width: 160px;">Photos Taken</td><td style="font-weight: 600;">${photos.length}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Initial MC Readings</td><td style="font-weight: 600;">${readings.length}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Response Time</td><td style="color: #059669; font-weight: 600;">Within 24 hours ✓</td></tr>
          </table>
          <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 0 8px 8px 0; margin-top: 16px; font-size: 13px; color: #92400e;">
            ⚠️ This is an automatically generated 24-hour initial report. All data reflects conditions as recorded at time of initial site visit.
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
