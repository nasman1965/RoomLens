'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Camera, Upload, X, ZoomIn, ChevronDown, Tag,
  Loader2, AlertCircle, CheckCircle, Image as ImageIcon,
  Trash2, Download, Filter, MapPin, Clock, Plus, Home,
  GripVertical, ArrowRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job { id: string; insured_name: string; property_address: string; }

interface Photo {
  id: string;
  job_id: string;
  photo_url: string;
  room_tag: string | null;
  damage_tag: string | null;
  area: string | null;
  floor: string | null;
  technician_id: string | null;
  timestamp: string;
  signedUrl?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DAMAGE_TAG_OPTIONS: { label: string; value: string; emoji: string }[] = [
  { label: 'Before',       value: 'pre_existing', emoji: '📷' },
  { label: 'Water Damage', value: 'water',        emoji: '💧' },
  { label: 'Fire Damage',  value: 'fire',         emoji: '🔥' },
  { label: 'Mold',         value: 'mold',         emoji: '🟢' },
  { label: 'Structural',   value: 'structural',   emoji: '🏗️' },
  { label: 'Evidence',     value: 'evidence',     emoji: '🔍' },
];

const DEFAULT_ROOMS = [
  'Basement', 'Main Floor', 'Upper Floor', 'Kitchen',
  'Bathroom', 'Bedroom', 'Living Room', 'Garage', 'Exterior',
];

const UNASSIGNED_KEY = '__unassigned__';

function damageTagLabel(val: string | null) {
  if (!val) return null;
  return DAMAGE_TAG_OPTIONS.find(o => o.value === val)?.label || val;
}

function extractStoragePath(url: string): string | null {
  try {
    const marker = '/damage-photos/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
  } catch { return null; }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PhotosPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs]                     = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId]   = useState('');
  const [photos, setPhotos]                 = useState<Photo[]>([]);
  const [loading, setLoading]               = useState(true);
  const [uploading, setUploading]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState('');
  const [lightbox, setLightbox]             = useState<Photo | null>(null);
  const [damageTagFilter, setDamageTagFilter] = useState('all');
  const [uploadDamageTag, setUploadDamageTag] = useState('');
  const [uploadRoomTag, setUploadRoomTag]   = useState('');
  const [pendingFiles, setPendingFiles]     = useState<File[]>([]);
  const [userId, setUserId]                 = useState('');

  // Room management
  const [rooms, setRooms]             = useState<string[]>([]);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [viewMode, setViewMode]       = useState<'grid' | 'rooms'>('grid');

  // Drag & drop state
  const [draggingPhotoId, setDraggingPhotoId]   = useState<string | null>(null);
  const [dragOverRoom, setDragOverRoom]         = useState<string | null>(null);
  const [savingMove, setSavingMove]             = useState<string | null>(null); // photoId being saved

  // ── Auth + Jobs ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);
      const { data } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      const jobList = data || [];
      setJobs(jobList);
      if (jobList.length > 0) setSelectedJobId(jobList[0].id);
      setLoading(false);
    })();
  }, [router]);

  // ── Load photos + derive rooms ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedJobId) { setPhotos([]); return; }
    (async () => {
      const { data } = await supabase
        .from('damage_photos')
        .select('*')
        .eq('job_id', selectedJobId)
        .order('timestamp', { ascending: false });

      const raw: Photo[] = data || [];
      const withSigned = await Promise.all(raw.map(async (p) => {
        const path = extractStoragePath(p.photo_url);
        if (!path) return { ...p, signedUrl: p.photo_url };
        const { data: s } = await supabase.storage
          .from('damage-photos')
          .createSignedUrl(path, 3600);
        return { ...p, signedUrl: s?.signedUrl || p.photo_url };
      }));

      setPhotos(withSigned);
      const existing = Array.from(
        new Set(withSigned.map(p => p.room_tag).filter(Boolean) as string[])
      );
      setRooms(existing);
    })();
  }, [selectedJobId]);

  // ── Add Room ────────────────────────────────────────────────────────────
  const handleAddRoom = () => {
    const name = newRoomName.trim();
    if (!name) return;
    if (!rooms.includes(name)) setRooms(prev => [...prev, name]);
    setUploadRoomTag(name);
    setNewRoomName('');
    setShowAddRoom(false);
  };

  // ── File select ─────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.type.startsWith('image/'));
    if (valid.length !== files.length) setError('Only image files accepted.');
    setPendingFiles(valid.slice(0, 20));
  };

  // ── Upload ──────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!pendingFiles.length || !selectedJobId) return;
    setUploading(true); setUploadProgress(0); setError('');
    const uploaded: Photo[] = [];

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      const ext  = file.name.split('.').pop();
      const path = `${userId}/${selectedJobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: se } = await supabase.storage
        .from('damage-photos')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (se) { setError(`Failed: ${file.name} — ${se.message}`); continue; }

      const { data: signed } = await supabase.storage
        .from('damage-photos').createSignedUrl(path, 3600);
      const { data: { publicUrl } } = supabase.storage
        .from('damage-photos').getPublicUrl(path);

      const payload: Record<string, unknown> = {
        job_id: selectedJobId, photo_url: publicUrl, technician_id: userId,
      };
      if (uploadDamageTag) payload.damage_tag = uploadDamageTag;
      if (uploadRoomTag) {
        payload.room_tag = uploadRoomTag;
        if (!rooms.includes(uploadRoomTag)) setRooms(p => [...p, uploadRoomTag]);
      }

      const { data: rec, error: de } = await supabase
        .from('damage_photos').insert(payload).select().single();
      if (de) { setError(`DB error: ${file.name} — ${de.message}`); continue; }
      if (rec) uploaded.push({ ...rec, signedUrl: signed?.signedUrl || rec.photo_url });
      setUploadProgress(Math.round(((i + 1) / pendingFiles.length) * 100));
    }

    if (uploaded.length) {
      setPhotos(p => [...uploaded, ...p]);
      setSuccess(`${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} uploaded!`);
      setTimeout(() => setSuccess(''), 3000);
    }
    setPendingFiles([]); setUploading(false);
    setUploadDamageTag(''); setUploadRoomTag('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (photo: Photo) => {
    if (!confirm('Delete this photo permanently?')) return;
    const path = extractStoragePath(photo.photo_url);
    if (path) await supabase.storage.from('damage-photos').remove([path]);
    await supabase.from('damage_photos').delete().eq('id', photo.id);
    setPhotos(p => p.filter(x => x.id !== photo.id));
    if (lightbox?.id === photo.id) setLightbox(null);
    setSuccess('Photo deleted.'); setTimeout(() => setSuccess(''), 2000);
  };

  // ── DRAG & DROP handlers ────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, photoId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('photoId', photoId);
    setDraggingPhotoId(photoId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingPhotoId(null);
    setDragOverRoom(null);
  }, []);

  const handleDragOverRoom = useCallback((e: React.DragEvent, roomKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverRoom(roomKey);
  }, []);

  const handleDragLeaveRoom = useCallback(() => {
    setDragOverRoom(null);
  }, []);

  const handleDropOnRoom = useCallback(async (e: React.DragEvent, targetRoom: string | null) => {
    e.preventDefault();
    const photoId = e.dataTransfer.getData('photoId');
    setDragOverRoom(null);
    setDraggingPhotoId(null);
    if (!photoId) return;

    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    // No change needed
    const currentRoom = photo.room_tag || null;
    if (currentRoom === targetRoom) return;

    setSavingMove(photoId);

    const { error: updateError } = await supabase
      .from('damage_photos')
      .update({ room_tag: targetRoom })
      .eq('id', photoId);

    if (updateError) {
      setError(`Failed to move photo: ${updateError.message}`);
    } else {
      setPhotos(prev => prev.map(p =>
        p.id === photoId ? { ...p, room_tag: targetRoom } : p
      ));
      const fromLabel = currentRoom || 'Unassigned';
      const toLabel   = targetRoom  || 'Unassigned';
      setSuccess(`Photo moved: ${fromLabel} → ${toLabel}`);
      setTimeout(() => setSuccess(''), 2500);
    }
    setSavingMove(null);
  }, [photos]);

  // ── Derived data ────────────────────────────────────────────────────────
  const selectedJob  = jobs.find(j => j.id === selectedJobId);
  const allRooms     = Array.from(new Set([...rooms]));
  const unassigned   = photos.filter(p => !p.room_tag);

  const filteredPhotos = photos.filter(p =>
    (damageTagFilter === 'all' || p.damage_tag === damageTagFilter)
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Camera className="w-6 h-6 text-blue-600" /> Photo Library
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} ·{' '}
            {selectedJob ? `${selectedJob.insured_name} — ${selectedJob.property_address}` : 'No job selected'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            <button type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 transition ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Grid
            </button>
            <button type="button"
              onClick={() => setViewMode('rooms')}
              className={`px-3 py-2 transition ${viewMode === 'rooms' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              🏠 Rooms
            </button>
          </div>
          <button type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!selectedJobId || uploading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
            <Upload className="w-4 h-4" /> Upload Photos
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button type="button" onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
        </div>
      )}

      {/* ── Job Selector ───────────────────────────────────────────────── */}
      <div className="relative w-full max-w-sm">
        <select value={selectedJobId}
          onChange={e => setSelectedJobId(e.target.value)}
          className="appearance-none w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          {jobs.length === 0 && <option value="">No jobs yet</option>}
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.insured_name} — {j.property_address}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* ── Room Management Bar ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Home className="w-4 h-4 text-blue-500" /> Rooms
            {viewMode === 'rooms' && (
              <span className="text-xs font-normal text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                drag photos between rooms
              </span>
            )}
          </h3>
          <button type="button" onClick={() => setShowAddRoom(!showAddRoom)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 px-2.5 py-1.5 rounded-lg transition">
            <Plus className="w-3.5 h-3.5" /> Add Room
          </button>
        </div>

        {/* Add Room Input */}
        {showAddRoom && (
          <div className="mb-3 space-y-2">
            <div className="flex gap-2">
              <input type="text" value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddRoom(); if (e.key === 'Escape') setShowAddRoom(false); }}
                placeholder="e.g. Master Bedroom, Powder Room..."
                autoFocus
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_ROOMS.filter(r => !rooms.includes(r)).map(r => (
                <button key={r} type="button" onClick={() => setNewRoomName(r)}
                  className="text-xs px-2 py-1 bg-gray-50 border border-gray-200 rounded-md hover:border-blue-400 hover:text-blue-600 transition">
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddRoom} disabled={!newRoomName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                Add Room
              </button>
              <button type="button" onClick={() => { setShowAddRoom(false); setNewRoomName(''); }}
                className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Room pills */}
        <div className="flex flex-wrap gap-2">
          {allRooms.map(room => (
            <span key={room}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 font-medium">
              🏠 {room}
              <span className="opacity-60">({photos.filter(p => p.room_tag === room).length})</span>
            </span>
          ))}
          {unassigned.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
              Unassigned ({unassigned.length})
            </span>
          )}
          {allRooms.length === 0 && !unassigned.length && (
            <p className="text-xs text-gray-400 italic">Add a room to start organising photos</p>
          )}
        </div>
      </div>

      {/* ── Damage filter (Grid mode) ───────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500 font-medium">Damage type:</span>
          {['all', ...DAMAGE_TAG_OPTIONS.map(o => o.value)].map(val => (
            <button type="button" key={val}
              onClick={() => setDamageTagFilter(val)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${damageTagFilter === val ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
              {val === 'all' ? 'All' : DAMAGE_TAG_OPTIONS.find(o => o.value === val)?.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Pending Upload Panel ───────────────────────────────────────── */}
      {pendingFiles.length > 0 && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm">
            Ready to upload — {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Damage Type:</p>
              <div className="flex flex-wrap gap-2">
                {DAMAGE_TAG_OPTIONS.map(opt => (
                  <button type="button" key={opt.value}
                    onClick={() => setUploadDamageTag(uploadDamageTag === opt.value ? '' : opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${uploadDamageTag === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Room:</p>
              <div className="flex flex-wrap gap-2">
                {allRooms.map(room => (
                  <button type="button" key={room}
                    onClick={() => setUploadRoomTag(uploadRoomTag === room ? '' : room)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${uploadRoomTag === room ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-50 text-gray-600 border-gray-300 hover:border-purple-400'}`}>
                    🏠 {room}
                  </button>
                ))}
                {allRooms.length === 0 && <p className="text-xs text-gray-400 italic">Add a room first</p>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {pendingFiles.map((f, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                <button type="button"
                  onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
          </div>
          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Uploading…</span><span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={handleUpload} disabled={uploading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading…' : 'Upload Now'}
            </button>
            <button type="button" onClick={() => setPendingFiles([])} disabled={uploading}
              className="text-sm text-gray-500 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW MODE: GRID ─────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {viewMode === 'grid' && (
        filteredPhotos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {jobs.length === 0 ? 'Create a job first.' : 'No photos yet — click Upload Photos.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredPhotos.map(photo => (
              <PhotoCard key={photo.id} photo={photo}
                isDragging={draggingPhotoId === photo.id}
                isSaving={savingMove === photo.id}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDelete={handleDelete}
                onClick={() => setLightbox(photo)}
              />
            ))}
          </div>
        )
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW MODE: ROOMS (drag & drop) ──────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {viewMode === 'rooms' && (
        <div className="space-y-4">
          {draggingPhotoId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2">
              <GripVertical className="w-4 h-4" />
              Drag the photo to a room below to reassign it
              <ArrowRight className="w-4 h-4 ml-auto" />
            </div>
          )}

          {/* Unassigned drop zone */}
          <RoomDropZone
            roomKey={UNASSIGNED_KEY}
            label="Unassigned"
            photos={unassigned}
            isDragOver={dragOverRoom === UNASSIGNED_KEY}
            draggingPhotoId={draggingPhotoId}
            savingMove={savingMove}
            onDragOver={e => handleDragOverRoom(e, UNASSIGNED_KEY)}
            onDragLeave={handleDragLeaveRoom}
            onDrop={e => handleDropOnRoom(e, null)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDelete={handleDelete}
            onPhotoClick={setLightbox}
          />

          {/* One drop zone per room */}
          {allRooms.map(room => (
            <RoomDropZone
              key={room}
              roomKey={room}
              label={room}
              photos={photos.filter(p => p.room_tag === room)}
              isDragOver={dragOverRoom === room}
              draggingPhotoId={draggingPhotoId}
              savingMove={savingMove}
              onDragOver={e => handleDragOverRoom(e, room)}
              onDragLeave={handleDragLeaveRoom}
              onDrop={e => handleDropOnRoom(e, room)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDelete={handleDelete}
              onPhotoClick={setLightbox}
            />
          ))}

          {allRooms.length === 0 && (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <Home className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No rooms yet</p>
              <p className="text-gray-400 text-sm mt-1">Click "Add Room" above to create your first room</p>
            </div>
          )}
        </div>
      )}

      {/* ── Lightbox ────────────────────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 flex-wrap">
                {lightbox.room_tag && (
                  <span className="text-xs font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                    🏠 {lightbox.room_tag}
                  </span>
                )}
                {lightbox.damage_tag && (
                  <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Tag className="w-3 h-3" />{damageTagLabel(lightbox.damage_tag)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a href={lightbox.signedUrl || lightbox.photo_url} download target="_blank" rel="noreferrer"
                  className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={e => e.stopPropagation()}>
                  <Download className="w-4 h-4 text-gray-600" />
                </a>
                <button type="button" onClick={() => handleDelete(lightbox)}
                  className="p-2 hover:bg-red-50 rounded-lg transition">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
                <button type="button" onClick={() => setLightbox(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition">
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="bg-gray-900 flex items-center justify-center min-h-[300px]">
                <img src={lightbox.signedUrl || lightbox.photo_url} alt="Full size"
                  className="max-w-full max-h-[60vh] object-contain" />
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Uploaded
                  </p>
                  <p className="text-sm text-gray-700">{new Date(lightbox.timestamp).toLocaleString()}</p>
                </div>
                {lightbox.room_tag && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <Home className="w-3 h-3" /> Room
                    </p>
                    <p className="text-sm font-medium text-gray-700">{lightbox.room_tag}</p>
                  </div>
                )}
                {lightbox.area && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Area
                    </p>
                    <p className="text-sm text-gray-700">{lightbox.area}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {lightbox.damage_tag && (
                      <span className="text-xs bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded-full">
                        {DAMAGE_TAG_OPTIONS.find(o => o.value === lightbox.damage_tag)?.emoji}{' '}
                        {damageTagLabel(lightbox.damage_tag)}
                      </span>
                    )}
                    {lightbox.room_tag && (
                      <span className="text-xs bg-purple-50 text-purple-700 font-medium px-2.5 py-1 rounded-full">
                        🏠 {lightbox.room_tag}
                      </span>
                    )}
                    {!lightbox.damage_tag && !lightbox.room_tag && (
                      <span className="text-xs text-gray-400 italic">No tags</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PhotoCard sub-component ──────────────────────────────────────────────────
function PhotoCard({
  photo, isDragging, isSaving, onDragStart, onDragEnd, onDelete, onClick,
}: {
  photo: Photo;
  isDragging: boolean;
  isSaving: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDelete: (p: Photo) => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, photo.id)}
      onDragEnd={onDragEnd}
      className={`group relative bg-white rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing select-none
        ${isDragging ? 'opacity-40 scale-95 border-blue-400' : 'border-gray-200'}
        ${isSaving  ? 'opacity-60' : ''}`}
    >
      {/* Grab handle */}
      <div className="absolute top-1.5 left-1.5 z-10 opacity-0 group-hover:opacity-100 transition">
        <div className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
          <GripVertical className="w-3 h-3 text-white" />
        </div>
      </div>

      {isSaving && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        </div>
      )}

      <div className="aspect-square cursor-pointer overflow-hidden bg-gray-100" onClick={onClick}>
        <img
          src={photo.signedUrl || photo.photo_url}
          alt="Damage photo"
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          onError={e => {
            (e.target as HTMLImageElement).src =
              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50" y="55" text-anchor="middle" fill="%239ca3af" font-size="11">No preview</text></svg>';
          }}
        />
      </div>

      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button type="button" onClick={onClick}
          className="w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center">
          <ZoomIn className="w-3.5 h-3.5 text-white" />
        </button>
        <button type="button" onClick={() => onDelete(photo)}
          className="w-7 h-7 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center">
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </button>
      </div>

      <div className="absolute bottom-1.5 left-1.5 flex gap-1 flex-wrap max-w-[calc(100%-12px)]">
        {photo.damage_tag && (
          <span className="text-[9px] font-semibold bg-blue-600/80 text-white px-1.5 py-0.5 rounded-full">
            {DAMAGE_TAG_OPTIONS.find(o => o.value === photo.damage_tag)?.label || photo.damage_tag}
          </span>
        )}
        {photo.room_tag && (
          <span className="text-[9px] font-semibold bg-purple-600/80 text-white px-1.5 py-0.5 rounded-full">
            {photo.room_tag}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── RoomDropZone sub-component ───────────────────────────────────────────────
function RoomDropZone({
  roomKey, label, photos, isDragOver, draggingPhotoId, savingMove,
  onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd, onDelete, onPhotoClick,
}: {
  roomKey: string;
  label: string;
  photos: Photo[];
  isDragOver: boolean;
  draggingPhotoId: string | null;
  savingMove: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDelete: (p: Photo) => void;
  onPhotoClick: (p: Photo) => void;
}) {
  const isUnassigned = roomKey === UNASSIGNED_KEY;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-xl border-2 transition-all duration-150 ${
        isDragOver
          ? 'border-blue-400 bg-blue-50 shadow-lg scale-[1.01]'
          : isUnassigned
          ? 'border-dashed border-gray-200 bg-gray-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Room header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDragOver ? 'border-blue-200' : 'border-gray-100'}`}>
        <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
          {isUnassigned ? (
            <span className="text-gray-400">📂 {label}</span>
          ) : (
            <span>🏠 {label}</span>
          )}
          <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${
            isDragOver ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </span>
        </h3>
        {isDragOver && (
          <span className="text-xs text-blue-600 font-medium animate-pulse">
            ↓ Drop here
          </span>
        )}
      </div>

      {/* Photos grid inside the room */}
      <div className="p-3">
        {photos.length === 0 ? (
          <div className={`flex items-center justify-center h-20 rounded-lg border-2 border-dashed transition ${
            isDragOver ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
          }`}>
            <p className="text-xs text-gray-400">
              {isDragOver ? '✨ Release to drop here' : 'Drag photos here'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2">
            {photos.map(photo => (
              <PhotoCard key={photo.id} photo={photo}
                isDragging={draggingPhotoId === photo.id}
                isSaving={savingMove === photo.id}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDelete={onDelete}
                onClick={() => onPhotoClick(photo)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
