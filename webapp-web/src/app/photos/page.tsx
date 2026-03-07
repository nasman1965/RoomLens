'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Camera, Upload, X, ZoomIn, Tag, Briefcase,
  Loader2, AlertCircle, Image as ImageIcon, Trash2
} from 'lucide-react';

interface Job {
  id: string;
  insured_name: string;
  property_address: string;
  status: string;
}

interface Photo {
  id: string;
  job_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  tags: string[] | null;
  ai_analysis: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
}

export default function PhotosPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [userId, setUserId] = useState('');

  /* ── auth + jobs ── */
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);

      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address, status')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setJobs(jobData || []);
      if (jobData && jobData.length > 0) setSelectedJobId(jobData[0].id);
      setLoading(false);
    };
    init();
  }, [router]);

  /* ── load photos when job changes ── */
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

  /* ── upload handler ── */
  const handleUpload = async (files: FileList | null) => {
    if (!files || !selectedJobId) return;
    setUploading(true);
    setError('');
    const total = files.length;
    let done = 0;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const ext = file.name.split('.').pop();
      const path = `${userId}/${selectedJobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from('damage-photos')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (storageErr) { setError(`Upload failed: ${storageErr.message}`); continue; }

      const { data: { publicUrl } } = supabase.storage
        .from('damage-photos')
        .getPublicUrl(path);

      await supabase.from('damage_photos').insert({
        job_id: selectedJobId,
        photo_url: publicUrl,
        thumbnail_url: publicUrl,
        tags: [],
        notes: file.name,
      });

      done++;
      setUploadProgress(Math.round((done / total) * 100));
    }

    /* refresh */
    const { data } = await supabase
      .from('damage_photos')
      .select('*')
      .eq('job_id', selectedJobId)
      .order('created_at', { ascending: false });
    setPhotos(data || []);
    setUploading(false);
    setUploadProgress(0);
  };

  /* ── delete photo ── */
  const deletePhoto = async (photo: Photo) => {
    if (!confirm('Delete this photo?')) return;
    await supabase.from('damage_photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    if (lightbox?.id === photo.id) setLightbox(null);
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
            <Camera className="w-6 h-6 text-blue-600" /> Photo Library
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Damage documentation photos per job</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!selectedJobId || uploading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm"
        >
          <Upload className="w-4 h-4" />
          {uploading ? `Uploading… ${uploadProgress}%` : 'Upload Photos'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />
      </div>

      {/* Job Selector */}
      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No jobs found. Create a job first.</p>
          <Link href="/jobs/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-700 transition">
            + New Job
          </Link>
        </div>
      ) : (
        <>
          {/* Job picker row */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Select Job
            </label>
            <div className="flex flex-wrap gap-2">
              {jobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
                    selectedJobId === job.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  {job.insured_name}
                  <span className="ml-1 text-xs opacity-70">— {job.property_address.slice(0, 20)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Upload progress bar */}
          {uploading && (
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Drag & drop photos here, or <span className="text-blue-600 font-medium">click to browse</span></p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, HEIC — multiple files supported</p>
          </div>

          {/* Gallery */}
          {photos.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <Camera className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No photos for <strong>{selectedJob?.insured_name}</strong> yet.</p>
              <p className="text-xs text-gray-400 mt-1">Upload photos using the button or drag & drop above.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 font-medium">
                  {photos.length} photo{photos.length !== 1 ? 's' : ''} for <strong>{selectedJob?.insured_name}</strong>
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {photos.map(photo => (
                  <div
                    key={photo.id}
                    className="group relative bg-gray-100 rounded-xl overflow-hidden aspect-square border border-gray-200 hover:border-blue-400 transition"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.photo_url}
                      alt={photo.notes || 'Damage photo'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => setLightbox(photo)}
                        className="p-2 bg-white/90 rounded-full text-gray-800 hover:bg-white transition"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePhoto(photo)}
                        className="p-2 bg-red-500/90 rounded-full text-white hover:bg-red-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Tags */}
                    {photo.tags && photo.tags.length > 0 && (
                      <div className="absolute bottom-1 left-1 flex gap-1">
                        {photo.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Tag className="w-2 h-2" />{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Date */}
                    <div className="absolute top-1 right-1">
                      <span className="text-[9px] bg-black/50 text-white px-1.5 py-0.5 rounded-full">
                        {new Date(photo.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.photo_url}
              alt={lightbox.notes || 'Photo'}
              className="w-full max-h-[70vh] object-contain bg-gray-900"
            />
            <div className="p-4 space-y-2">
              {lightbox.notes && (
                <p className="text-sm font-medium text-gray-800">{lightbox.notes}</p>
              )}
              {lightbox.tags && lightbox.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {lightbox.tags.map(tag => (
                    <span key={tag} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {lightbox.ai_analysis && Object.keys(lightbox.ai_analysis).length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-purple-700 mb-1">🤖 AI Analysis</p>
                  <pre className="text-xs text-purple-800 whitespace-pre-wrap">
                    {JSON.stringify(lightbox.ai_analysis, null, 2)}
                  </pre>
                </div>
              )}
              <p className="text-xs text-gray-400">
                Uploaded {new Date(lightbox.created_at).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <a
                  href={lightbox.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Open full size ↗
                </a>
                <button
                  onClick={() => deletePhoto(lightbox)}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
