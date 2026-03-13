'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Camera, X, ZoomIn, Trash2, Loader2, Plus, Tag } from 'lucide-react';

interface Photo {
  id: string;
  photo_url: string;
  room_tag: string | null;
  damage_tag: string | null;
  area: string | null;
  timestamp: string;
  signedUrl?: string;
}

const DAMAGE_TAGS = [
  { value: 'pre_existing', label: '📷 Before',     color: 'bg-slate-700 text-slate-300'    },
  { value: 'water_damage', label: '💧 Water',       color: 'bg-blue-900/60 text-blue-300'   },
  { value: 'mold',         label: '🟢 Mold',        color: 'bg-emerald-900/60 text-emerald-300' },
  { value: 'structural',   label: '🏗️ Structural',  color: 'bg-orange-900/60 text-orange-300' },
  { value: 'equipment',    label: '⚙️ Equipment',   color: 'bg-purple-900/60 text-purple-300' },
  { value: 'after',        label: '✅ After',        color: 'bg-teal-900/60 text-teal-300'   },
];

const ROOM_TAGS = ['Living Room','Kitchen','Bathroom','Master Bedroom','Bedroom','Basement','Garage','Hallway','Other'];

export default function JobPhotosTab({ jobId, userId }: { jobId: string; userId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos]         = useState<Photo[]>([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [lightbox, setLightbox]     = useState<Photo | null>(null);
  const [filter, setFilter]         = useState('all');
  const [tagForm, setTagForm]       = useState({ room_tag: '', damage_tag: 'water_damage', area: '' });
  const [showTagForm, setShowTagForm] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [jobId]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('job_photos').select('*').eq('job_id', jobId).order('timestamp', { ascending: false });

    if (data) {
      const withUrls = await Promise.all(data.map(async (p) => {
        if (p.photo_url?.startsWith('http')) return { ...p, signedUrl: p.photo_url };
        try {
          const { data: signed } = await supabase.storage.from('job-photos').createSignedUrl(p.photo_url, 3600);
          return { ...p, signedUrl: signed?.signedUrl || p.photo_url };
        } catch { return { ...p, signedUrl: p.photo_url }; }
      }));
      setPhotos(withUrls);
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true); setError('');

    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `${userId}/${jobId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: storageErr } = await supabase.storage.from('job-photos').upload(path, file, { contentType: file.type });
      if (storageErr) { setError(storageErr.message); continue; }

      const { data: { publicUrl } } = supabase.storage.from('job-photos').getPublicUrl(path);

      const { data: record } = await supabase.from('job_photos').insert({
        job_id: jobId, photo_url: publicUrl,
        room_tag: tagForm.room_tag || null, damage_tag: tagForm.damage_tag || null,
        area: tagForm.area || null, technician_id: userId,
      }).select().single();

      if (record) setPhotos(prev => [{ ...record, signedUrl: publicUrl }, ...prev]);
    }
    setUploading(false);
    setSuccess(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded ✅`);
    setTimeout(() => setSuccess(''), 3000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm('Delete this photo?')) return;
    const pathPart = photo.photo_url.split('/job-photos/')[1];
    if (pathPart) await supabase.storage.from('job-photos').remove([pathPart]);
    await supabase.from('job_photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    if (lightbox?.id === photo.id) setLightbox(null);
  };

  const filtered = filter === 'all' ? photos : photos.filter(p => p.damage_tag === filter);
  const tagInfo = (val: string) => DAMAGE_TAGS.find(t => t.value === val);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
              filter === 'all'
                ? 'bg-cyan-500 text-slate-900 border-cyan-500'
                : 'bg-slate-700/50 text-slate-400 border-slate-600/40 hover:border-cyan-500/50 hover:text-cyan-400'
            }`}>
            All ({photos.length})
          </button>
          {DAMAGE_TAGS.map(t => {
            const cnt = photos.filter(p => p.damage_tag === t.value).length;
            if (cnt === 0) return null;
            return (
              <button key={t.value} onClick={() => setFilter(t.value)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                  filter === t.value
                    ? 'bg-cyan-500 text-slate-900 border-cyan-500'
                    : 'bg-slate-700/50 text-slate-400 border-slate-600/40 hover:border-cyan-500/50 hover:text-cyan-400'
                }`}>
                {t.label} ({cnt})
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTagForm(!showTagForm)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/40 rounded-xl text-slate-400 hover:text-white transition">
            <Tag className="w-3.5 h-3.5" /> {showTagForm ? 'Hide Tags' : 'Set Tags'}
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-slate-900 disabled:text-slate-400 text-sm font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-cyan-500/20">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {uploading ? 'Uploading…' : 'Add Photos'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Tag form */}
      {showTagForm && (
        <div className="bg-slate-800/80 border border-slate-600/40 rounded-xl p-4 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Rooms</label>
            <select value={tagForm.room_tag} onChange={e => setTagForm(p => ({ ...p, room_tag: e.target.value }))}
              className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500">
              <option value="">No room tag</option>
              {ROOM_TAGS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Type</label>
            <select value={tagForm.damage_tag} onChange={e => setTagForm(p => ({ ...p, damage_tag: e.target.value }))}
              className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500">
              {DAMAGE_TAGS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Area note</label>
            <input type="text" value={tagForm.area} onChange={e => setTagForm(p => ({ ...p, area: e.target.value }))}
              placeholder="e.g. North wall"
              className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-500" />
          </div>
          <p className="col-span-3 text-xs text-cyan-400/70">Tags above apply to the next photos you upload</p>
        </div>
      )}

      {/* Alerts */}
      {error && <div className="bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl p-3">{error}</div>}
      {success && <div className="bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-sm rounded-xl p-3">{success}</div>}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-dashed border-slate-600/40">
          <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No photos yet</p>
          <p className="text-sm text-slate-500 mt-1">Click &quot;Add Photos&quot; to upload from your camera or gallery</p>
          <p className="text-xs text-slate-500 mt-1">💡 Insta360 X4: export flat JPEGs for best results</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(photo => (
            <div key={photo.id} className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700/50 hover:border-cyan-500/40 transition aspect-square">
              <img src={photo.signedUrl || photo.photo_url} alt="Job photo"
                className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition duration-300"
                onClick={() => setLightbox(photo)}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              {/* Damage tag */}
              {photo.damage_tag && (
                <div className="absolute bottom-1 left-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tagInfo(photo.damage_tag)?.color || 'bg-slate-700 text-slate-300'}`}>
                    {tagInfo(photo.damage_tag)?.label}
                  </span>
                </div>
              )}
              {/* Actions */}
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => setLightbox(photo)}
                  className="w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center">
                  <ZoomIn className="w-3 h-3 text-white" />
                </button>
                <button onClick={() => deletePhoto(photo)}
                  className="w-6 h-6 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
              {/* Room tag */}
              {photo.room_tag && (
                <div className="absolute top-1 left-1">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900/80 text-slate-300 backdrop-blur-sm">{photo.room_tag}</span>
                </div>
              )}
            </div>
          ))}
          {/* Upload tile */}
          <button onClick={() => fileInputRef.current?.click()}
            className="aspect-square flex flex-col items-center justify-center bg-slate-800/40 border-2 border-dashed border-slate-600/40 rounded-xl hover:border-cyan-500/60 hover:bg-cyan-500/5 transition group">
            <Plus className="w-8 h-8 text-slate-600 group-hover:text-cyan-400 transition" />
            <span className="text-xs text-slate-500 group-hover:text-cyan-400 mt-1">Add more</span>
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} className="absolute -top-10 right-0 text-white/60 hover:text-white">
              <X className="w-6 h-6" />
            </button>
            <img src={lightbox.signedUrl || lightbox.photo_url} alt="Photo" className="w-full rounded-2xl max-h-[80vh] object-contain" />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lightbox.damage_tag && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tagInfo(lightbox.damage_tag)?.color}`}>
                    {tagInfo(lightbox.damage_tag)?.label}
                  </span>
                )}
                {lightbox.room_tag && <span className="text-sm text-white/70">{lightbox.room_tag}</span>}
                {lightbox.area && <span className="text-sm text-white/50">{lightbox.area}</span>}
              </div>
              <div className="flex gap-2">
                <a href={lightbox.signedUrl || lightbox.photo_url} download target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-white/70 hover:text-white bg-white/10 px-2 py-1 rounded-lg transition">
                  ⬇ Download
                </a>
                <button onClick={() => deletePhoto(lightbox)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-white/10 px-2 py-1 rounded-lg transition">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
            <p className="text-xs text-white/30 mt-1 text-right">{new Date(lightbox.timestamp).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
