'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Building2, MapPin, Calendar, Hash, Shield, Droplets,
  Camera, Map, FileText, Loader2, AlertCircle, Eye,
} from 'lucide-react';

interface ShareData {
  job: {
    id: string; insured_name: string; property_address: string; property_city: string | null;
    claim_number: string | null; insurer_name: string | null; loss_date: string | null;
    status: string; job_type: string; adjuster_name: string | null;
  };
  photos: { id: string; photo_url: string; room_tag: string | null; damage_tag: string | null; timestamp: string }[];
  moisture_sessions: {
    id: string; name: string; visit_day: number;
    cells: { mc_percent: number | null; material_type: string; col_index: number; row_index: number }[];
  }[];
  floor_plan_scans: { id: string; image_url: string; status: string; created_at: string }[];
  label: string;
}

const DRY_STD: Record<string, { wet: number; dry: number }> = {
  drywall: { wet: 17, dry: 12 }, wood: { wet: 28, dry: 19 }, subfloor: { wet: 28, dry: 19 },
  concrete: { wet: 5.5, dry: 4.0 }, ceiling: { wet: 17, dry: 12 }, carpet: { wet: 20, dry: 10 },
  insulation: { wet: 25, dry: 15 }, tile: { wet: 4, dry: 2 }, other: { wet: 20, dry: 15 },
};

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700', dispatched: 'bg-purple-100 text-purple-700',
  active: 'bg-green-100 text-green-700', review: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-100 text-gray-600',
};

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'photos' | 'moisture' | 'floorplans'>('overview');
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // 1. Validate token and get job_id
      const { data: linkData, error: linkErr } = await supabase
        .from('job_share_links')
        .select('id, job_id, label, expires_at')
        .eq('token', token)
        .single();

      if (linkErr || !linkData) { setError('This link is invalid or has expired.'); setLoading(false); return; }

      // Check expiry
      if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
        setError('This link has expired.'); setLoading(false); return;
      }

      const jobId = linkData.job_id;

      // 2. Increment access count
      await supabase.from('job_share_links').update({
        access_count: (linkData as unknown as { access_count: number }).access_count + 1,
        last_accessed: new Date().toISOString(),
      }).eq('id', linkData.id);

      // 3. Load all job data
      const [jobRes, photosRes, sessionsRes, scansRes] = await Promise.all([
        supabase.from('jobs').select('id, insured_name, property_address, property_city, claim_number, insurer_name, loss_date, status, job_type, adjuster_name').eq('id', jobId).single(),
        supabase.from('job_photos').select('id, photo_url, room_tag, damage_tag, timestamp').eq('job_id', jobId).order('timestamp', { ascending: false }),
        supabase.from('moisture_map_sessions').select('id, name, visit_day').eq('job_id', jobId).order('visit_day'),
        supabase.from('floor_plan_scans').select('id, image_url, status, created_at').eq('job_id', jobId).order('created_at', { ascending: false }),
      ]);

      if (jobRes.error || !jobRes.data) { setError('Job not found.'); setLoading(false); return; }

      // Load cells for each session
      const sessionsWithCells = await Promise.all((sessionsRes.data || []).map(async s => {
        const { data: cells } = await supabase.from('moisture_grid_cells').select('mc_percent, material_type, col_index, row_index').eq('session_id', s.id);
        return { ...s, cells: cells || [] };
      }));

      setData({
        job: jobRes.data,
        photos: photosRes.data || [],
        moisture_sessions: sessionsWithCells,
        floor_plan_scans: scansRes.data || [],
        label: linkData.label,
      });
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-gray-500">Loading job file…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-sm">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">{error}</p>
        <p className="text-xs text-gray-400 mt-4">Powered by RoomLens Pro</p>
      </div>
    </div>
  );

  if (!data) return null;
  const { job, photos, moisture_sessions, floor_plan_scans } = data;

  // Moisture stats
  const allCells = moisture_sessions.flatMap(s => s.cells);
  const filledCells = allCells.filter(c => c.mc_percent !== null);
  const dryCells = filledCells.filter(c => c.mc_percent! <= (DRY_STD[c.material_type]?.dry ?? 15));
  const dryPct = filledCells.length > 0 ? Math.round((dryCells.length / filledCells.length) * 100) : 0;

  const TABS = [
    { id: 'overview' as const, label: 'Overview', icon: FileText },
    { id: 'photos' as const, label: `Photos (${photos.length})`, icon: Camera },
    { id: 'moisture' as const, label: `Moisture (${filledCells.length})`, icon: Droplets },
    { id: 'floorplans' as const, label: `Floor Plans (${floor_plan_scans.length})`, icon: Map },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">{job.insured_name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="w-3.5 h-3.5" />
                <span className="truncate">{job.property_address}{job.property_city ? `, ${job.property_city}` : ''}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[job.status] || 'bg-gray-100 text-gray-600'}`}>{job.status}</span>
              <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                <Eye className="w-3 h-3" /> Read Only
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <tab.icon className="w-3.5 h-3.5" />{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Claim #', value: job.claim_number || '—', icon: Hash },
                { label: 'Insurer', value: job.insurer_name || '—', icon: Shield },
                { label: 'Loss Date', value: job.loss_date ? new Date(job.loss_date).toLocaleDateString('en-CA') : '—', icon: Calendar },
                { label: 'Adjuster', value: job.adjuster_name || '—', icon: FileText },
                { label: 'Photos', value: `${photos.length} on file`, icon: Camera },
                { label: 'Moisture', value: filledCells.length > 0 ? `${dryPct}% dry` : 'No readings', icon: Droplets },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <item.icon className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
            {/* Drying progress */}
            {filledCells.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold text-gray-700">Overall Drying Progress</span>
                  <span className="font-bold text-green-600">{dryPct}% DRY</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="h-3 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500" style={{ width: `${dryPct}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{dryCells.length} of {filledCells.length} readings at dry goal · {moisture_sessions.length} surface{moisture_sessions.length !== 1 ? 's' : ''}</p>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">📋 Shared by RoomLens Pro</p>
              <p className="text-blue-700 text-xs">This is a read-only view of the job file. For questions, contact the restoration company directly.</p>
            </div>
          </div>
        )}

        {/* PHOTOS */}
        {activeTab === 'photos' && (
          photos.length === 0 ? (
            <div className="text-center py-16"><Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No photos on file yet.</p></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map(photo => (
                <div key={photo.id} className="relative bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition aspect-square" onClick={() => setLightbox(photo.photo_url)}>
                  <img src={photo.photo_url} alt="Job photo" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  {photo.room_tag && <span className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/80 text-gray-700">{photo.room_tag}</span>}
                </div>
              ))}
            </div>
          )
        )}

        {/* MOISTURE */}
        {activeTab === 'moisture' && (
          moisture_sessions.length === 0 ? (
            <div className="text-center py-16"><Droplets className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No moisture readings yet.</p></div>
          ) : (
            <div className="space-y-4">
              {moisture_sessions.map(session => {
                const filled = session.cells.filter(c => c.mc_percent !== null);
                const dry = filled.filter(c => c.mc_percent! <= (DRY_STD[c.material_type]?.dry ?? 15));
                const wet = filled.filter(c => c.mc_percent! >= (DRY_STD[c.material_type]?.wet ?? 20));
                const pct = filled.length > 0 ? Math.round((dry.length / filled.length) * 100) : 0;
                return (
                  <div key={session.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{session.name} · Day {session.visit_day}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{pct}% dry</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {[{ l: '✅ Dry', v: dry.length, c: 'text-green-600' }, { l: '⚠️ Drying', v: filled.length - dry.length - wet.length, c: 'text-yellow-600' }, { l: '🔴 Wet', v: wet.length, c: 'text-red-600' }].map(s => (
                        <div key={s.l} className="text-center bg-gray-50 rounded-lg p-3">
                          <div className={`text-xl font-bold ${s.c}`}>{s.v}</div>
                          <div className="text-xs text-gray-500">{s.l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500" style={{ width: `${pct}%` }} />
                    </div>
                    {filled.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {filled.slice(0, 20).map((c, i) => {
                          const std = DRY_STD[c.material_type] ?? DRY_STD.other;
                          const isDry = c.mc_percent! <= std.dry;
                          const isWet = c.mc_percent! >= std.wet;
                          return (
                            <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDry ? 'bg-green-100 text-green-700' : isWet ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {c.mc_percent}%
                            </span>
                          );
                        })}
                        {filled.length > 20 && <span className="text-[10px] text-gray-400">+{filled.length - 20} more</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* FLOOR PLANS */}
        {activeTab === 'floorplans' && (
          floor_plan_scans.length === 0 ? (
            <div className="text-center py-16"><Map className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No floor plan scans yet.</p></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {floor_plan_scans.map(scan => (
                <div key={scan.id} className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition" onClick={() => setLightbox(scan.image_url)}>
                  <div className="aspect-video bg-gray-100">
                    <img src={scan.image_url} alt="Floor plan" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] text-gray-400">{new Date(scan.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white text-2xl" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox} alt="Full size" className="max-w-full max-h-[90vh] rounded-xl object-contain" />
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-8 text-xs text-gray-400">
        Powered by <span className="font-semibold text-gray-500">RoomLens Pro</span> · Read-only job file
      </div>
    </div>
  );
}
