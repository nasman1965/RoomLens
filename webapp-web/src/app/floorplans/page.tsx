'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Map, Upload, Briefcase, Loader2, AlertCircle,
  Trash2, ZoomIn, X, Calendar, Layers
} from 'lucide-react';

interface Job {
  id: string;
  insured_name: string;
  property_address: string;
}

interface FloorPlan {
  id: string;
  job_id: string;
  source: string;
  image_url?: string | null;
  svg_data?: string | null;
  rooms?: Record<string, unknown> | null;
  total_area?: number | null;
  scale?: number | null;
  created_at: string;
}

interface FloorPlanScan {
  id: string;
  job_id: string;
  raw_image_url: string | null;
  processed_image_url: string | null;
  scale_factor: number | null;
  room_data: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  scan:       { label: 'AI Scan',       color: 'bg-purple-100 text-purple-700' },
  manual:     { label: 'Manual Upload', color: 'bg-blue-100 text-blue-700'    },
  imported:   { label: 'Imported',      color: 'bg-green-100 text-green-700'  },
};

const SCAN_STATUS: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: 'bg-gray-100 text-gray-500'    },
  processing: { label: 'Processing', color: 'bg-yellow-100 text-yellow-700' },
  complete:   { label: 'Complete',   color: 'bg-green-100 text-green-700'  },
  failed:     { label: 'Failed',     color: 'bg-red-100 text-red-600'      },
};

export default function FloorPlansPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [scans, setScans] = useState<FloorPlanScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);

      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setJobs(jobData || []);
      if (jobData && jobData.length > 0) setSelectedJobId(jobData[0].id);
      setLoading(false);
    };
    init();
  }, [router]);

  useEffect(() => {
    if (!selectedJobId) { setPlans([]); setScans([]); return; }
    const load = async () => {
      const [planRes, scanRes] = await Promise.all([
        supabase.from('floor_plans').select('*').eq('job_id', selectedJobId).order('created_at', { ascending: false }),
        supabase.from('floor_plan_scans').select('*').eq('job_id', selectedJobId).order('created_at', { ascending: false }),
      ]);
      setPlans(planRes.data || []);
      setScans(scanRes.data || []);
    };
    load();
  }, [selectedJobId]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !selectedJobId) return;
    setUploading(true);
    setError('');

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const isSvg = file.type === 'image/svg+xml' || file.name.endsWith('.svg');

      if (!isImage) { setError('Only image files are supported.'); continue; }

      const ext = file.name.split('.').pop();
      const path = `${userId}/${selectedJobId}/${Date.now()}.${ext}`;

      if (isSvg) {
        // Read SVG as text
        const text = await file.text();
        await supabase.from('floor_plans').insert({
          job_id: selectedJobId,
          source: 'manual',
          svg_data: text,
        });
      } else {
        // Upload raster image
        const { error: stErr } = await supabase.storage
          .from('floor-plan-scans')
          .upload(path, file, { contentType: file.type });

        if (stErr) { setError(`Upload failed: ${stErr.message}`); continue; }

        const { data: { publicUrl } } = supabase.storage
          .from('floor-plan-scans')
          .getPublicUrl(path);

        // Insert both a scan record and a floor_plan record
        await Promise.all([
          supabase.from('floor_plan_scans').insert({
            job_id: selectedJobId,
            raw_image_url: publicUrl,
            status: 'complete',
          }),
          supabase.from('floor_plans').insert({
            job_id: selectedJobId,
            source: 'manual',
          }),
        ]);
      }
    }

    // Refresh
    const [planRes, scanRes] = await Promise.all([
      supabase.from('floor_plans').select('*').eq('job_id', selectedJobId).order('created_at', { ascending: false }),
      supabase.from('floor_plan_scans').select('*').eq('job_id', selectedJobId).order('created_at', { ascending: false }),
    ]);
    setPlans(planRes.data || []);
    setScans(scanRes.data || []);
    setUploading(false);
  };

  const deleteScan = async (id: string) => {
    if (!confirm('Delete this floor plan scan?')) return;
    await supabase.from('floor_plan_scans').delete().eq('id', id);
    setScans(prev => prev.filter(s => s.id !== id));
    if (preview && scans.find(s => s.id === id)?.raw_image_url === preview) setPreview(null);
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this floor plan?')) return;
    await supabase.from('floor_plans').delete().eq('id', id);
    setPlans(prev => prev.filter(p => p.id !== id));
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
            <Map className="w-6 h-6 text-blue-600" /> Floor Plans
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Upload and manage property floor plans per job</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!selectedJobId || uploading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading…' : 'Upload Floor Plan'}
        </button>
        <input ref={fileRef} type="file" accept="image/*,.svg,.pdf" multiple className="hidden"
          onChange={e => handleUpload(e.target.files)} />
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
                  {job.insured_name}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <Map className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Drag & drop floor plan images here, or <span className="text-blue-600 font-medium">click to browse</span></p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, SVG supported — multiple files OK</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Floor Plans</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{plans.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Scans</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{scans.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Job</p>
              <p className="text-sm font-semibold text-gray-700 mt-1 truncate">{selectedJob?.insured_name}</p>
            </div>
          </div>

          {/* Scans grid */}
          {scans.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-500" /> Scan Images ({scans.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {scans.map(scan => (
                  <div key={scan.id}
                    className="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-square hover:border-blue-400 transition">
                    {scan.raw_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={scan.raw_image_url} alt="Floor plan scan"
                        className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Map className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      {scan.raw_image_url && (
                        <button onClick={() => setPreview(scan.raw_image_url!)}
                          className="p-2 bg-white/90 rounded-full text-gray-800 hover:bg-white transition">
                          <ZoomIn className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => deleteScan(scan.id)}
                        className="p-2 bg-red-500/90 rounded-full text-white hover:bg-red-600 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Status badge */}
                    <div className="absolute top-1.5 left-1.5">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${SCAN_STATUS[scan.status]?.color || 'bg-gray-100 text-gray-500'}`}>
                        {SCAN_STATUS[scan.status]?.label || scan.status}
                      </span>
                    </div>
                    <div className="absolute bottom-1 right-1">
                      <span className="text-[9px] bg-black/50 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Calendar className="w-2 h-2" />
                        {new Date(scan.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Floor plans list */}
          {plans.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Map className="w-4 h-4 text-green-500" /> Floor Plan Records ({plans.length})
              </h2>
              <div className="space-y-2">
                {plans.map(plan => (
                  <div key={plan.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Map className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SOURCE_LABELS[plan.source]?.color || 'bg-gray-100 text-gray-500'}`}>
                          {SOURCE_LABELS[plan.source]?.label || plan.source}
                        </span>
                        {plan.total_area && (
                          <span className="text-xs text-gray-500">{plan.total_area} sq ft</span>
                        )}
                        {plan.svg_data && (
                          <span className="text-xs text-purple-600 font-medium">SVG</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(plan.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => deletePlan(plan.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plans.length === 0 && scans.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <Map className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No floor plans for <strong>{selectedJob?.insured_name}</strong> yet.</p>
              <p className="text-xs text-gray-400 mt-1">Upload a floor plan image or SVG using the button above.</p>
            </div>
          )}
        </>
      )}

      {/* Image preview lightbox */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}>
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreview(null)}
              className="absolute top-3 right-3 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition">
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Floor plan" className="w-full max-h-[85vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
