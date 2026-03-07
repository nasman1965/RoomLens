'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Camera, Upload, X, ZoomIn, ChevronDown, Tag,
  Loader2, AlertCircle, CheckCircle, Image as ImageIcon,
  Trash2, Download, Filter
} from 'lucide-react';

interface Job { id: string; insured_name: string; property_address: string; }
interface Photo {
  id: string;
  job_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  tags: string[] | null;
  ai_analysis: { description?: string; damage_type?: string; xactimate_codes?: string[]; severity?: string } | null;
  created_at: string;
  room_id: string | null;
}

const TAG_OPTIONS = ['Before', 'After', 'Moisture Damage', 'Mold', 'Structural', 'Ceiling', 'Wall', 'Floor', 'Equipment', 'Evidence'];
const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

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
  const [tagFilter, setTagFilter] = useState('all');
  const [uploadTags, setUploadTags] = useState<string[]>(['Before']);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [userId, setUserId] = useState('');

  // Load jobs on mount
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
      if (jobsData && jobsData.length > 0) {
        setSelectedJobId(jobsData[0].id);
      }
      setLoading(false);
    };
    init();
  }, [router]);

  // Load photos when job changes
  useEffect(() => {
    if (!selectedJobId) { setPhotos([]); return; }
    const loadPhotos = async () => {
      const { data } = await supabase
        .from('damage_photos')
        .select('*')
        .eq('job_id', selectedJobId)
        .order('created_at', { ascending: false });
      setPhotos(data || []);
    };
    loadPhotos();
  }, [selectedJobId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.type.startsWith('image/'));
    if (valid.length !== files.length) setError('Only image files are accepted.');
    setPendingFiles(valid.slice(0, 10)); // max 10 at once
  };

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

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('damage-photos')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (storageError) {
        setError(`Failed to upload ${file.name}: ${storageError.message}`);
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('damage-photos')
        .getPublicUrl(path);

      // Insert DB record
      const { data: photoRecord } = await supabase
        .from('damage_photos')
        .insert({
          job_id: selectedJobId,
          photo_url: publicUrl,
          thumbnail_url: publicUrl,
          tags: uploadTags,
          technician_id: userId,
        })
        .select()
        .single();

      if (photoRecord) uploaded.push(photoRecord);
      setUploadProgress(Math.round(((i + 1) / pendingFiles.length) * 100));
    }

    setPhotos(prev => [...uploaded, ...prev]);
    setPendingFiles([]);
    setUploading(false);
    setSuccess(`${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} uploaded!`);
    setTimeout(() => setSuccess(''), 3000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (photo: Photo) => {
    if (!confirm('Delete this photo permanently?')) return;
    const path = photo.photo_url.split('/damage-photos/')[1];
    if (path) await supabase.storage.from('damage-photos').remove([path]);
    await supabase.from('damage_photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    if (lightbox?.id === photo.id) setLightbox(null);
  };

  const toggleUploadTag = (tag: string) => {
    setUploadTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const filteredPhotos = tagFilter === 'all'
    ? photos
    : photos.filter(p => p.tags?.includes(tagFilter));

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
            <Camera className="w-6 h-6 text-blue-600" /> Photo Library
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{photos.length} photo{photos.length !== 1 ? 's' : ''} · {selectedJob?.insured_name || 'No job selected'}</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!selectedJobId || uploading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
        >
          <Upload className="w-4 h-4" /> Upload Photos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
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

      {/* Job Selector + Tag Filter */}
      <div className="flex flex-wrap gap-3">
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
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          {['all', ...TAG_OPTIONS].map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                tagFilter === tag
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {tag === 'all' ? 'All' : tag}
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

          {/* Tag selector */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Tags (select all that apply):</p>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleUploadTag(tag)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                    uploadTags.includes(tag)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Thumbnails */}
          <div className="flex gap-2 flex-wrap">
            {pendingFiles.map((f, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                <button
                  onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                >
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
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading…' : 'Upload Now'}
            </button>
            <button
              onClick={() => setPendingFiles([])}
              disabled={uploading}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition"
            >
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
            {jobs.length === 0 ? 'Create a job first to upload photos.' : tagFilter !== 'all' ? `No "${tagFilter}" photos yet.` : 'No photos yet — click Upload Photos to add some.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredPhotos.map(photo => (
            <div key={photo.id} className="group relative bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition">
              {/* Thumbnail */}
              <div
                className="aspect-square cursor-pointer overflow-hidden"
                onClick={() => setLightbox(photo)}
              >
                <img
                  src={photo.photo_url}
                  alt="Damage photo"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50" y="55" text-anchor="middle" fill="%239ca3af" font-size="12">No preview</text></svg>'; }}
                />
              </div>
              {/* Overlay actions */}
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => setLightbox(photo)}
                  className="w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-white" />
                </button>
                <button
                  onClick={() => handleDelete(photo)}
                  className="w-7 h-7 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              {/* Tags */}
              {photo.tags && photo.tags.length > 0 && (
                <div className="absolute bottom-1.5 left-1.5 flex gap-1 flex-wrap max-w-[calc(100%-12px)]">
                  {photo.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[9px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                  {photo.tags.length > 2 && (
                    <span className="text-[9px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                      +{photo.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
              {/* AI badge */}
              {photo.ai_analysis?.severity && (
                <div className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${SEVERITY_COLORS[photo.ai_analysis.severity] || 'bg-gray-100 text-gray-600'}`}>
                  {photo.ai_analysis.severity.toUpperCase()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 flex-wrap">
                {lightbox.tags?.map(tag => (
                  <span key={tag} className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    <Tag className="w-3 h-3 inline mr-1" />{tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightbox.photo_url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  onClick={e => e.stopPropagation()}
                >
                  <Download className="w-4 h-4 text-gray-600" />
                </a>
                <button
                  onClick={() => { handleDelete(lightbox); }}
                  className="p-2 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
                <button onClick={() => setLightbox(null)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Photo */}
              <div className="bg-gray-900 flex items-center justify-center min-h-[300px]">
                <img
                  src={lightbox.photo_url}
                  alt="Full size"
                  className="max-w-full max-h-[60vh] object-contain"
                />
              </div>
              {/* Details */}
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Uploaded</p>
                  <p className="text-sm text-gray-700">{new Date(lightbox.created_at).toLocaleString()}</p>
                </div>
                {lightbox.ai_analysis ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                      ✨ AI Analysis
                    </h3>
                    {lightbox.ai_analysis.description && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Description</p>
                        <p className="text-sm text-gray-700">{lightbox.ai_analysis.description}</p>
                      </div>
                    )}
                    {lightbox.ai_analysis.damage_type && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Damage Type</p>
                        <p className="text-sm font-medium text-gray-800">{lightbox.ai_analysis.damage_type}</p>
                      </div>
                    )}
                    {lightbox.ai_analysis.severity && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Severity</p>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${SEVERITY_COLORS[lightbox.ai_analysis.severity]}`}>
                          {lightbox.ai_analysis.severity.toUpperCase()}
                        </span>
                      </div>
                    )}
                    {lightbox.ai_analysis.xactimate_codes && lightbox.ai_analysis.xactimate_codes.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Xactimate Codes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {lightbox.ai_analysis.xactimate_codes.map(code => (
                            <span key={code} className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-500">
                    <p className="mb-1">✨ AI analysis not yet run</p>
                    <p className="text-xs">AI photo analysis coming in next update</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
