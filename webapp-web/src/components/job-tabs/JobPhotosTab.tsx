'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Camera, X, ZoomIn, Trash2, Loader2, Plus, Tag, Info,
  ChevronDown, ChevronLeft, ChevronRight, RotateCw,
  AlertTriangle, CheckCircle2, Layers, ImageOff, Maximize2
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Photo {
  id: string;
  photo_url: string;
  room_tag: string | null;
  damage_tag: string | null;
  area: string | null;
  timestamp: string;
  photo_source?: string;      // 'standard' | 'insta360' | 'external'
  is_360?: boolean;
  thumbnail_url?: string | null;
  notes?: string | null;
  damage_severity?: string | null;
  signedUrl?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const DAMAGE_TAGS = [
  { value: 'pre_existing',  label: 'Before',     emoji: '📷', color: 'bg-slate-700 text-slate-300',            border: 'border-slate-500'   },
  { value: 'water_damage',  label: 'Water',       emoji: '💧', color: 'bg-blue-900/60 text-blue-300',           border: 'border-blue-500'    },
  { value: 'mold',          label: 'Mold',        emoji: '🟢', color: 'bg-emerald-900/60 text-emerald-300',     border: 'border-emerald-500' },
  { value: 'structural',    label: 'Structural',  emoji: '🏗️', color: 'bg-orange-900/60 text-orange-300',       border: 'border-orange-500'  },
  { value: 'equipment',     label: 'Equipment',   emoji: '⚙️', color: 'bg-purple-900/60 text-purple-300',       border: 'border-purple-500'  },
  { value: 'after',         label: 'After',       emoji: '✅', color: 'bg-teal-900/60 text-teal-300',           border: 'border-teal-500'    },
];

const SEVERITY_LEVELS = [
  { value: 'low',      label: 'Low',      color: 'text-green-400',   dot: 'bg-green-400'   },
  { value: 'medium',   label: 'Medium',   color: 'text-yellow-400',  dot: 'bg-yellow-400'  },
  { value: 'high',     label: 'High',     color: 'text-orange-400',  dot: 'bg-orange-400'  },
  { value: 'critical', label: 'Critical', color: 'text-red-400',     dot: 'bg-red-400'     },
];

const ROOM_TAGS = [
  'Living Room','Kitchen','Bathroom','Master Bedroom','Bedroom 2','Bedroom 3',
  'Basement','Garage','Hallway','Dining Room','Laundry','Crawl Space',
  'Attic','Exterior','Roof','Other',
];

const PHOTO_SOURCES = [
  {
    value: 'standard',
    label: 'Standard Camera',
    sublabel: 'Phone, DSLR, or any camera',
    icon: '📱',
    tip: 'Regular flat JPEG/PNG photos',
    accept: 'image/*',
  },
  {
    value: 'insta360',
    label: 'Insta360 X4',
    sublabel: '360° documentation camera',
    icon: '🔵',
    tip: 'Export as flat JPEG from Insta360 app before uploading. For 360 viewer, upload equirectangular JPEG.',
    accept: 'image/jpeg,image/jpg,image/png',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const tagInfo   = (val: string) => DAMAGE_TAGS.find(t => t.value === val);
const sevInfo   = (val: string) => SEVERITY_LEVELS.find(s => s.value === val);
const sourceInfo = (val: string) => PHOTO_SOURCES.find(s => s.value === val);

function groupByRoom(photos: Photo[]) {
  const map: Record<string, Photo[]> = {};
  photos.forEach(p => {
    const key = p.room_tag || '—';
    if (!map[key]) map[key] = [];
    map[key].push(p);
  });
  return map;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function JobPhotosTab({ jobId, userId }: { jobId: string; userId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos,       setPhotos]       = useState<Photo[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightbox,     setLightbox]     = useState<Photo | null>(null);
  const [lbIdx,        setLbIdx]        = useState(0);
  const [filter,       setFilter]       = useState('all');
  const [viewMode,     setViewMode]     = useState<'grid' | 'room'>('grid');
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');

  // Upload tag form
  const [showTagForm,  setShowTagForm]  = useState(true);
  const [tagForm, setTagForm] = useState({
    room_tag:        '',
    damage_tag:      'water_damage',
    area:            '',
    photo_source:    'standard',
    is_360:          false,
    notes:           '',
    damage_severity: 'medium',
  });

  // Lightbox edit state
  const [editing,   setEditing]   = useState(false);
  const [editForm,  setEditForm]  = useState<Partial<typeof tagForm>>({});

  // ─── Load photos ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
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
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  // ─── Upload ───────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true); setError(''); setUploadProgress(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${userId}/${jobId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from('job-photos').upload(path, file, { contentType: file.type });
      if (storageErr) { setError(storageErr.message); continue; }

      const { data: { publicUrl } } = supabase.storage.from('job-photos').getPublicUrl(path);

      const { data: record } = await supabase.from('job_photos').insert({
        job_id:          jobId,
        photo_url:       publicUrl,
        room_tag:        tagForm.room_tag        || null,
        damage_tag:      tagForm.damage_tag       || null,
        area:            tagForm.area             || null,
        technician_id:   userId,
        photo_source:    tagForm.photo_source,
        is_360:          tagForm.is_360,
        notes:           tagForm.notes            || null,
        damage_severity: tagForm.damage_severity  || null,
      }).select().single();

      if (record) setPhotos(prev => [{ ...record, signedUrl: publicUrl }, ...prev]);
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setUploading(false);
    setSuccess(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded ✅`);
    setTimeout(() => setSuccess(''), 4000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const deletePhoto = async (photo: Photo) => {
    if (!confirm('Delete this photo?')) return;
    const pathPart = photo.photo_url.split('/job-photos/')[1];
    if (pathPart) await supabase.storage.from('job-photos').remove([pathPart]);
    await supabase.from('job_photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    if (lightbox?.id === photo.id) setLightbox(null);
  };

  // ─── Lightbox edit/save ────────────────────────────────────────────────────
  const openEdit = (photo: Photo) => {
    setEditForm({
      room_tag:        photo.room_tag        || '',
      damage_tag:      photo.damage_tag      || 'water_damage',
      area:            photo.area            || '',
      notes:           photo.notes           || '',
      damage_severity: photo.damage_severity || 'medium',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!lightbox) return;
    const { error } = await supabase.from('job_photos').update({
      room_tag:        editForm.room_tag        || null,
      damage_tag:      editForm.damage_tag       || null,
      area:            editForm.area             || null,
      notes:           editForm.notes            || null,
      damage_severity: editForm.damage_severity  || null,
    }).eq('id', lightbox.id);

    if (!error) {
      const updated = { ...lightbox, ...editForm };
      setPhotos(prev => prev.map(p => p.id === lightbox.id ? { ...p, ...editForm } : p));
      setLightbox(updated as Photo);
      setEditing(false);
    }
  };

  // ─── Lightbox navigation ──────────────────────────────────────────────────
  const filteredPhotos = filter === 'all' ? photos : photos.filter(p => p.damage_tag === filter);

  const openLightbox = (photo: Photo) => {
    const idx = filteredPhotos.findIndex(p => p.id === photo.id);
    setLbIdx(idx);
    setLightbox(photo);
    setEditing(false);
  };

  const navLightbox = (dir: 1 | -1) => {
    const next = (lbIdx + dir + filteredPhotos.length) % filteredPhotos.length;
    setLbIdx(next);
    setLightbox(filteredPhotos[next]);
    setEditing(false);
  };

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = DAMAGE_TAGS.map(t => ({
    ...t,
    count: photos.filter(p => p.damage_tag === t.value).length,
  })).filter(t => t.count > 0);

  const i360Count = photos.filter(p => p.photo_source === 'insta360').length;
  const roomGroups = groupByRoom(photos);

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ─── Stats Bar ─────────────────────────────────────────── */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-white">{photos.length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Total Photos</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-cyan-400">{i360Count}</div>
            <div className="text-xs text-slate-400 mt-0.5">Insta360 X4</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-orange-400">
              {photos.filter(p => p.damage_severity === 'high' || p.damage_severity === 'critical').length}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">High/Critical</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">{Object.keys(roomGroups).length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Rooms Tagged</div>
          </div>
        </div>
      )}

      {/* ─── Insta360 Info Banner ────────────────────────────────── */}
      <div className="bg-slate-800/50 border border-cyan-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl mt-0.5">🔵</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-white">Insta360 X4</span>
              <span className="text-[10px] px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full font-medium">360° Documentation</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              For accurate damage documentation: shoot in 360° mode, then export as <strong className="text-white">flat JPEG</strong> from the Insta360 app before uploading. 
              The 360° viewer works with equirectangular JPEGs — toggle &quot;Is 360°&quot; when uploading those files.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-[10px] px-2 py-1 bg-slate-700/60 text-slate-300 rounded-lg">📐 Full room capture in one shot</span>
              <span className="text-[10px] px-2 py-1 bg-slate-700/60 text-slate-300 rounded-lg">💧 All damage angles documented</span>
              <span className="text-[10px] px-2 py-1 bg-slate-700/60 text-slate-300 rounded-lg">📋 Xactimate-ready evidence</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tag Form (Upload Settings) ──────────────────────────── */}
      <div className="bg-slate-800/60 border border-slate-600/40 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowTagForm(!showTagForm)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/40 transition"
        >
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Upload Settings — Tags & Source</span>
            {tagForm.room_tag && (
              <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">{tagForm.room_tag}</span>
            )}
            {tagForm.damage_tag && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${tagInfo(tagForm.damage_tag)?.color}`}>
                {tagInfo(tagForm.damage_tag)?.emoji} {tagInfo(tagForm.damage_tag)?.label}
              </span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTagForm ? 'rotate-180' : ''}`} />
        </button>

        {showTagForm && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50">

            {/* Photo Source */}
            <div className="pt-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                📷 Photo Source
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PHOTO_SOURCES.map(src => (
                  <button
                    key={src.value}
                    onClick={() => setTagForm(p => ({ ...p, photo_source: src.value }))}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                      tagForm.photo_source === src.value
                        ? 'bg-cyan-500/15 border-cyan-500/60 ring-1 ring-cyan-500/40'
                        : 'bg-slate-700/30 border-slate-600/40 hover:border-slate-500/60'
                    }`}
                  >
                    <span className="text-xl mt-0.5">{src.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-white">{src.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{src.sublabel}</div>
                    </div>
                  </button>
                ))}
              </div>
              {/* 360 toggle – only show for insta360 */}
              {tagForm.photo_source === 'insta360' && (
                <label className="mt-2 flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setTagForm(p => ({ ...p, is_360: !p.is_360 }))}
                    className={`w-10 h-5 rounded-full transition relative ${tagForm.is_360 ? 'bg-cyan-500' : 'bg-slate-600'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${tagForm.is_360 ? 'left-5' : 'left-0.5'}`} />
                  </div>
                  <span className="text-xs text-slate-300">Equirectangular 360° JPEG</span>
                  <span className="text-[10px] text-slate-500">(enables 360 viewer)</span>
                </label>
              )}
              <p className="mt-1.5 text-[10px] text-cyan-400/60">
                {sourceInfo(tagForm.photo_source)?.tip}
              </p>
            </div>

            {/* Room + Damage Type + Severity */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Room</label>
                <select
                  value={tagForm.room_tag}
                  onChange={e => setTagForm(p => ({ ...p, room_tag: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">— No room —</option>
                  {ROOM_TAGS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Damage Type</label>
                <select
                  value={tagForm.damage_tag}
                  onChange={e => setTagForm(p => ({ ...p, damage_tag: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {DAMAGE_TAGS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Severity</label>
                <select
                  value={tagForm.damage_severity}
                  onChange={e => setTagForm(p => ({ ...p, damage_severity: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {SEVERITY_LEVELS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Area note + Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Area / Location</label>
                <input
                  type="text"
                  value={tagForm.area}
                  onChange={e => setTagForm(p => ({ ...p, area: e.target.value }))}
                  placeholder="e.g. North wall, Behind washer"
                  className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes</label>
                <input
                  type="text"
                  value={tagForm.notes}
                  onChange={e => setTagForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Visible mold, saturation level…"
                  className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-500"
                />
              </div>
            </div>

            <p className="text-[11px] text-cyan-400/60 flex items-center gap-1.5">
              <Info className="w-3 h-3" />
              These tags apply to the next batch of photos you upload
            </p>
          </div>
        )}
      </div>

      {/* ─── Upload Button ───────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* All filter */}
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
              filter === 'all'
                ? 'bg-cyan-500 text-slate-900 border-cyan-500'
                : 'bg-slate-700/50 text-slate-400 border-slate-600/40 hover:border-cyan-500/50 hover:text-cyan-400'
            }`}
          >
            All ({photos.length})
          </button>
          {stats.map(t => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                filter === t.value
                  ? 'bg-cyan-500 text-slate-900 border-cyan-500'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600/40 hover:border-cyan-500/50 hover:text-cyan-400'
              }`}
            >
              {t.emoji} {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <button
            onClick={() => setViewMode(v => v === 'grid' ? 'room' : 'grid')}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/40 rounded-xl text-slate-400 hover:text-white transition"
          >
            <Layers className="w-3.5 h-3.5" />
            {viewMode === 'grid' ? 'By Room' : 'Grid'}
          </button>

          {/* Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-slate-900 disabled:text-slate-400 text-sm font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-cyan-500/20"
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {uploadProgress}%</>
              : <><Camera className="w-4 h-4" /> Add Photos</>
            }
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={sourceInfo(tagForm.photo_source)?.accept || 'image/*'}
            multiple
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* ─── Alerts ──────────────────────────────────────────────── */}
      {error   && <div className="bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl p-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
      {success && <div className="bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-sm rounded-xl p-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{success}</div>}

      {/* ─── Photo Grid / Room View ───────────────────────────────── */}
      {filteredPhotos.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-dashed border-slate-600/40">
          <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No photos yet</p>
          <p className="text-sm text-slate-500 mt-1">Click &quot;Add Photos&quot; to start documenting damage</p>
          <p className="text-xs text-slate-500 mt-1">🔵 Insta360 X4: export as flat JPEG from the Insta360 app</p>
        </div>
      ) : viewMode === 'grid' ? (
        <PhotoGrid
          photos={filteredPhotos}
          onOpen={openLightbox}
          onDelete={deletePhoto}
          onAdd={() => fileInputRef.current?.click()}
        />
      ) : (
        /* Room grouped view */
        <div className="space-y-6">
          {Object.entries(groupByRoom(filteredPhotos)).map(([room, roomPhotos]) => (
            <div key={room}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-white">{room}</span>
                <span className="text-xs text-slate-500">{roomPhotos.length} photo{roomPhotos.length !== 1 ? 's' : ''}</span>
                <div className="flex gap-1 flex-wrap">
                  {DAMAGE_TAGS.filter(t => roomPhotos.some(p => p.damage_tag === t.value)).map(t => (
                    <span key={t.value} className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${t.color}`}>{t.emoji} {t.label}</span>
                  ))}
                </div>
              </div>
              <PhotoGrid
                photos={roomPhotos}
                onOpen={openLightbox}
                onDelete={deletePhoto}
                onAdd={() => fileInputRef.current?.click()}
                compact
              />
            </div>
          ))}
        </div>
      )}

      {/* ─── Lightbox ────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => { setLightbox(null); setEditing(false); }}
        >
          <div className="relative w-full max-w-4xl" onClick={e => e.stopPropagation()}>

            {/* Nav arrows */}
            {filteredPhotos.length > 1 && (
              <>
                <button
                  onClick={() => navLightbox(-1)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navLightbox(1)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Close */}
            <button
              onClick={() => { setLightbox(null); setEditing(false); }}
              className="absolute -top-10 right-0 text-white/60 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Image */}
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden">
              {lightbox.is_360 && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                  <Maximize2 className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px] text-cyan-300 font-medium">360° — drag to pan</span>
                </div>
              )}
              {lightbox.photo_source === 'insta360' && !lightbox.is_360 && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                  <span className="text-[10px] text-cyan-300 font-medium">🔵 Insta360 X4</span>
                </div>
              )}
              <img
                src={lightbox.signedUrl || lightbox.photo_url}
                alt="Job photo"
                className="w-full max-h-[65vh] object-contain"
              />
            </div>

            {/* Meta + edit */}
            <div className="mt-4 bg-slate-800/80 rounded-xl p-4">
              {!editing ? (
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {lightbox.damage_tag && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tagInfo(lightbox.damage_tag)?.color}`}>
                          {tagInfo(lightbox.damage_tag)?.emoji} {tagInfo(lightbox.damage_tag)?.label}
                        </span>
                      )}
                      {lightbox.damage_severity && (
                        <span className={`text-xs font-semibold ${sevInfo(lightbox.damage_severity)?.color}`}>
                          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${sevInfo(lightbox.damage_severity)?.dot}`} />
                          {sevInfo(lightbox.damage_severity)?.label}
                        </span>
                      )}
                      {lightbox.room_tag && <span className="text-sm text-white/80 font-medium">{lightbox.room_tag}</span>}
                      {lightbox.area && <span className="text-sm text-white/50">{lightbox.area}</span>}
                    </div>
                    {lightbox.notes && (
                      <p className="text-sm text-slate-400 leading-relaxed">&ldquo;{lightbox.notes}&rdquo;</p>
                    )}
                    <p className="text-xs text-white/25">{new Date(lightbox.timestamp).toLocaleString()}</p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(lightbox)}
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg transition"
                    >
                      <Tag className="w-3 h-3" /> Edit Tags
                    </button>
                    <a
                      href={lightbox.signedUrl || lightbox.photo_url}
                      download target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-white/70 hover:text-white bg-white/10 px-3 py-1.5 rounded-lg transition"
                    >
                      ⬇ Download
                    </a>
                    <button
                      onClick={() => deletePhoto(lightbox)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-white/10 px-3 py-1.5 rounded-lg transition"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ) : (
                /* Edit form in lightbox */
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Room</label>
                      <select
                        value={editForm.room_tag || ''}
                        onChange={e => setEditForm(p => ({ ...p, room_tag: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="">— None —</option>
                        {ROOM_TAGS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Damage Type</label>
                      <select
                        value={editForm.damage_tag || ''}
                        onChange={e => setEditForm(p => ({ ...p, damage_tag: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        {DAMAGE_TAGS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Severity</label>
                      <select
                        value={editForm.damage_severity || ''}
                        onChange={e => setEditForm(p => ({ ...p, damage_severity: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        {SEVERITY_LEVELS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Area / Location</label>
                      <input
                        type="text"
                        value={editForm.area || ''}
                        onChange={e => setEditForm(p => ({ ...p, area: e.target.value }))}
                        placeholder="North wall…"
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Notes</label>
                      <input
                        type="text"
                        value={editForm.notes || ''}
                        onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Observations…"
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveEdit} className="flex items-center gap-1 text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold px-4 py-1.5 rounded-lg transition">
                      <CheckCircle2 className="w-3 h-3" /> Save
                    </button>
                    <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-white px-4 py-1.5 rounded-lg border border-slate-600 transition">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Counter */}
            {filteredPhotos.length > 1 && (
              <p className="text-center text-xs text-white/30 mt-2">
                {lbIdx + 1} / {filteredPhotos.length}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: Photo Grid ────────────────────────────────────────────────
function PhotoGrid({
  photos, onOpen, onDelete, onAdd, compact = false,
}: {
  photos: Photo[];
  onOpen: (p: Photo) => void;
  onDelete: (p: Photo) => void;
  onAdd: () => void;
  compact?: boolean;
}) {
  const cols = compact
    ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3';

  return (
    <div className={`grid ${cols}`}>
      {photos.map(photo => (
        <PhotoCard key={photo.id} photo={photo} onOpen={onOpen} onDelete={onDelete} />
      ))}
      <button
        onClick={onAdd}
        className={`${compact ? '' : 'aspect-square'} flex flex-col items-center justify-center bg-slate-800/40 border-2 border-dashed border-slate-600/40 rounded-xl hover:border-cyan-500/60 hover:bg-cyan-500/5 transition group min-h-[80px]`}
      >
        <Plus className="w-6 h-6 text-slate-600 group-hover:text-cyan-400 transition" />
        <span className="text-[10px] text-slate-500 group-hover:text-cyan-400 mt-1">Add</span>
      </button>
    </div>
  );
}

// ─── Sub-component: Photo Card ────────────────────────────────────────────────
function PhotoCard({
  photo, onOpen, onDelete,
}: {
  photo: Photo;
  onOpen: (p: Photo) => void;
  onDelete: (p: Photo) => void;
}) {
  const tag = tagInfo(photo.damage_tag || '');
  const sev = sevInfo(photo.damage_severity || '');
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700/50 hover:border-cyan-500/40 transition aspect-square">
      {imgErr ? (
        <div className="w-full h-full flex items-center justify-center bg-slate-800">
          <ImageOff className="w-6 h-6 text-slate-600" />
        </div>
      ) : (
        <img
          src={photo.signedUrl || photo.photo_url}
          alt="Job photo"
          className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition duration-300"
          onClick={() => onOpen(photo)}
          onError={() => setImgErr(true)}
        />
      )}

      {/* 360 badge */}
      {photo.is_360 && (
        <div className="absolute top-1 right-8 z-10">
          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-cyan-500/80 text-slate-900">360°</span>
        </div>
      )}

      {/* Insta360 source badge */}
      {photo.photo_source === 'insta360' && !photo.is_360 && (
        <div className="absolute top-1 right-8 z-10">
          <span className="text-[8px] px-1 py-0.5 rounded bg-slate-900/70 text-cyan-400 font-bold">X4</span>
        </div>
      )}

      {/* Severity dot */}
      {sev && (
        <div className={`absolute top-1.5 left-1.5 w-2 h-2 rounded-full ${sev.dot} shadow ring-1 ring-black/40`} />
      )}

      {/* Damage tag badge */}
      {tag && (
        <div className="absolute bottom-1 left-1">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tag.color}`}>
            {tag.emoji}
          </span>
        </div>
      )}

      {/* Room tag */}
      {photo.room_tag && (
        <div className="absolute bottom-1 right-1">
          <span className="text-[8px] px-1 py-0.5 rounded bg-slate-900/80 text-slate-300 backdrop-blur-sm truncate max-w-[60px] block">
            {photo.room_tag}
          </span>
        </div>
      )}

      {/* Hover actions */}
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={() => onOpen(photo)}
          className="w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center"
        >
          <ZoomIn className="w-3 h-3 text-white" />
        </button>
        <button
          onClick={() => onDelete(photo)}
          className="w-6 h-6 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    </div>
  );
}
