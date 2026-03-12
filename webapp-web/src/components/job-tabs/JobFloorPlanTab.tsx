'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Map, Upload, Loader2, X, ZoomIn, FileImage, Layers, Ruler, Plus } from 'lucide-react';

interface FloorPlan {
  id: string; job_id: string; source: string; svg_data: string | null;
  total_area: number | null; rooms: { name: string; area?: number; type?: string }[] | null;
  created_at: string;
}
interface FloorPlanScan {
  id: string; job_id: string; image_url: string; status: string; created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: '✏️ Manual', scan: '📷 Scan', ai_generated: '✨ AI Generated', imported: '📂 Imported',
};

export default function JobFloorPlanTab({ jobId, userId }: { jobId: string; userId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [scans, setScans] = useState<FloorPlanScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plans' | 'scans'>('plans');
  const [lightboxScan, setLightboxScan] = useState<FloorPlanScan | null>(null);
  const [lightboxPlan, setLightboxPlan] = useState<FloorPlan | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, [jobId]);

  const load = async () => {
    setLoading(true);
    const [plansRes, scansRes] = await Promise.all([
      supabase.from('floor_plans').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
      supabase.from('floor_plan_scans').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
    ]);
    setFloorPlans(plansRes.data || []);
    setScans(scansRes.data || []);
    setLoading(false);
  };

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
    setSuccess('Floor plan uploaded! 📐'); setTimeout(() => setSuccess(''), 3000);
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 border-b border-gray-200 w-full sm:w-auto">
          {(['plans', 'scans'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition capitalize ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab === 'plans' ? `📐 Floor Plans (${floorPlans.length})` : `📷 Scans (${scans.length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={createManual} className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg transition">
            <Layers className="w-4 h-4" /> Manual Plan
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Scan
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">{success}</div>}

      {/* Plans tab */}
      {activeTab === 'plans' && (
        floorPlans.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Map className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No floor plans yet</p>
            <p className="text-sm text-gray-400 mt-1">Upload a scan or create a manual floor plan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {floorPlans.map(plan => (
              <div key={plan.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition cursor-pointer" onClick={() => setLightboxPlan(plan)}>
                <div className="aspect-video bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center mb-4 overflow-hidden">
                  {plan.svg_data ? <div dangerouslySetInnerHTML={{ __html: plan.svg_data }} className="w-full h-full" />
                    : <div className="text-center"><FileImage className="w-10 h-10 text-gray-300 mx-auto mb-1" /><p className="text-xs text-gray-400">No preview</p></div>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">{SOURCE_LABELS[plan.source] || plan.source}</span>
                    <span className="text-xs text-gray-400">{new Date(plan.created_at).toLocaleDateString()}</span>
                  </div>
                  {plan.total_area && <div className="flex items-center gap-1 text-sm text-gray-600"><Ruler className="w-3.5 h-3.5 text-blue-500" />{plan.total_area.toLocaleString()} sq ft</div>}
                  {plan.rooms && plan.rooms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {plan.rooms.slice(0, 4).map((r, i) => <span key={i} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r.name}{r.area ? ` · ${r.area} ft²` : ''}</span>)}
                      {plan.rooms.length > 4 && <span className="text-[10px] text-gray-400">+{plan.rooms.length - 4} more</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Scans tab */}
      {activeTab === 'scans' && (
        scans.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <FileImage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No scans yet</p>
            <p className="text-sm text-gray-400 mt-1">Click "Upload Scan" to add a photo of the floor plan</p>
            <p className="text-xs text-gray-400 mt-1">💡 Insta360 X4: export flat JPEG for best results</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {scans.map(scan => (
              <div key={scan.id} className="group relative bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition">
                <div className="aspect-video cursor-pointer overflow-hidden bg-gray-100" onClick={() => setLightboxScan(scan)}>
                  <img src={scan.image_url} alt="Floor plan scan" className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${scan.status === 'processed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{scan.status}</span>
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => setLightboxScan(scan)} className="w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center"><ZoomIn className="w-3.5 h-3.5 text-white" /></button>
                  <button onClick={() => deleteScan(scan)} className="w-7 h-7 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center"><X className="w-3.5 h-3.5 text-white" /></button>
                </div>
                <div className="p-2"><p className="text-[10px] text-gray-400">{new Date(scan.created_at).toLocaleDateString()}</p></div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Scan lightbox */}
      {lightboxScan && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxScan(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightboxScan(null)} className="absolute -top-10 right-0 text-white"><X className="w-6 h-6" /></button>
            <img src={lightboxScan.image_url} alt="Scan" className="w-full rounded-xl max-h-[80vh] object-contain" />
            <div className="mt-2 flex items-center justify-between text-sm text-white/70">
              <span>Status: {lightboxScan.status}</span><span>{new Date(lightboxScan.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Plan lightbox */}
      {lightboxPlan && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxPlan(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{SOURCE_LABELS[lightboxPlan.source]} Floor Plan</h3>
              <button onClick={() => setLightboxPlan(null)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            {lightboxPlan.total_area && <p className="text-sm text-gray-600 mb-3 flex items-center gap-1"><Ruler className="w-4 h-4 text-blue-500" /> Total: <strong>{lightboxPlan.total_area.toLocaleString()} sq ft</strong></p>}
            {lightboxPlan.rooms && lightboxPlan.rooms.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {lightboxPlan.rooms.map((r, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-sm font-medium text-gray-800">{r.name}</p>
                    {r.type && <p className="text-xs text-gray-500 capitalize">{r.type}</p>}
                    {r.area && <p className="text-xs text-blue-600 font-medium">{r.area} ft²</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-500">No room data.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
