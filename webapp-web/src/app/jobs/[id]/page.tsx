'use client';
import { useState, useEffect } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Job, JobStatus, JOB_STATUS_COLORS, JOB_STATUS_LABELS, JOB_TYPE_ICONS, JOB_TYPE_LABELS } from '@/types';
import {
  ChevronLeft, Map, Droplets, Camera, FileText,
  Loader2, Trash2, Calendar, MapPin, Edit3, Check, X,
} from 'lucide-react';

const MODULE_TILES = [
  { icon: '🗺️', label: '360° Floor Plan', desc: 'Capture room dimensions', color: 'from-blue-500 to-blue-700', href: '/floorplans' },
  { icon: '💧', label: 'Moisture Map', desc: 'IICRC S500 tracking', color: 'from-cyan-500 to-cyan-700', href: '/moisture' },
  { icon: '📸', label: 'Damage Photos', desc: 'AI photo analysis', color: 'from-purple-500 to-purple-700', href: '/photos' },
  { icon: '📄', label: 'Estimate Draft', desc: 'Xactimate line items', color: 'from-amber-500 to-amber-700', href: '/reports' },
];

const STATUSES: JobStatus[] = ['draft', 'active', 'complete', 'invoiced'];

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (!u) { router.push('/login'); return; }
      const snap = await getDoc(doc(db, 'jobs', id));
      if (!snap.exists() || snap.data()?.user_id !== u.uid) {
        router.push('/jobs'); return;
      }
      const data = { ...snap.data(), id: snap.id } as Job;
      setJob(data);
      setNotesVal(data.notes || '');
      setLoading(false);
    });
    return unsub;
  }, [id, router]);

  const handleStatusChange = async (status: JobStatus) => {
    if (!job) return;
    try {
      await updateDoc(doc(db, 'jobs', job.id), { status });
      setJob(prev => prev ? { ...prev, status } : prev);
    } catch { /* ignore */ }
  };

  const handleSaveNotes = async () => {
    if (!job) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'jobs', job.id), { notes: notesVal });
      setJob(prev => prev ? { ...prev, notes: notesVal } : prev);
      setEditingNotes(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!job || !confirm('Permanently delete this job and all its data?')) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'jobs', job.id));
      router.push('/jobs');
    } catch { setDeleting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-gray-300" />
    </div>
  );

  if (!job) return (
    <div className="max-w-2xl mx-auto px-6 py-8 text-center">
      <p className="text-gray-500">Job not found.</p>
      <Link href="/jobs" className="text-sm font-medium mt-2 block" style={{ color: '#0a1628' }}>← Back to Jobs</Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back */}
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ChevronLeft size={16} /> Back to Jobs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
            {JOB_TYPE_ICONS[job.job_type]}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">{job.property_address}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin size={11} /> {JOB_TYPE_LABELS[job.job_type]}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar size={11} />
                {new Date(job.created_at).toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
        <button onClick={handleDelete} disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Delete
        </button>
      </div>

      {/* Status */}
      <div className="card p-5 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Job Status</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button key={s} onClick={() => handleStatusChange(s)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${job.status === s ? JOB_STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {JOB_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Module tiles */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-gray-900 mb-3">Documentation Modules</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {MODULE_TILES.map(tile => (
            <Link key={tile.label} href={`${tile.href}?jobId=${job.id}`}
              className="card p-4 hover:shadow-md transition-all group cursor-pointer">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tile.color} flex items-center justify-center text-lg mb-2.5 group-hover:scale-105 transition-transform`}>
                {tile.icon}
              </div>
              <p className="text-xs font-bold text-gray-900">{tile.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{tile.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* GPS */}
      {(job.gps_lat || job.gps_lng) && (
        <div className="card p-5 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <MapPin size={15} /> GPS Location
          </p>
          <p className="text-sm text-gray-500 font-mono">
            {job.gps_lat?.toFixed(6)}, {job.gps_lng?.toFixed(6)}
          </p>
          <a
            href={`https://maps.google.com/?q=${job.gps_lat},${job.gps_lng}`}
            target="_blank" rel="noreferrer"
            className="text-xs font-medium mt-1 block" style={{ color: '#0a1628' }}>
            Open in Google Maps →
          </a>
        </div>
      )}

      {/* Notes */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <FileText size={15} /> Notes
          </p>
          {!editingNotes && (
            <button onClick={() => setEditingNotes(true)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700">
              <Edit3 size={13} /> Edit
            </button>
          )}
        </div>
        {editingNotes ? (
          <>
            <textarea value={notesVal} onChange={e => setNotesVal(e.target.value)} rows={4}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSaveNotes} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: '#0a1628' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
              </button>
              <button onClick={() => { setEditingNotes(false); setNotesVal(job.notes || ''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700">
                <X size={12} /> Cancel
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">{job.notes || 'No notes added yet.'}</p>
        )}
      </div>

      {/* Hidden icons usage */}
      <span className="hidden"><Map /><Droplets /><Camera /></span>
    </div>
  );
}
