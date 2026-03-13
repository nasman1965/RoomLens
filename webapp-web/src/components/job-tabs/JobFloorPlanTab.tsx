'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Map, Upload, Loader2, X, ZoomIn, FileImage, Layers, Ruler,
  ExternalLink, Download, RefreshCw, CheckCircle2, Clock,
  AlertCircle, Smartphone, Send, Info, ChevronRight,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FloorPlan {
  id: string; job_id: string; source: string; svg_data: string | null;
  total_area: number | null; rooms: { name: string; area?: number; type?: string }[] | null;
  created_at: string;
}
interface FloorPlanScan {
  id: string; job_id: string; image_url: string; status: string; created_at: string;
}
interface MagicplanProject {
  id: string;
  job_id: string;
  magicplan_project_id: string | null;
  status: 'pending' | 'created' | 'scanning' | 'exported' | 'ready' | 'error';
  esx_file_url: string | null;
  floor_plan_pdf_url: string | null;
  total_area_sqft: number | null;
  room_count: number | null;
  rooms_json: { name: string; area?: number; width?: number; length?: number }[] | null;
  notes: string | null;
  error_message: string | null;
  esx_received_at: string | null;
  created_at: string;
}

interface JobData {
  insured_name?: string;
  property_address?: string;
  claim_number?: string;
  insurer_name?: string;
  job_type?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: '✏️ Manual', scan: '📷 Scan', ai_generated: '✨ AI Generated', imported: '📂 Imported',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  pending:  { label: 'Not Started',    color: 'bg-gray-100 text-gray-600',    icon: <Clock className="w-4 h-4" />,         description: 'No magicplan project created yet' },
  created:  { label: 'Project Created', color: 'bg-blue-100 text-blue-700',   icon: <CheckCircle2 className="w-4 h-4" />,   description: 'magicplan project is ready — open the app and start scanning' },
  scanning: { label: 'Scanning',        color: 'bg-yellow-100 text-yellow-700', icon: <Smartphone className="w-4 h-4" />,   description: 'Tech is scanning rooms in magicplan' },
  exported: { label: 'ESX Exported',    color: 'bg-purple-100 text-purple-700', icon: <Download className="w-4 h-4" />,     description: 'Floor plan exported — ready to upload to Xactimate' },
  ready:    { label: 'Ready',           color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-4 h-4" />,   description: 'ESX file ready for Xactimate' },
  error:    { label: 'Error',           color: 'bg-red-100 text-red-700',      icon: <AlertCircle className="w-4 h-4" />,    description: 'Something went wrong' },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function JobFloorPlanTab({
  jobId,
  userId,
  jobData,
}: {
  jobId: string;
  userId: string;
  jobData?: JobData;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // data state
  const [floorPlans,   setFloorPlans]   = useState<FloorPlan[]>([]);
  const [scans,        setScans]        = useState<FloorPlanScan[]>([]);
  const [mpProject,    setMpProject]    = useState<MagicplanProject | null>(null);

  // ui state
  const [loading,      setLoading]      = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [syncing,      setSyncing]      = useState(false);
  const [activeTab,    setActiveTab]    = useState<'magicplan' | 'plans' | 'scans'>('magicplan');
  const [lightboxScan, setLightboxScan] = useState<FloorPlanScan | null>(null);
  const [lightboxPlan, setLightboxPlan] = useState<FloorPlan | null>(null);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [showHelp,     setShowHelp]     = useState(false);

  useEffect(() => { load(); }, [jobId]);

  // Auto-poll while status is 'created' or 'scanning'
  useEffect(() => {
    if (!mpProject) return;
    if (mpProject.status === 'created' || mpProject.status === 'scanning') {
      const interval = setInterval(() => syncMagicplan(false), 30_000);
      return () => clearInterval(interval);
    }
  }, [mpProject?.status]);

  const load = async () => {
    setLoading(true);
    const [plansRes, scansRes, mpRes] = await Promise.all([
      supabase.from('floor_plans').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
      supabase.from('floor_plan_scans').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
      fetch(`/api/magicplan?job_id=${jobId}`).then(r => r.json()).catch(() => ({ project: null })),
    ]);
    setFloorPlans(plansRes.data || []);
    setScans(scansRes.data || []);
    setMpProject(mpRes.project || null);
    setLoading(false);
  };

  // ── Create magicplan project ─────────────────────────────────────────────────
  const createMagicplanProject = async () => {
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/magicplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_project',
          job_id: jobId,
          user_id: userId,
          job_data: jobData,
        }),
      });
      const data = await res.json();
      if (data.error && !data.project) {
        setError(data.error);
      } else {
        setMpProject(data.project);
        setSuccess(
          data.already_exists
            ? 'magicplan project already exists.'
            : data.error
              ? `Project saved locally. magicplan API: ${data.error}`
              : '✅ magicplan project created! Open the app to start scanning.'
        );
        setTimeout(() => setSuccess(''), 6000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Sync status with magicplan API ──────────────────────────────────────────
  const syncMagicplan = async (showFeedback = true) => {
    if (!mpProject?.magicplan_project_id) return;
    if (showFeedback) setSyncing(true);
    try {
      const res = await fetch('/api/magicplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_status',
          magicplan_record_id: mpProject.id,
          magicplan_project_id: mpProject.magicplan_project_id,
        }),
      });
      const data = await res.json();
      if (data.synced) {
        // Reload record from DB
        const refresh = await fetch(`/api/magicplan?job_id=${jobId}`).then(r => r.json());
        setMpProject(refresh.project);
        if (showFeedback) { setSuccess('Synced with magicplan ✓'); setTimeout(() => setSuccess(''), 3000); }
      }
    } catch (err: any) {
      if (showFeedback) setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // ── Upload scan ──────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const path = `${userId}/${jobId}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error: storageErr } = await supabase.storage.from('floor-plan-scans').upload(path, file, { contentType: file.type });
    if (storageErr) { setError(storageErr.message); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('floor-plan-scans').getPublicUrl(path);
    const { data: scanRecord } = await supabase.from('floor_plan_scans').insert({ job_id: jobId, image_url: publicUrl, status: 'uploaded' }).select().single();
    if (scanRecord) setScans(prev => [scanRecord, ...prev]);
    setUploading(false);
    setSuccess('Floor plan scan uploaded! 📐'); setTimeout(() => setSuccess(''), 3000);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setActiveTab('scans');
  };

  const createManual = async () => {
    const areaStr = prompt('Total area (sq ft):');
    const area = parseFloat(areaStr || '0');
    if (!area) return;
    const { data: plan } = await supabase.from('floor_plans').insert({ job_id: jobId, source: 'manual', total_area: area, rooms: [] }).select().single();
    if (plan) { setFloorPlans(prev => [plan, ...prev]); setSuccess('Manual floor plan created!'); setTimeout(() => setSuccess(''), 3000); }
  };

  const deleteScan = async (scan: FloorPlanScan) => {
    if (!confirm('Delete scan?')) return;
    const path = scan.image_url.split('/floor-plan-scans/')[1];
    if (path) await supabase.storage.from('floor-plan-scans').remove([path]);
    await supabase.from('floor_plan_scans').delete().eq('id', scan.id);
    setScans(prev => prev.filter(s => s.id !== scan.id));
    if (lightboxScan?.id === scan.id) setLightboxScan(null);
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  const mpStatus = mpProject ? STATUS_CONFIG[mpProject.status] : STATUS_CONFIG['pending'];
  const hasEsx   = !!(mpProject?.esx_file_url);
  const hasRooms = !!(mpProject?.rooms_json?.length);

  return (
    <div className="space-y-4">

      {/* ── Top Tab Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 border-b border-gray-200 w-full sm:w-auto">
          {([
            ['magicplan', `🏠 magicplan${mpProject ? ` · ${mpStatus.label}` : ''}`],
            ['plans',     `📐 Floor Plans (${floorPlans.length})`],
            ['scans',     `📷 Scans (${scans.length})`],
          ] as [typeof activeTab, string][]).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
        {/* Right actions */}
        <div className="flex gap-2">
          <button onClick={createManual}
            className="flex items-center gap-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm px-3 py-2 rounded-lg transition">
            <Layers className="w-4 h-4" /> Manual
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Scan
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* ── Alerts ───────────────────────────────────────────────────────────── */}
      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 flex-shrink-0" />{success}</div>}

      {/* ═══════════════════════════════════════════════════════════════════════
          MAGICPLAN TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'magicplan' && (
        <div className="space-y-4">

          {/* ── Status Banner ─────────────────────────────────────────────── */}
          {mpProject ? (
            <div className={`rounded-xl border p-4 flex items-start gap-3 ${
              mpProject.status === 'ready' || mpProject.status === 'exported'
                ? 'bg-green-50 border-green-200'
                : mpProject.status === 'error'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-blue-50 border-blue-200'
            }`}>
              <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full ${mpStatus.color}`}>
                {mpStatus.icon}
                {mpStatus.label}
              </span>
              <div className="flex-1">
                <p className="text-sm text-gray-700">{mpStatus.description}</p>
                {mpProject.error_message && (
                  <p className="text-xs text-red-600 mt-1">{mpProject.error_message}</p>
                )}
                {mpProject.esx_received_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    ESX received: {new Date(mpProject.esx_received_at).toLocaleString()}
                  </p>
                )}
              </div>
              {mpProject.magicplan_project_id && (
                <button onClick={() => syncMagicplan(true)} disabled={syncing}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-100 transition flex-shrink-0">
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sync
                </button>
              )}
            </div>
          ) : (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Map className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-base">magicplan Floor Plan</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Create a magicplan project linked to this job. Your tech opens the magicplan app,
                    scans each room, and exports directly to Xactimate. ESX file downloads here automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── ESX Download (when available) ─────────────────────────────── */}
          {(mpProject?.status === 'exported' || mpProject?.status === 'ready') && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Download className="w-5 h-5 text-green-600" />
                Xactimate Files
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {hasEsx ? (
                  <a href={mpProject.esx_file_url!} download
                    className="flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-3 rounded-xl transition">
                    <Download className="w-5 h-5" />
                    <div className="text-left">
                      <p className="text-sm font-semibold">Download ESX File</p>
                      <p className="text-xs text-green-200">Drag into Xactimate to import</p>
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 bg-gray-100 text-gray-500 px-4 py-3 rounded-xl">
                    <Clock className="w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium">ESX Pending</p>
                      <p className="text-xs">Export from magicplan app → Verisk</p>
                    </div>
                  </div>
                )}
                {mpProject?.floor_plan_pdf_url && (
                  <a href={mpProject.floor_plan_pdf_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium px-4 py-3 rounded-xl transition">
                    <FileImage className="w-5 h-5 text-blue-500" />
                    <div className="text-left">
                      <p className="text-sm font-semibold">Floor Plan PDF</p>
                      <p className="text-xs text-gray-400">View or print</p>
                    </div>
                  </a>
                )}
              </div>

              {/* How to import to Xactimate */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                <p className="font-semibold text-gray-700">📋 How to import into Xactimate:</p>
                <p>1. Open Xactimate → Local Projects tab</p>
                <p>2. Drag &amp; drop the ESX file onto the projects list</p>
                <p>3. File appears as a new project — open and copy the sketch into your claim</p>
              </div>
            </div>
          )}

          {/* ── Room Data (when available) ─────────────────────────────────── */}
          {hasRooms && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-blue-500" />
                  Floor Plan Data
                </h3>
                {mpProject?.total_area_sqft && (
                  <span className="text-sm font-semibold text-blue-600">
                    {mpProject.total_area_sqft.toLocaleString()} sq ft total
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {mpProject!.rooms_json!.map((room, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-sm font-medium text-gray-800 truncate">{room.name}</p>
                    {room.area   && <p className="text-xs text-blue-600 font-medium">{room.area} ft²</p>}
                    {room.width && room.length && (
                      <p className="text-[10px] text-gray-400">{room.width}′ × {room.length}′</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step-by-Step Workflow ─────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setShowHelp(!showHelp)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
              <span className="font-semibold text-gray-700 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" /> How the magicplan workflow works
              </span>
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showHelp ? 'rotate-90' : ''}`} />
            </button>
            {showHelp && (
              <div className="px-5 pb-5 space-y-3 border-t border-gray-100">
                {[
                  ['1', 'Create Project', 'Click the button below. RoomLens creates a magicplan project pre-linked to this job.', 'blue'],
                  ['2', 'Open magicplan App', 'Your tech opens the magicplan iOS/Android app. The job appears automatically.', 'blue'],
                  ['3', 'Scan Each Room', 'Tech uses phone camera or LiDAR to sketch each room with dimensions.', 'yellow'],
                  ['4', 'Export → Verisk', 'In magicplan, tap Export → Files & Sharing → Verisk/Xactimate. ESX file is generated.', 'purple'],
                  ['5', 'Download ESX Here', 'The ESX file appears on this page. Click Download → drag into Xactimate.', 'green'],
                ].map(([num, title, desc, color]) => (
                  <div key={num} className="flex gap-3">
                    <span className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold bg-${color}-100 text-${color}-700`}>
                      {num}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{title}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    <strong>Cost:</strong> ~$40/project (magicplan PRO plan required).
                    Go to <a href="https://cloud.magicplan.app" target="_blank" rel="noreferrer" className="text-blue-600 underline">cloud.magicplan.app</a> to
                    subscribe and get your API key.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Create / Open magicplan Actions ──────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            {!mpProject || mpProject.status === 'error' ? (
              <button onClick={createMagicplanProject} disabled={creating}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold px-5 py-3 rounded-xl transition shadow-sm">
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Map className="w-5 h-5" />}
                {creating ? 'Creating project…' : 'Create magicplan Project'}
              </button>
            ) : (
              <>
                {mpProject.magicplan_project_id && (
                  <a
                    href={`https://cloud.magicplan.app/project/${mpProject.magicplan_project_id}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 font-semibold px-5 py-3 rounded-xl transition">
                    <ExternalLink className="w-4 h-4" />
                    Open in magicplan
                  </a>
                )}
                <button onClick={() => syncMagicplan(true)} disabled={syncing}
                  className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 py-3 rounded-xl transition">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sync Status
                </button>
              </>
            )}

            <a href="https://magicplan.app" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition">
              <ExternalLink className="w-4 h-4" /> magicplan.app
            </a>
          </div>

          {/* ── Project Metadata ─────────────────────────────────────────── */}
          {mpProject && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-0.5">
              <p>RoomLens project ID: <span className="font-mono">{mpProject.id.slice(0, 8)}…</span></p>
              {mpProject.magicplan_project_id && (
                <p>magicplan project ID: <span className="font-mono">{mpProject.magicplan_project_id}</span></p>
              )}
              <p>Created: {new Date(mpProject.created_at).toLocaleString()}</p>
              {mpProject.notes && <p>{mpProject.notes}</p>}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FLOOR PLANS TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'plans' && (
        floorPlans.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Map className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No floor plans yet</p>
            <p className="text-sm text-gray-400 mt-1">Use the magicplan tab to generate a floor plan, or create a manual plan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {floorPlans.map(plan => (
              <div key={plan.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition cursor-pointer"
                onClick={() => setLightboxPlan(plan)}>
                <div className="aspect-video bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center mb-4 overflow-hidden">
                  {plan.svg_data
                    ? <div dangerouslySetInnerHTML={{ __html: plan.svg_data }} className="w-full h-full" />
                    : <div className="text-center"><FileImage className="w-10 h-10 text-gray-300 mx-auto mb-1" /><p className="text-xs text-gray-400">No preview</p></div>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">{SOURCE_LABELS[plan.source] || plan.source}</span>
                    <span className="text-xs text-gray-400">{new Date(plan.created_at).toLocaleDateString()}</span>
                  </div>
                  {plan.total_area && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Ruler className="w-3.5 h-3.5 text-blue-500" />{plan.total_area.toLocaleString()} sq ft
                    </div>
                  )}
                  {plan.rooms && plan.rooms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {plan.rooms.slice(0, 4).map((r, i) => (
                        <span key={i} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {r.name}{r.area ? ` · ${r.area} ft²` : ''}
                        </span>
                      ))}
                      {plan.rooms.length > 4 && <span className="text-[10px] text-gray-400">+{plan.rooms.length - 4} more</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SCANS TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'scans' && (
        scans.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <FileImage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No scans yet</p>
            <p className="text-sm text-gray-400 mt-1">Click "Upload Scan" to add a photo of the floor plan</p>
            <p className="text-xs text-gray-400 mt-1">💡 Insta360 X4: export equirectangular JPEG for best results</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {scans.map(scan => (
              <div key={scan.id} className="group relative bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition">
                <div className="aspect-video cursor-pointer overflow-hidden bg-gray-100" onClick={() => setLightboxScan(scan)}>
                  <img src={scan.image_url} alt="Floor plan scan"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  scan.status === 'processed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>{scan.status}</span>
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => setLightboxScan(scan)} className="w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center">
                    <ZoomIn className="w-3.5 h-3.5 text-white" />
                  </button>
                  <button onClick={() => deleteScan(scan)} className="w-7 h-7 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <div className="p-2"><p className="text-[10px] text-gray-400">{new Date(scan.created_at).toLocaleDateString()}</p></div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Scan Lightbox ─────────────────────────────────────────────────────── */}
      {lightboxScan && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxScan(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightboxScan(null)} className="absolute -top-10 right-0 text-white"><X className="w-6 h-6" /></button>
            <img src={lightboxScan.image_url} alt="Scan" className="w-full rounded-xl max-h-[80vh] object-contain" />
            <div className="mt-2 flex items-center justify-between text-sm text-white/70">
              <span>Status: {lightboxScan.status}</span>
              <span>{new Date(lightboxScan.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Plan Lightbox ─────────────────────────────────────────────────────── */}
      {lightboxPlan && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxPlan(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{SOURCE_LABELS[lightboxPlan.source]} Floor Plan</h3>
              <button onClick={() => setLightboxPlan(null)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            {lightboxPlan.total_area && (
              <p className="text-sm text-gray-600 mb-3 flex items-center gap-1">
                <Ruler className="w-4 h-4 text-blue-500" /> Total: <strong>{lightboxPlan.total_area.toLocaleString()} sq ft</strong>
              </p>
            )}
            {lightboxPlan.rooms && lightboxPlan.rooms.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {lightboxPlan.rooms.map((r, i) => (
                  <div key={i} className="bg-slate-700/50 rounded-xl p-3 border border-slate-600/40">
                    <p className="text-sm font-medium text-white">{r.name}</p>
                    {r.type && <p className="text-xs text-slate-500 capitalize">{r.type}</p>}
                    {r.area && <p className="text-xs text-cyan-400 font-medium">{r.area} ft²</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">No room data.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
