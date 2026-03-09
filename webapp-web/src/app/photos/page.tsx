'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Camera, Upload, X, ZoomIn, ChevronDown, Tag,
  Loader2, AlertCircle, CheckCircle, Image as ImageIcon,
  Trash2, Download, Filter, MapPin, Clock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job { id: string; insured_name: string; property_address: string; }

interface Photo {
  id: string;
  job_id: string;
  photo_url: string;
  room_tag: string | null;       // actual DB column name
  damage_tag: string | null;     // actual DB column name
  area: string | null;
  floor: string | null;
  technician_id: string | null;
  timestamp: string;             // actual DB column (not created_at)
}

// ─── Tag/Category Options ──────────────────────────────────────────────────────
// Maps display labels to damage_tag values (must match DB CHECK constraint)
const DAMAGE_TAG_OPTIONS: { label: string; value: string }[] = [
  { label: 'Before',           value: 'pre_existing' },
  { label: 'Water Damage',     value: 'water'        },
  { label: 'Fire Damage',      value: 'fire'         },
  { label: 'Mold',             value: 'mold'         },
  { label: 'Structural',       value: 'structural'   },
  { label: 'Evidence',         value: 'evidence'     },
];

// Room tags (free-form)
const ROOM_TAG_OPTIONS = ['Ceiling', 'Wall', 'Floor', 'Equipment', 'After'];

function damageTagLabel(val: string | null) {
  if (!val) return null;
  return DAMAGE_TAG_OPTIONS.find(o => o.value === val)?.label || val;
}

export default function PhotosPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [damageTagFilter, setDamageTagFilter] = useState('all');
  const [uploadDamageTag, setUploadDamageTag] = useState('');
  const [uploadRoomTag, setUploadRoomTag] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [userId, setUserId] = useState('');

  // ── Load jobs on mount ────────────────────────────────────────────────────
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

  // ── Load photos when job changes ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedJobId) { setPhotos([]); return; }
    (async () => {
      const { data } = await supabase
        .from('damage_photos')
        .select('*')
        .eq('job_id', selectedJobId)
        .order('timestamp', { ascending: false });
      setPhotos(data || []);
    })();
  }, [selectedJobId]);

  // ── File selection ────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.type.startsWith('image/'));
    if (valid.length !== files.length) setError('Only image files are accepted.');
    setPendingFiles(valid.slice(0, 10));
  };

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!pendingFiles.length || !selectedJobId) return;
    setUploading(true);
    setUploadProgress(0);
    setError('');
    const uploaded: Photo[] = [];

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      const ext = file.name.split('.').pop();
      const path = `${userId}/${selectedJobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // 1. Upload to storage bucket 'damage-photos'
      const { error: storageError } = await supabase.storage
        .from('damage-photos')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (storageError) {
        setError(`Failed to upload ${file.name}: ${storageError.message}`);
        continue;
      }

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('damage-photos')
        .getPublicUrl(path);

      // 3. Insert DB record using correct column names from schema
      const insertPayload: Record<string, unknown> = {
        job_id: selectedJobId,
        photo_url: publicUrl,
        technician_id: userId,
      };
      if (uploadDamageTag) insertPayload.damage_tag = uploadDamageTag;
      if (uploadRoomTag)   insertPayload.room_tag   = uploadRoomTag;

      const { data: photoRecord, error: dbError } = await supabase
        .from('damage_photos')
        .insert(insertPayload)
        .select()
        .single();

      if (dbError) {
        setError(`Upload stored but DB record failed for ${file.name}: ${dbError.message}`);
        continue;
      }
      if (photoRecord) uploaded.push(photoRecord);
      setUploadProgress(Math.round(((i + 1) / pendingFiles.length) * 100));
    }

    if (uploaded.length > 0) {
      setPhotos(prev => [...uploaded, ...prev]);
      setSuccess(`${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} uploaded!`);
      setTimeout(() => setSuccess(''), 3000);
    }
    setPendingFiles([]);
    setUploading(false);
    setUploadDamageTag('');
    setUploadRoomTag('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (photo: Photo) => {
    if (!confirm('Delete this photo permanently?')) return;
    // Extract storage path from URL
    const urlParts = photo.photo_url.split('/damage-photos/');
    if (urlParts[1]) {
      await supabase.storage.from('damage-photos').remove([urlParts[1]]);
    }
    await supabase.from('damage_photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    if (lightbox?.id === photo.id) setLightbox(null);
    setSuccess('Photo deleted.');
    setTimeout(() => setSuccess(''), 2000);
  };

  // ── Filtered photos ───────────────────────────────────────────────────────
  const filteredPhotos = damageTagFilter === 'all'
    ? photos
    : photos.filter(p => p.damage_tag === damageTagFilter);

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // ── Loading ───────────────────────────────────────────────────────────────
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
            <Camera className="w-6 h-6 text-blue-600" /> Photo Library
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} ·{' '}
            {selectedJob ? `${selectedJob.insured_name} — ${selectedJob.property_address}` : 'No job selected'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!selectedJobId || uploading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
        >
          <Upload className="w-4 h-4" /> Upload Photos
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
      </div>

      {/* Alerts */}
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

      {/* Job Selector + Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Job selector */}
        <div className="relative">
          <select
            value={selectedJobId}
            onChange={e => setSelectedJobId(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[240px]"
          >
            {jobs.length === 0 && <option value="">No jobs yet</option>}
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.insured_name} — {j.property_address}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Damage tag filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <button type="button"
            onClick={() => setDamageTagFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${damageTagFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
            All
          </button>
          {DAMAGE_TAG_OPTIONS.map(opt => (
            <button type="button" key={opt.value}
              onClick={() => setDamageTagFilter(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${damageTagFilter === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
              {opt.label}
            </button>
          ))}
          {ROOM_TAG_OPTIONS.map(tag => (
            <button type="button" key={tag}
              onClick={() => setDamageTagFilter(tag)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${damageTagFilter === tag ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Pending Upload Preview */}
      {pendingFiles.length > 0 && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm">
            Ready to upload — {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}
          </h3>

          {/* Tag selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Damage Type (optional):</p>
              <div className="flex flex-wrap gap-2">
                {DAMAGE_TAG_OPTIONS.map(opt => (
                  <button type="button" key={opt.value}
                    onClick={() => setUploadDamageTag(uploadDamageTag === opt.value ? '' : opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                      uploadDamageTag === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Room / Area (optional):</p>
              <div className="flex flex-wrap gap-2">
                {ROOM_TAG_OPTIONS.map(tag => (
                  <button type="button" key={tag}
                    onClick={() => setUploadRoomTag(uploadRoomTag === tag ? '' : tag)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                      uploadRoomTag === tag
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-gray-50 text-gray-600 border-gray-300 hover:border-purple-400'
                    }`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Thumbnails preview */}
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

          {/* Upload progress */}
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
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Photo Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {jobs.length === 0
              ? 'Create a job first to upload photos.'
              : damageTagFilter !== 'all'
              ? `No "${DAMAGE_TAG_OPTIONS.find(o=>o.value===damageTagFilter)?.label || damageTagFilter}" photos yet.`
              : 'No photos yet — click Upload Photos to add some.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredPhotos.map(photo => (
            <div key={photo.id} className="group relative bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition">
              {/* Thumbnail */}
              <div className="aspect-square cursor-pointer overflow-hidden" onClick={() => setLightbox(photo)}>
                <img
                  src={photo.photo_url}
                  alt="Damage photo"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  onError={e => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50" y="55" text-anchor="middle" fill="%239ca3af" font-size="12">No preview</text></svg>';
                  }}
                />
              </div>
              {/* Hover actions */}
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button type="button" onClick={() => setLightbox(photo)}
                  className="w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center">
                  <ZoomIn className="w-3.5 h-3.5 text-white" />
                </button>
                <button type="button" onClick={() => handleDelete(photo)}
                  className="w-7 h-7 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              {/* Tag badges */}
              <div className="absolute bottom-1.5 left-1.5 flex gap-1 flex-wrap max-w-[calc(100%-12px)]">
                {photo.damage_tag && (
                  <span className="text-[9px] font-semibold bg-blue-600/80 text-white px-1.5 py-0.5 rounded-full">
                    {damageTagLabel(photo.damage_tag)}
                  </span>
                )}
                {photo.room_tag && (
                  <span className="text-[9px] font-semibold bg-purple-600/80 text-white px-1.5 py-0.5 rounded-full">
                    {photo.room_tag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 flex-wrap">
                {lightbox.damage_tag && (
                  <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Tag className="w-3 h-3" />{damageTagLabel(lightbox.damage_tag)}
                  </span>
                )}
                {lightbox.room_tag && (
                  <span className="text-xs font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Tag className="w-3 h-3" />{lightbox.room_tag}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a href={lightbox.photo_url} download target="_blank" rel="noreferrer"
                  className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={e => e.stopPropagation()}>
                  <Download className="w-4 h-4 text-gray-600" />
                </a>
                <button type="button" onClick={() => { handleDelete(lightbox); }}
                  className="p-2 hover:bg-red-50 rounded-lg transition">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
                <button type="button" onClick={() => setLightbox(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition">
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Full photo */}
              <div className="bg-gray-900 flex items-center justify-center min-h-[300px]">
                <img src={lightbox.photo_url} alt="Full size"
                  className="max-w-full max-h-[60vh] object-contain" />
              </div>
              {/* Details panel */}
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Uploaded
                  </p>
                  <p className="text-sm text-gray-700">{new Date(lightbox.timestamp).toLocaleString()}</p>
                </div>
                {lightbox.area && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Area
                    </p>
                    <p className="text-sm text-gray-700">{lightbox.area}</p>
                  </div>
                )}
                {lightbox.floor && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Floor</p>
                    <p className="text-sm text-gray-700">{lightbox.floor}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {lightbox.damage_tag && (
                      <span className="text-xs bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded-full">
                        💧 {damageTagLabel(lightbox.damage_tag)}
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
