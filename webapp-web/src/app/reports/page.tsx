'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  FileText, Plus, Briefcase, Loader2, AlertCircle,
  Download, Share2, CheckCircle, Clock, X, Eye
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
  created_at: string;
}

interface Report {
  id: string;
  job_id: string;
  report_type: string;
  pdf_url: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  is_shared: boolean | null;
  created_at: string;
}

const REPORT_TYPES: Record<string, { label: string; desc: string; icon: string; color: string }> = {
  '24hr_report':      { label: '24-Hour Report',      desc: 'Initial damage summary sent to insurer within 24 hrs', icon: '⚡', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  'daily_log':        { label: 'Daily Drying Log',     desc: 'Moisture readings and equipment status per visit',      icon: '📋', color: 'bg-blue-100 text-blue-700 border-blue-200'   },
  'moisture_map':     { label: 'Moisture Map Report',  desc: 'Full IICRC moisture readings export',                   icon: '💧', color: 'bg-cyan-100 text-cyan-700 border-cyan-200'   },
  'final_scope':      { label: 'Final Scope',          desc: 'Completed scope of work for insurer review',            icon: '📝', color: 'bg-green-100 text-green-700 border-green-200' },
  'close_report':     { label: 'Job Close Report',     desc: 'Full job summary, equipment log, and sign-off',         icon: '✅', color: 'bg-gray-100 text-gray-700 border-gray-200'   },
  'adjuster_summary': { label: 'Adjuster Summary',     desc: 'Clean overview for insurance adjuster portal',          icon: '🏢', color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const STATUS_BADGE: Record<string, string> = {
  new:        'bg-blue-100 text-blue-700',
  dispatched: 'bg-purple-100 text-purple-700',
  active:     'bg-green-100 text-green-700',
  review:     'bg-yellow-100 text-yellow-700',
  closed:     'bg-gray-100 text-gray-500',
};

const JOB_ICONS: Record<string, string> = {
  water_loss: '💧', fire_loss: '🔥', mold: '🌿', large_loss: '🏗️', other: '📋',
};

export default function ReportsPage() {
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedType, setSelectedType] = useState('24hr_report');
  const [previewReport, setPreviewReport] = useState<Report | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address, property_city, claim_number, insurer_name, loss_date, job_type, status, current_step, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setJobs(jobData || []);
      if (jobData && jobData.length > 0) setSelectedJobId(jobData[0].id);
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
    if (!selectedJobId) return;
    setGenerating(true); setError('');

    try {
      // Fetch job data for the report
      const { data: job } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', selectedJobId)
        .single();

      if (!job) { setError('Job not found.'); return; }

      // Insert report record
      const { error: insErr } = await supabase.from('reports').insert({
        job_id: selectedJobId,
        report_type: selectedType,
        pdf_url: null,         // PDF generation would be triggered here
        is_shared: false,
      });

      if (insErr) { setError(insErr.message); return; }

      // Refresh reports
      const { data } = await supabase
        .from('reports')
        .select('*')
        .eq('job_id', selectedJobId)
        .order('created_at', { ascending: false });
      setReports(data || []);
      setShowGenerateModal(false);
    } finally {
      setGenerating(false);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Delete this report?')) return;
    await supabase.from('reports').delete().eq('id', id);
    setReports(prev => prev.filter(r => r.id !== id));
    if (previewReport?.id === id) setPreviewReport(null);
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" /> Reports
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate and manage job reports</p>
        </div>
        {selectedJobId && (
          <button onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm">
            <Plus className="w-4 h-4" /> Generate Report
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No jobs found. Create a job first.</p>
          <Link href="/jobs/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-700 transition">
            + New Job
          </Link>
        </div>
      ) : (
        <>
          {/* Job selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Job</label>
            <div className="flex flex-wrap gap-2">
              {jobs.map(job => (
                <button key={job.id} onClick={() => setSelectedJobId(job.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
                    selectedJobId === job.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                  }`}>
                  {JOB_ICONS[job.job_type]} {job.insured_name}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Selected job summary card */}
          {selectedJob && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-gray-800">
                      {JOB_ICONS[selectedJob.job_type]} {selectedJob.insured_name}
                    </h2>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[selectedJob.status] || 'bg-gray-100 text-gray-600'}`}>
                      {selectedJob.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{selectedJob.property_address}{selectedJob.property_city ? `, ${selectedJob.property_city}` : ''}</p>
                  {selectedJob.claim_number && <p className="text-xs text-gray-400 mt-0.5">Claim: {selectedJob.claim_number}</p>}
                  {selectedJob.insurer_name && <p className="text-xs text-gray-400">Insurer: {selectedJob.insurer_name}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Step</p>
                  <p className="text-2xl font-bold text-blue-600">{selectedJob.current_step}<span className="text-sm text-gray-400">/15</span></p>
                  <p className="text-xs text-gray-400 mt-0.5">{reports.length} report{reports.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${((selectedJob.current_step - 1) / 14) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Report type quick-select tiles */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Available Report Types</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(REPORT_TYPES).map(([type, info]) => {
                const existing = reports.filter(r => r.report_type === type);
                return (
                  <button
                    key={type}
                    onClick={() => { setSelectedType(type); setShowGenerateModal(true); }}
                    className={`text-left p-4 rounded-xl border-2 hover:shadow-md transition group ${info.color}`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{info.icon}</span>
                      {existing.length > 0 && (
                        <span className="text-[10px] font-bold bg-white/70 px-1.5 py-0.5 rounded-full">
                          {existing.length}×
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold mt-2">{info.label}</p>
                    <p className="text-xs opacity-70 mt-0.5 leading-tight">{info.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generated reports list */}
          {reports.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Generated Reports ({reports.length})</h2>
              <div className="space-y-2">
                {reports.map(report => {
                  const info = REPORT_TYPES[report.report_type];
                  return (
                    <div key={report.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition group">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-lg">
                        {info?.icon || '📄'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{info?.label || report.report_type}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(report.created_at).toLocaleString()}
                          </span>
                          {report.pdf_url ? (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <CheckCircle className="w-2.5 h-2.5" /> PDF Ready
                            </span>
                          ) : (
                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                              Processing
                            </span>
                          )}
                          {report.is_shared && (
                            <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Share2 className="w-2.5 h-2.5" /> Shared
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setPreviewReport(report)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Eye className="w-4 h-4" />
                        </button>
                        {report.pdf_url && (
                          <a href={report.pdf_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition">
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button onClick={() => deleteReport(report.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No reports for <strong>{selectedJob?.insured_name}</strong> yet.</p>
              <p className="text-xs text-gray-400 mt-1">Click a report type above or &quot;Generate Report&quot; to create one.</p>
            </div>
          )}
        </>
      )}

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowGenerateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Generate Report</h3>
              <button onClick={() => setShowGenerateModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(REPORT_TYPES).map(([type, info]) => (
                    <button key={type} type="button"
                      onClick={() => setSelectedType(type)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition ${
                        selectedType === type
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}>
                      <span className="text-xl shrink-0">{info.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{info.label}</p>
                        <p className="text-xs text-gray-500">{info.desc}</p>
                      </div>
                      {selectedType === type && <CheckCircle className="w-4 h-4 text-blue-600 ml-auto shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {selectedJob && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm">
                  <p className="font-medium text-gray-700">Generating for:</p>
                  <p className="text-gray-600">{selectedJob.insured_name} — {selectedJob.property_address}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowGenerateModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition text-sm">
                  Cancel
                </button>
                <button onClick={generateReport} disabled={generating}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition text-sm">
                  {generating
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                    : <><FileText className="w-4 h-4" /> Generate</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Preview Modal */}
      {previewReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewReport(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                {REPORT_TYPES[previewReport.report_type]?.icon} {REPORT_TYPES[previewReport.report_type]?.label}
              </h3>
              <button onClick={() => setPreviewReport(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Job</p>
                  <p className="font-medium text-gray-800">{selectedJob?.insured_name}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Created</p>
                  <p className="font-medium text-gray-800">{new Date(previewReport.created_at).toLocaleDateString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <p className={`font-semibold ${previewReport.pdf_url ? 'text-green-600' : 'text-yellow-600'}`}>
                    {previewReport.pdf_url ? '✅ PDF Ready' : '⏳ Processing'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Shared</p>
                  <p className={`font-semibold ${previewReport.is_shared ? 'text-blue-600' : 'text-gray-500'}`}>
                    {previewReport.is_shared ? '🔗 Yes' : 'No'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400">{REPORT_TYPES[previewReport.report_type]?.desc}</p>
              <div className="flex gap-3">
                {previewReport.pdf_url && (
                  <a href={previewReport.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition text-sm">
                    <Download className="w-4 h-4" /> Download PDF
                  </a>
                )}
                <button onClick={() => deleteReport(previewReport.id)}
                  className="px-4 py-2.5 text-red-600 border border-red-300 hover:bg-red-50 rounded-lg font-medium text-sm transition">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
