'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { JobType, JOB_TYPE_LABELS, JOB_TYPE_ICONS } from '@/types';
import { MapPin, FileText, Loader2, ChevronLeft, Locate } from 'lucide-react';

const JOB_TYPES: JobType[] = ['water_loss', 'fire_loss', 'mold', 'large_loss', 'other'];

export default function NewJobPage() {
  const router = useRouter();
  const [uid, setUid] = useState('');
  const [address, setAddress] = useState('');
  const [jobType, setJobType] = useState<JobType>('water_loss');
  const [notes, setNotes] = useState('');
  const [gpsLat, setGpsLat] = useState('');
  const [gpsLng, setGpsLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) { router.push('/login'); return; }
      setUid(u.uid);
    });
    return unsub;
  }, [router]);

  const handleLocate = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLat(pos.coords.latitude.toFixed(6));
        setGpsLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => { setError('Could not get location.'); setLocating(false); }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) { setError('Property address is required.'); return; }
    setLoading(true); setError('');
    try {
      const ref = await addDoc(collection(db, 'jobs'), {
        user_id: uid,
        property_address: address.trim(),
        job_type: jobType,
        status: 'draft',
        notes: notes.trim() || null,
        gps_lat: gpsLat ? parseFloat(gpsLat) : null,
        gps_lng: gpsLng ? parseFloat(gpsLng) : null,
        created_at: serverTimestamp(),
      });
      router.push(`/jobs/${ref.id}`);
    } catch {
      setError('Failed to create job. Check Firebase configuration.');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ChevronLeft size={16} /> Back to Jobs
      </Link>

      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">New Job</h1>
      <p className="text-gray-500 text-sm mb-8">Create a restoration job to start documenting</p>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Property Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St, Calgary, AB"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* GPS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">GPS Coordinates (optional)</label>
          <div className="flex gap-3">
            <input
              type="number" step="any" value={gpsLat} onChange={e => setGpsLat(e.target.value)}
              placeholder="Latitude"
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number" step="any" value={gpsLng} onChange={e => setGpsLng(e.target.value)}
              placeholder="Longitude"
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="button" onClick={handleLocate} disabled={locating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              {locating ? <Loader2 size={14} className="animate-spin" /> : <Locate size={14} />}
              {locating ? '' : 'Auto'}
            </button>
          </div>
        </div>

        {/* Job type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {JOB_TYPES.map(t => (
              <button key={t} type="button" onClick={() => setJobType(t)}
                className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 text-xs font-medium transition-all ${jobType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                <span className="text-xl">{JOB_TYPE_ICONS[t]}</span>
                {JOB_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <span className="flex items-center gap-1.5"><FileText size={14} /> Notes (optional)</span>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Initial observations, site conditions, special instructions…"
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Link href="/jobs"
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold text-center hover:bg-gray-50 transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: '#0a1628' }}>
            {loading ? <><Loader2 size={15} className="animate-spin" /> Creating...</> : 'Create Job'}
          </button>
        </div>
      </form>
    </div>
  );
}
