'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Map, Upload, Loader2, AlertCircle, CheckCircle,
  ChevronDown, X, ZoomIn, FileImage, Layers, Ruler
} from 'lucide-react';

interface Job { id: string; insured_name: string; property_address: string; }
interface FloorPlan {
  id: string;
  job_id: string;
  source: string;
  svg_data: string | null;
  total_area: number | null;
  scale: number | null;
  created_at: string;
  rooms: { name: string; area?: number; type?: string }[] | null;
}
interface FloorPlanScan {
  id: string;
  job_id: string;
  image_url: string;
  status: string;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: '✏️ Manual',
  scan: '📷 Scan',
  ai_generated: '✨ AI Generated',
  imported: '📂 Imported',
};

export default function FloorPlansPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [scans, setScans] = useState<FloorPlanScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'plans' | 'scans'>('plans');
  const [lightboxScan, setLightboxScan] = useState<FloorPlanScan | null>(null);
  const [lightboxPlan, setLightboxPlan] = useState<FloorPlan | null>(null);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);

      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setJobs(jobsData || []);
      if (jobsData && jobsData.length > 0) setSelectedJobId(jobsData[0].id);
      setLoading(false);
    };
    init();
  }, [router]);

  useEffect(() => {
    if (!selectedJobId) { setFloorPlans([]); setScans([]); return; }
    const load = async () => {
      const [plansRes, scansRes] = await Promise.all([
        supabase.from('floor_plans').select('*').eq('job_id', selectedJobId).order('created_at', { ascending: false }),
        supabase.from('floor_plan_scans').select('*').eq('job_id', selectedJobId).order('created_at', { ascending: false }),
      ]);
      setFloorPlans(plansRes.data || []);
      setScans(scansRes.data || []);
    };
    load();
  }, [selectedJobId]);

  const handleScanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedJobId) return;

    setUploading(true); setError('');
    const ext = file.name.split('.').pop();
    const path = `${userId}/${selectedJobId}/${Date.now()}.${ext}`;

    const { error: storageErr } = await supabase.storage
      .from('floor-plan-scans')
      .upload(path, file, { contentType: file.type });

    if (storageErr) { setError(storageErr.message); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from('floor-plan-scans').getPublicUrl(path);

    const { data: scanRecord } = await supabase
      .from('floor_plan_scans')
      .insert({
        job_id: selectedJobId,
        image_url: publicUrl,
        status: 'uploaded',
      })
      .select()
      .single();

    if (scanRecord) setScans(prev => [scanRecord, ...prev]);
    setUploading(false);
    setSuccess('Floor plan scan uploaded!');
    setTimeout(() => setSuccess(''), 3000);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setActiveTab('scans');
  };

  const createManualPlan = async () => {
    if (!selectedJobId) return;
    const areaStr = prompt('Enter total area (sq ft):');
    const area = parseFloat(areaStr || '0');
    if (!area) return;

    const { data: plan } = await supabase
      .from('floor_plans')
      .insert({
        job_id: selectedJobId,
        source: 'manual',
        total_area: area,
        rooms: [],
      })
      .select()
      .single();

    if (plan) {
      setFloorPlans(prev => [plan, ...prev]);
      setSuccess('Manual floor plan created!');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const deleteScan = async (scan: FloorPlanScan) => {
    if (!confirm('Delete this scan?')) return;
    const path = scan.image_url.split('/floor-plan-scans/')[1];
    if (path) await supabase.storage.from('floor-plan-scans').remove([path]);
    await supabase.from('floor_plan_scans').delete().eq('id', scan.id);
    setScans(prev => prev.filter(s => s.id !== scan.id));
    if (lightboxScan?.id === scan.id) setLightboxScan(null);
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
          <p className="text-sm text-gray-500 mt-0.5">
            {floorPlans.length} plan{floorPlans.length !== 1 ? 's' : ''}, {scans.length} scan{scans.length !== 1 ? 's' : ''} · {selectedJob?.insured_name || 'No job selected'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={createManualPlan}
            disabled={!selectedJobId}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition"
          >
            <Layers className="w-4 h-4" /> New Manual Plan
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!selectedJobId || uploading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Scan
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleScanUpload} />
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
        </div>
      )}

      {/* Job Selector */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={selectedJobId}
            onChange={e => setSelectedJobId(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            {jobs.length === 0 && <option value="">No jobs yet</option>}
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.insured_name} — {j.property_address}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['plans', 'scans'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition capitalize ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'plans' ? `Floor Plans (${floorPlans.length})` : `Scan Images (${scans.length})`}
          </button>
        ))}
      </div>

      {/* Floor Plans Tab */}
      {activeTab === 'plans' && (
        <div>
          {floorPlans.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <Map className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium mb-2">
                {jobs.length === 0 ? 'Create a job first.' : 'No floor plans yet.'}
              </p>
              <p className="text-sm text-gray-400">Upload a scan or create a manual floor plan above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {floorPlans.map(plan => (
                <div
                  key={plan.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition cursor-pointer"
                  onClick={() => setLightboxPlan(plan)}
                >
                  {/* SVG Preview or placeholder */}
                  <div className="aspect-video bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center mb-4 overflow-hidden">
                    {plan.svg_data ? (
                      <div dangerouslySetInnerHTML={{ __html: plan.svg_data }} className="w-full h-full" />
                    ) : (
                      <div className="text-center">
                        <FileImage className="w-10 h-10 text-gray-300 mx-auto mb-1" />
                        <p className="text-xs text-gray-400">No visual data</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">{SOURCE_LABELS[plan.source] || plan.source}</span>
                      <span className="text-xs text-gray-400">{new Date(plan.created_at).toLocaleDateString()}</span>
                    </div>
                    {plan.total_area && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Ruler className="w-3.5 h-3.5 text-blue-500" />
                        {plan.total_area.toLocaleString()} sq ft total
                      </div>
                    )}
                    {plan.rooms && plan.rooms.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {plan.rooms.slice(0, 4).map((r, i) => (
                          <span key={i} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            {r.name}{r.area ? ` · ${r.area} ft²` : ''}
                          </span>
                        ))}
                        {plan.rooms.length > 4 && (
                          <span className="text-[10px] text-gray-400">+{plan.rooms.length - 4} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scans Tab */}
      {activeTab === 'scans' && (
        <div>
          {scans.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <FileImage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium mb-2">No floor plan scans yet.</p>
              <p className="text-sm text-gray-400">Click "Upload Scan" to add a photo or PDF of the floor plan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {scans.map(scan => (
                <div key={scan.id} className="group relative bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition">
                  <div
                    className="aspect-video cursor-pointer overflow-hidden bg-gray-100"
                    onClick={() => setLightboxScan(scan)}
                  >
                    <img
                      src={scan.image_url}
                      alt="Floor plan scan"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="%23f3f4f6"/><text x="50" y="35" text-anchor="middle" fill="%239ca3af" font-size="10">No preview</text></svg>'; }}
                    />
                  </div>
                  {/* Status badge */}
                  <div className="absolute top-1.5 left-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      scan.status === 'processed' ? 'bg-green-100 text-green-700' :
                      scan.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {scan.status}
                    </span>
                  </div>
                  {/* Actions */}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => setLightboxScan(scan)}
                      className="w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center"
                    >
                      <ZoomIn className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button
                      onClick={() => deleteScan(scan)}
                      className="w-7 h-7 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] text-gray-400">{new Date(scan.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scan Lightbox */}
      {lightboxScan && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxScan(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightboxScan(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300">
              <X className="w-6 h-6" />
            </button>
            <img src={lightboxScan.image_url} alt="Floor plan scan" className="w-full rounded-xl max-h-[80vh] object-contain" />
            <div className="mt-2 flex items-center justify-between text-sm text-white/70">
              <span>Status: {lightboxScan.status}</span>
              <span>{new Date(lightboxScan.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Plan Lightbox */}
      {lightboxPlan && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxPlan(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{SOURCE_LABELS[lightboxPlan.source]} Floor Plan</h3>
              <button onClick={() => setLightboxPlan(null)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            {lightboxPlan.total_area && (
              <p className="text-sm text-gray-600 mb-3 flex items-center gap-1">
                <Ruler className="w-4 h-4 text-blue-500" /> Total Area: <strong>{lightboxPlan.total_area.toLocaleString()} sq ft</strong>
              </p>
            )}
            {lightboxPlan.rooms && lightboxPlan.rooms.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 mb-2">Rooms ({lightboxPlan.rooms.length})</p>
                <div className="grid grid-cols-2 gap-2">
                  {lightboxPlan.rooms.map((r, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-sm font-medium text-gray-800">{r.name}</p>
                      {r.type && <p className="text-xs text-gray-500 capitalize">{r.type}</p>}
                      {r.area && <p className="text-xs text-blue-600 font-medium">{r.area} ft²</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No room data added yet.</p>
            )}
            <p className="text-xs text-gray-400 mt-4">Created {new Date(lightboxPlan.created_at).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
