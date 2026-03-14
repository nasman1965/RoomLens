'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Camera, X, ZoomIn, Trash2, Loader2, Plus, Tag, Info,
  ChevronDown, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, Layers, ImageOff, Maximize2,
  FolderOpen, Aperture, Home, MoveRight, AlertCircle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Photo {
  id: string;
  photo_url: string;
  room_tag: string | null;
  damage_tag: string | null;
  area: string | null;
  timestamp: string;
  photo_source?: string;
  is_360?: boolean;
  thumbnail_url?: string | null;
  notes?: string | null;
  damage_severity?: string | null;
  signedUrl?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const DAMAGE_TAGS = [
  { value: 'pre_existing',  label: 'Before',    emoji: '📷', color: 'bg-slate-700 text-slate-300',            border: 'border-slate-500'   },
  { value: 'water_damage',  label: 'Water',      emoji: '💧', color: 'bg-blue-900/60 text-blue-300',           border: 'border-blue-500'    },
  { value: 'mold',          label: 'Mold',       emoji: '🟢', color: 'bg-emerald-900/60 text-emerald-300',     border: 'border-emerald-500' },
  { value: 'structural',    label: 'Structural', emoji: '🏗️', color: 'bg-orange-900/60 text-orange-300',       border: 'border-orange-500'  },
  { value: 'equipment',     label: 'Equipment',  emoji: '⚙️', color: 'bg-purple-900/60 text-purple-300',       border: 'border-purple-500'  },
  { value: 'after',         label: 'After',      emoji: '✅', color: 'bg-teal-900/60 text-teal-300',           border: 'border-teal-500'    },
];

const SEVERITY_LEVELS = [
  { value: 'low',      label: 'Low',      color: 'text-green-400',  dot: 'bg-green-400'  },
  { value: 'medium',   label: 'Medium',   color: 'text-yellow-400', dot: 'bg-yellow-400' },
  { value: 'high',     label: 'High',     color: 'text-orange-400', dot: 'bg-orange-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400',    dot: 'bg-red-400'    },
];

const ROOM_TAGS = [
  'Living Room','Kitchen','Bathroom','Master Bedroom','Bedroom 2','Bedroom 3',
  'Basement','Garage','Hallway','Dining Room','Laundry','Crawl Space',
  'Attic','Exterior','Roof','Other',
];

// ─── CSS animation for shake ─────────────────────────────────────────────────
const SHAKE_CSS = `
@keyframes roomShake {
  0%,100%{transform:translateX(0)}
  15%{transform:translateX(-6px)}
  30%{transform:translateX(6px)}
  45%{transform:translateX(-5px)}
  60%{transform:translateX(5px)}
  75%{transform:translateX(-3px)}
  90%{transform:translateX(3px)}
}
.shake-anim { animation: roomShake 0.55s ease; }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const tagInfo = (val: string) => DAMAGE_TAGS.find(t => t.value === val);
const sevInfo = (val: string) => SEVERITY_LEVELS.find(s => s.value === val);

function groupByRoom(photos: Photo[]) {
  const map: Record<string, Photo[]> = {};
  photos.forEach(p => {
    const key = p.room_tag || '—';
    if (!map[key]) map[key] = [];
    map[key].push(p);
  });
  return map;
}

// ─── Move to Room Modal ───────────────────────────────────────────────────────
function MoveToRoomModal({
  photo,
  onClose,
  onSave,
}: {
  photo: Photo;
  onClose: () => void;
  onSave: (room: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(photo.room_tag || '');
  const [customRoom, setCustomRoom] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const room = selected === '__custom__' ? customRoom.trim() : selected;
    if (!room) return;
    setSaving(true);
    await onSave(room);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-slate-800 border border-slate-600/60 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/80">
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-white">Assign to Room</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Photo preview */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-3 bg-slate-700/40 rounded-xl p-2.5">
            <img
              src={photo.signedUrl || photo.photo_url}
              alt=""
              className="w-12 h-12 object-cover rounded-lg"
            />
            <div className="min-w-0">
              <p className="text-xs text-white font-medium truncate">
                {photo.room_tag ? `Currently: ${photo.room_tag}` : 'No room assigned'}
              </p>
              <p className="text-[10px] text-slate-400">{new Date(photo.timestamp).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Room grid */}
        <div className="px-4 pb-2 max-h-64 overflow-y-auto">
          <div className="grid grid-cols-2 gap-1.5">
            {ROOM_TAGS.map(room => (
              <button
                key={room}
                type="button"
                onClick={() => setSelected(room)}
                className={`text-left text-xs px-3 py-2 rounded-xl border transition font-medium truncate ${
                  selected === room
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 ring-1 ring-cyan-500/40'
                    : 'bg-slate-700/30 border-slate-600/40 text-slate-300 hover:border-slate-500/60 hover:text-white'
                }`}
              >
                {room}
              </button>
            ))}
            {/* Custom room option */}
            <button
              type="button"
              onClick={() => setSelected('__custom__')}
              className={`text-left text-xs px-3 py-2 rounded-xl border transition font-medium col-span-2 ${
                selected === '__custom__'
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 ring-1 ring-cyan-500/40'
                  : 'bg-slate-700/30 border-slate-600/40 text-slate-400 hover:border-slate-500/60 hover:text-white'
              }`}
            >
              ✏️ Custom room name…
            </button>
          </div>

          {/* Custom input */}
          {selected === '__custom__' && (
            <input
              type="text"
              value={customRoom}
              onChange={e => setCustomRoom(e.target.value)}
              autoFocus
              placeholder="e.g. Master Closet, Mud Room…"
              className="mt-2 w-full px-3 py-2 bg-slate-700 border border-cyan-500/40 rounded-xl text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-500"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 pb-4 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || (!selected || (selected === '__custom__' && !customRoom.trim()))}
            className="flex-1 flex items-center justify-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-bold text-sm px-4 py-2 rounded-xl transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoveRight className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Assign Room'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-600 rounded-xl transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function JobPhotosTab({ jobId, userId }: { jobId: string; userId: string }) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const roomSelectRef  = useRef<HTMLDivElement>(null);   // ref for shake target

  const [photos,          setPhotos]          = useState<Photo[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [uploading,       setUploading]       = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [lightbox,        setLightbox]        = useState<Photo | null>(null);
  const [lbIdx,           setLbIdx]           = useState(0);
  const [filter,          setFilter]          = useState('all');
  const [viewMode,        setViewMode]        = useState<'grid' | 'room'>('grid');
  const [error,           setError]           = useState('');
  const [success,         setSuccess]         = useState('');
  const [showTagForm,     setShowTagForm]      = useState(true);
  const [roomWarning,     setRoomWarning]      = useState(false);  // guardrail warning
  const [movePhoto,       setMovePhoto]        = useState<Photo | null>(null); // room-reassign modal

  const [tagForm, setTagForm] = useState({
    room_tag:        '',
    damage_tag:      'water_damage',
    area:            '',
    photo_source:    'standard',
    is_360:          false,
    notes:           '',
    damage_severity: 'medium',
  });

  const [editing,  setEditing]  = useState(false);
  const [editForm, setEditForm] = useState<Partial<typeof tagForm>>({});

  // ─── Load photos ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('job_photos').select('*').eq('job_id', jobId).order('timestamp', { ascending: false });

    if (data) {
      const withUrls = await Promise.all(data.map(async (p) => {
        const rawUrl: string = p.photo_url || '';
        let storagePath = rawUrl;
        if (rawUrl.startsWith('http')) {
          const match = rawUrl.match(/\/job-photos\/(.+?)(\?|$)/);
          if (match) {
            storagePath = decodeURIComponent(match[1]);
          } else {
            return { ...p, signedUrl: rawUrl };
          }
        }
        try {
          const { data: signed } = await supabase.storage
            .from('job-photos')
            .createSignedUrl(storagePath, 3600);
          return { ...p, signedUrl: signed?.signedUrl || rawUrl };
        } catch {
          return { ...p, signedUrl: rawUrl };
        }
      }));
      setPhotos(withUrls);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  // ─── Room Guardrail ───────────────────────────────────────────────────────
  // Called before any upload attempt; returns true if upload may proceed
  const checkRoomSelected = (): boolean => {
    if (tagForm.room_tag) return true;

    // Show warning state + shake animation
    setRoomWarning(true);
    setShowTagForm(true); // expand tag form so user can see it
    setError('⚠️ Please choose a room before uploading photos.');

    // Shake the room select section
    if (roomSelectRef.current) {
      roomSelectRef.current.classList.remove('shake-anim');
      // Trigger reflow so the animation restarts
      void roomSelectRef.current.offsetWidth;
      roomSelectRef.current.classList.add('shake-anim');
      setTimeout(() => roomSelectRef.current?.classList.remove('shake-anim'), 600);
    }

    // Scroll to the tag form on mobile
    roomSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Auto-clear warning after 4 s
    setTimeout(() => {
      setRoomWarning(false);
      setError('');
    }, 4000);

    return false;
  };

  // ─── Core upload logic ────────────────────────────────────────────────────
  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    if (!checkRoomSelected()) return; // ← GUARDRAIL

    setUploading(true); setError(''); setUploadProgress(0);

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.type.startsWith('image/')) {
        setError(`Skipped "${file.name}" — not an image file.`);
        continue;
      }

      const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${userId}/${jobId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from('job-photos')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (storageErr) {
        console.error('Storage upload error:', storageErr);
        setError(`Upload failed: ${storageErr.message}`);
        continue;
      }

      const { data: record, error: dbErr } = await supabase.from('job_photos').insert({
        job_id:          jobId,
        photo_url:       path,
        room_tag:        tagForm.room_tag        || null,
        damage_tag:      tagForm.damage_tag       || null,
        area:            tagForm.area             || null,
        technician_id:   userId,
        photo_source:    tagForm.photo_source,
        is_360:          tagForm.is_360,
        notes:           tagForm.notes            || null,
        damage_severity: tagForm.damage_severity  || null,
      }).select().single();

      if (dbErr) {
        console.error('DB insert error:', dbErr);
        setError(`Saved to storage but DB record failed: ${dbErr.message}`);
        continue;
      }

      let signedUrl = '';
      try {
        const { data: signed } = await supabase.storage.from('job-photos').createSignedUrl(path, 3600);
        signedUrl = signed?.signedUrl || '';
      } catch { signedUrl = ''; }

      if (record) {
        setPhotos(prev => [{ ...record, signedUrl }, ...prev]);
        successCount++;
      }

      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setUploading(false);
    if (successCount > 0) {
      setSuccess(`${successCount} photo${successCount > 1 ? 's' : ''} uploaded ✅`);
      setTimeout(() => setSuccess(''), 4000);
    }
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current)   fileInputRef.current.value   = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(Array.from(e.target.files || []));
  };

  // Intercept button clicks — check room before opening file dialog
  const handleTakePhoto = () => {
    if (!checkRoomSelected()) return;
    cameraInputRef.current?.click();
  };

  const handleUploadFiles = () => {
    if (!checkRoomSelected()) return;
    fileInputRef.current?.click();
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const deletePhoto = async (photo: Photo) => {
    if (!confirm('Delete this photo?')) return;
    const pathPart = photo.photo_url.split('/job-photos/')[1];
    if (pathPart) await supabase.storage.from('job-photos').remove([decodeURIComponent(pathPart.split('?')[0])]);
    await supabase.from('job_photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    if (lightbox?.id === photo.id) setLightbox(null);
  };

  // ─── Reassign room ─────────────────────────────────────────────────────────
  const reassignRoom = async (photo: Photo, room: string) => {
    const { error } = await supabase.from('job_photos').update({ room_tag: room }).eq('id', photo.id);
    if (!error) {
      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, room_tag: room } : p));
      if (lightbox?.id === photo.id) setLightbox(prev => prev ? { ...prev, room_tag: room } : prev);
      setSuccess(`Photo moved to ${room} ✅`);
      setTimeout(() => setSuccess(''), 3000);
    }
    setMovePhoto(null);
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
  const filteredPhotos = (() => {
    if (filter === 'all') return photos;
    if (filter === 'no_room') return photos.filter(p => !p.room_tag);
    return photos.filter(p => p.damage_tag === filter);
  })();

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

  const i360Count    = photos.filter(p => p.photo_source === 'insta360').length;
  const noRoomCount  = photos.filter(p => !p.room_tag).length;
  const roomGroups   = groupByRoom(photos);

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Inject shake keyframes */}
      <style>{SHAKE_CSS}</style>

      {/* ─── Untagged Room Banner ────────────────────────────────── */}
      {noRoomCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-amber-900/30 border border-amber-600/40 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300 font-medium">
              <span className="font-bold text-amber-200">{noRoomCount} photo{noRoomCount !== 1 ? 's' : ''}</span> still need a room assigned
            </p>
          </div>
          <button
            onClick={() => setFilter('no_room')}
            className="shrink-0 text-xs bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold px-3 py-1.5 rounded-lg transition"
          >
            View &amp; Fix
          </button>
        </div>
      )}

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
            <div className="text-2xl font-bold text-emerald-400">{Object.keys(roomGroups).filter(k => k !== '—').length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Rooms Tagged</div>
          </div>
        </div>
      )}

      {/* ─── Upload Section ─────────────────────────────────────── */}
      <div className="bg-slate-800/60 border border-slate-600/40 rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-cyan-400" />
            Add Photos
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {tagForm.room_tag
              ? <>Adding to <span className="text-cyan-300 font-semibold">{tagForm.room_tag}</span> — change room in Photo Tags below</>
              : <span className="text-amber-400 font-medium">⚠️ Select a room in Photo Tags before uploading</span>
            }
          </p>
        </div>

        {/* Two big upload buttons */}
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          <button
            type="button"
            onClick={handleTakePhoto}
            disabled={uploading}
            className={`flex flex-col items-center justify-center gap-2 border-2 disabled:opacity-50 rounded-xl py-5 px-3 transition group ${
              tagForm.room_tag
                ? 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/40 hover:border-cyan-500/70'
                : 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/10'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
              tagForm.room_tag ? 'bg-cyan-500/20 group-hover:bg-cyan-500/30' : 'bg-amber-500/15 group-hover:bg-amber-500/25'
            }`}>
              <Camera className={`w-5 h-5 ${tagForm.room_tag ? 'text-cyan-400' : 'text-amber-400'}`} />
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-white">Take Photo</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Open camera</div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleUploadFiles}
            disabled={uploading}
            className={`flex flex-col items-center justify-center gap-2 border-2 disabled:opacity-50 rounded-xl py-5 px-3 transition group ${
              tagForm.room_tag
                ? 'bg-slate-700/40 hover:bg-slate-700/70 border-slate-600/40 hover:border-slate-500/70'
                : 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/10'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
              tagForm.room_tag ? 'bg-slate-600/40 group-hover:bg-slate-600/60' : 'bg-amber-500/15 group-hover:bg-amber-500/25'
            }`}>
              <FolderOpen className={`w-5 h-5 ${tagForm.room_tag ? 'text-slate-300' : 'text-amber-400'}`} />
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-white">Upload Files</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Gallery / Files app</div>
            </div>
          </button>
        </div>

        {/* Upload progress bar */}
        {uploading && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-3 bg-slate-900/60 rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white font-medium">Uploading photos…</span>
                  <span className="text-xs text-cyan-400 font-bold">{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hidden inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleFileChange} />
        <input ref={fileInputRef}   type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif" multiple className="hidden" onChange={handleFileChange} />
      </div>

      {/* ─── Tag Form (collapsible) ────────────────────────────── */}
      <div
        ref={roomSelectRef}
        className={`bg-slate-800/60 border rounded-xl overflow-hidden transition-all ${
          roomWarning ? 'border-amber-500/70 shadow-[0_0_0_2px_rgba(245,158,11,0.3)]' : 'border-slate-600/40'
        }`}
      >
        <button
          onClick={() => setShowTagForm(!showTagForm)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/40 transition"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Photo Tags</span>
            {tagForm.room_tag ? (
              <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full font-medium">
                🏠 {tagForm.room_tag}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full font-medium animate-pulse">
                ⚠️ No room selected
              </span>
            )}
            {tagForm.damage_tag && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${tagInfo(tagForm.damage_tag)?.color}`}>
                {tagInfo(tagForm.damage_tag)?.emoji} {tagInfo(tagForm.damage_tag)?.label}
              </span>
            )}
            {tagForm.photo_source === 'insta360' && (
              <span className="text-[10px] px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full">🔵 Insta360</span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${showTagForm ? 'rotate-180' : ''}`} />
        </button>

        {showTagForm && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">

            {/* Photo Source selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                📷 Camera Source
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'standard', label: 'Standard Camera', sub: 'Phone, DSLR', icon: '📱' },
                  { value: 'insta360', label: 'Insta360 X4',     sub: '360° camera',  icon: '🔵' },
                ].map(src => (
                  <button
                    key={src.value}
                    type="button"
                    onClick={() => setTagForm(p => ({
                      ...p,
                      photo_source: src.value,
                      is_360: src.value !== 'insta360' ? false : p.is_360,
                    }))}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                      tagForm.photo_source === src.value
                        ? 'bg-cyan-500/15 border-cyan-500/60 ring-1 ring-cyan-500/40'
                        : 'bg-slate-700/30 border-slate-600/40 hover:border-slate-500/60'
                    }`}
                  >
                    <span className="text-xl">{src.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-white leading-tight">{src.label}</div>
                      <div className="text-[10px] text-slate-400">{src.sub}</div>
                    </div>
                  </button>
                ))}
              </div>

              {tagForm.photo_source === 'insta360' && (
                <div className="mt-3 bg-cyan-900/20 border border-cyan-700/30 rounded-xl p-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setTagForm(p => ({ ...p, is_360: !p.is_360 }))}
                      className={`w-10 h-5 rounded-full relative flex-shrink-0 transition ${tagForm.is_360 ? 'bg-cyan-500' : 'bg-slate-600'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${tagForm.is_360 ? 'left-5' : 'left-0.5'}`} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">Equirectangular 360° JPEG</div>
                      <div className="text-[10px] text-slate-400">Toggle ON for 360° viewer. Export as flat JPEG from Insta360 app first.</div>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* ─── ROOM (highlighted when no room selected) ───────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${
                  roomWarning || !tagForm.room_tag ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {!tagForm.room_tag ? '⚠️ Room (required)' : '🏠 Room'}
                </label>
                <select
                  value={tagForm.room_tag}
                  onChange={e => {
                    setTagForm(p => ({ ...p, room_tag: e.target.value }));
                    if (e.target.value) { setRoomWarning(false); setError(''); }
                  }}
                  className={`w-full px-3 py-2 bg-slate-700/50 border rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500 transition ${
                    !tagForm.room_tag
                      ? 'border-amber-500/50 focus:ring-amber-500'
                      : 'border-slate-600/50 focus:ring-cyan-500'
                  }`}
                >
                  <option value="">— Select room —</option>
                  {ROOM_TAGS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Damage Type</label>
                <select
                  value={tagForm.damage_tag}
                  onChange={e => setTagForm(p => ({ ...p, damage_tag: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {DAMAGE_TAGS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Severity</label>
                <select
                  value={tagForm.damage_severity}
                  onChange={e => setTagForm(p => ({ ...p, damage_severity: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {SEVERITY_LEVELS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Area + Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Area / Location</label>
                <input
                  type="text"
                  value={tagForm.area}
                  onChange={e => setTagForm(p => ({ ...p, area: e.target.value }))}
                  placeholder="e.g. North wall, Behind washer"
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes</label>
                <input
                  type="text"
                  value={tagForm.notes}
                  onChange={e => setTagForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Visible mold, saturation level…"
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-500"
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

      {/* ─── Filter bar + view toggle ────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
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
          {noRoomCount > 0 && (
            <button
              onClick={() => setFilter('no_room')}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                filter === 'no_room'
                  ? 'bg-amber-500 text-slate-900 border-amber-500'
                  : 'bg-amber-900/20 text-amber-400 border-amber-600/40 hover:border-amber-500/60'
              }`}
            >
              ⚠️ No Room ({noRoomCount})
            </button>
          )}
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

        <button
          onClick={() => setViewMode(v => v === 'grid' ? 'room' : 'grid')}
          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/40 rounded-xl text-slate-400 hover:text-white transition"
        >
          <Layers className="w-3.5 h-3.5" />
          {viewMode === 'grid' ? 'By Room' : 'Grid'}
        </button>
      </div>

      {/* ─── Alerts ──────────────────────────────────────────────── */}
      {error && (
        <div className="bg-amber-900/30 border border-amber-700/40 text-amber-300 text-sm rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-sm rounded-xl p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{success}
        </div>
      )}

      {/* ─── Photo Grid / Room View ───────────────────────────────── */}
      {filteredPhotos.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/40 rounded-2xl border-2 border-dashed border-slate-600/40">
          <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          {filter === 'no_room' ? (
            <>
              <p className="text-slate-300 font-semibold">No untagged photos 🎉</p>
              <p className="text-sm text-slate-500 mt-1">All photos have a room assigned</p>
            </>
          ) : (
            <>
              <p className="text-slate-300 font-semibold">No photos yet</p>
              <p className="text-sm text-slate-500 mt-1">Select a room above, then use <strong className="text-white">Take Photo</strong> or <strong className="text-white">Upload Files</strong></p>
              <p className="text-xs text-cyan-400/60 mt-2">🔵 Insta360 X4: export as flat JPEG from the Insta360 app first</p>
            </>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <PhotoGrid
          photos={filteredPhotos}
          onOpen={openLightbox}
          onDelete={deletePhoto}
          onMove={setMovePhoto}
          onAddCamera={handleTakePhoto}
          onAddFile={handleUploadFiles}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupByRoom(filteredPhotos)).map(([room, roomPhotos]) => (
            <div key={room}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-sm font-bold ${room === '—' ? 'text-amber-400' : 'text-white'}`}>
                  {room === '—' ? '⚠️ No room assigned' : room}
                </span>
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
                onMove={setMovePhoto}
                onAddCamera={handleTakePhoto}
                onAddFile={handleUploadFiles}
                compact
              />
            </div>
          ))}
        </div>
      )}

      {/* ─── Lightbox ────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-3 sm:p-6"
          onClick={() => { setLightbox(null); setEditing(false); }}
        >
          <div className="relative w-full max-w-4xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setLightbox(null); setEditing(false); }}
              className="absolute -top-9 right-0 text-white/60 hover:text-white z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {filteredPhotos.length > 1 && (
              <>
                <button
                  onClick={() => navLightbox(-1)}
                  className="absolute left-1 sm:-left-11 top-1/3 z-10 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navLightbox(1)}
                  className="absolute right-1 sm:-right-11 top-1/3 z-10 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

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
              {/* No-room badge in lightbox */}
              {!lightbox.room_tag && (
                <div className="absolute top-3 right-3 z-10">
                  <span className="text-[10px] bg-amber-500/80 text-slate-900 font-bold px-2 py-0.5 rounded-full">⚠️ No room</span>
                </div>
              )}
              <img
                src={lightbox.signedUrl || lightbox.photo_url}
                alt="Job photo"
                className="w-full max-h-[55vh] object-contain"
              />
            </div>

            <div className="mt-3 bg-slate-800/90 rounded-xl p-4">
              {!editing ? (
                <div className="space-y-3">
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
                    {lightbox.room_tag
                      ? <span className="text-sm text-white/80 font-medium">🏠 {lightbox.room_tag}</span>
                      : (
                        <button
                          onClick={() => setMovePhoto(lightbox)}
                          className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 px-2 py-0.5 rounded-full transition flex items-center gap-1"
                        >
                          <Home className="w-3 h-3" /> Assign room
                        </button>
                      )
                    }
                    {lightbox.area && <span className="text-sm text-white/50">{lightbox.area}</span>}
                  </div>
                  {lightbox.notes && (
                    <p className="text-sm text-slate-400 leading-relaxed">&ldquo;{lightbox.notes}&rdquo;</p>
                  )}
                  <p className="text-xs text-white/25">{new Date(lightbox.timestamp).toLocaleString()}</p>
                  <div className="flex gap-2 flex-wrap pt-1">
                    <button
                      onClick={() => openEdit(lightbox)}
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg transition"
                    >
                      <Tag className="w-3 h-3" /> Edit Tags
                    </button>
                    <button
                      onClick={() => setMovePhoto(lightbox)}
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition"
                    >
                      <Home className="w-3 h-3" /> {lightbox.room_tag ? 'Move Room' : 'Assign Room'}
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
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            {filteredPhotos.length > 1 && (
              <p className="text-center text-xs text-white/30 mt-2">
                {lbIdx + 1} / {filteredPhotos.length}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Move to Room Modal ───────────────────────────────────── */}
      {movePhoto && (
        <MoveToRoomModal
          photo={movePhoto}
          onClose={() => setMovePhoto(null)}
          onSave={(room) => reassignRoom(movePhoto, room)}
        />
      )}
    </div>
  );
}

// ─── Sub-component: Photo Grid ────────────────────────────────────────────────
function PhotoGrid({
  photos, onOpen, onDelete, onMove, onAddCamera, onAddFile, compact = false,
}: {
  photos: Photo[];
  onOpen: (p: Photo) => void;
  onDelete: (p: Photo) => void;
  onMove: (p: Photo) => void;
  onAddCamera: () => void;
  onAddFile: () => void;
  compact?: boolean;
}) {
  const cols = compact
    ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3';

  return (
    <div className={`grid ${cols}`}>
      {photos.map(photo => (
        <PhotoCard key={photo.id} photo={photo} onOpen={onOpen} onDelete={onDelete} onMove={onMove} />
      ))}
      <button
        onClick={onAddCamera}
        className={`${compact ? '' : 'aspect-square'} flex flex-col items-center justify-center bg-cyan-500/5 border-2 border-dashed border-cyan-500/30 rounded-xl hover:border-cyan-500/60 hover:bg-cyan-500/10 transition group min-h-[70px]`}
      >
        <Camera className="w-5 h-5 text-cyan-600 group-hover:text-cyan-400 transition" />
        <span className="text-[9px] text-slate-500 group-hover:text-cyan-400 mt-1">Camera</span>
      </button>
      <button
        onClick={onAddFile}
        className={`${compact ? '' : 'aspect-square'} flex flex-col items-center justify-center bg-slate-800/40 border-2 border-dashed border-slate-600/40 rounded-xl hover:border-slate-500/60 hover:bg-slate-700/40 transition group min-h-[70px]`}
      >
        <FolderOpen className="w-5 h-5 text-slate-600 group-hover:text-slate-300 transition" />
        <span className="text-[9px] text-slate-500 group-hover:text-slate-300 mt-1">Files</span>
      </button>
    </div>
  );
}

// ─── Sub-component: Photo Card ────────────────────────────────────────────────
function PhotoCard({
  photo, onOpen, onDelete, onMove,
}: {
  photo: Photo;
  onOpen: (p: Photo) => void;
  onDelete: (p: Photo) => void;
  onMove: (p: Photo) => void;
}) {
  const tag = tagInfo(photo.damage_tag || '');
  const sev = sevInfo(photo.damage_severity || '');
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className={`group relative bg-slate-800 rounded-xl overflow-hidden border transition aspect-square ${
      !photo.room_tag
        ? 'border-amber-500/30 hover:border-amber-500/60'
        : 'border-slate-700/50 hover:border-cyan-500/40'
    }`}>
      {imgErr ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 gap-1">
          <ImageOff className="w-5 h-5 text-slate-600" />
          <span className="text-[9px] text-slate-600">Load error</span>
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
        <div className="absolute top-1 right-7 z-10">
          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-cyan-500/80 text-slate-900">360°</span>
        </div>
      )}
      {/* Insta360 badge */}
      {photo.photo_source === 'insta360' && !photo.is_360 && (
        <div className="absolute top-1 right-7 z-10">
          <span className="text-[8px] px-1 py-0.5 rounded bg-slate-900/70 text-cyan-400 font-bold">X4</span>
        </div>
      )}

      {/* Severity dot */}
      {sev && (
        <div className={`absolute top-1.5 left-1.5 w-2 h-2 rounded-full ${sev.dot} shadow ring-1 ring-black/40`} />
      )}

      {/* Damage tag */}
      {tag && (
        <div className="absolute bottom-1 left-1">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tag.color}`}>
            {tag.emoji}
          </span>
        </div>
      )}

      {/* Room tag — clickable to reassign if present, or shows "no room" warning */}
      <div className="absolute bottom-1 right-1">
        {photo.room_tag ? (
          <button
            onClick={(e) => { e.stopPropagation(); onMove(photo); }}
            className="text-[8px] px-1 py-0.5 rounded bg-slate-900/80 text-slate-300 backdrop-blur-sm truncate max-w-[55px] block hover:bg-cyan-900/80 hover:text-cyan-300 transition"
            title={`Move from ${photo.room_tag}`}
          >
            {photo.room_tag}
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onMove(photo); }}
            className="text-[8px] px-1 py-0.5 rounded bg-amber-500/80 text-slate-900 font-bold hover:bg-amber-400 transition"
            title="Assign a room"
          >
            + Room
          </button>
        )}
      </div>

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
