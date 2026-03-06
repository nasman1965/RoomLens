// ─────────────────────────────────────────────────────────────────────────────
// Jobs service — Firestore
// Collection: jobs/{jobId}  (scoped per user via userId field)
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './firebase';
import type { Job } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

function assertAuth(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

/** Convert a Firestore doc snapshot to our Job type */
function docToJob(id: string, data: Record<string, any>): Job {
  return {
    id,
    user_id:          data.user_id ?? '',
    property_address: data.property_address ?? '',
    gps_lat:          data.gps_lat ?? undefined,
    gps_lng:          data.gps_lng ?? undefined,
    job_type:         data.job_type ?? 'water_loss',
    status:           data.status ?? 'draft',
    notes:            data.notes ?? undefined,
    created_at:       data.created_at instanceof Timestamp
                        ? data.created_at.toDate().toISOString()
                        : (data.created_at ?? new Date().toISOString()),
  };
}

// ── jobsService ───────────────────────────────────────────────────────────────

export const jobsService = {
  /** Create a new job for the current user */
  async createJob(
    jobData: Pick<Job, 'property_address' | 'job_type' | 'notes' | 'gps_lat' | 'gps_lng'>,
  ): Promise<{ job: Job | null; error: string | null }> {
    try {
      const userId = assertAuth();
      const payload = {
        user_id:          userId,
        property_address: jobData.property_address,
        job_type:         jobData.job_type,
        status:           'draft' as const,
        notes:            jobData.notes ?? null,
        gps_lat:          jobData.gps_lat ?? null,
        gps_lng:          jobData.gps_lng ?? null,
        created_at:       serverTimestamp(),
      };
      const ref  = await addDoc(collection(db, 'jobs'), payload);
      const snap = await getDoc(ref);
      const job  = docToJob(ref.id, snap.data() ?? {});
      return { job, error: null };
    } catch (err: any) {
      return { job: null, error: err?.message ?? 'Failed to create job' };
    }
  },

  /** Get all jobs for the current user, sorted newest first */
  async getJobs(): Promise<{ jobs: Job[]; error: string | null }> {
    try {
      const userId = assertAuth();
      const q = query(
        collection(db, 'jobs'),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc'),
      );
      const snap = await getDocs(q);
      const jobs = snap.docs.map((d) => docToJob(d.id, d.data()));
      return { jobs, error: null };
    } catch (err: any) {
      return { jobs: [], error: err?.message ?? 'Failed to fetch jobs' };
    }
  },

  /** Get a single job by ID */
  async getJob(jobId: string): Promise<{ job: Job | null; error: string | null }> {
    try {
      const snap = await getDoc(doc(db, 'jobs', jobId));
      if (!snap.exists()) return { job: null, error: 'Job not found' };
      return { job: docToJob(snap.id, snap.data()), error: null };
    } catch (err: any) {
      return { job: null, error: err?.message ?? 'Failed to fetch job' };
    }
  },

  /** Update job status */
  async updateJobStatus(
    jobId: string,
    status: Job['status'],
  ): Promise<{ error: string | null }> {
    try {
      await updateDoc(doc(db, 'jobs', jobId), { status });
      return { error: null };
    } catch (err: any) {
      return { error: err?.message ?? 'Failed to update status' };
    }
  },

  /** Update any job fields */
  async updateJob(
    jobId: string,
    updates: Partial<Omit<Job, 'id' | 'user_id' | 'created_at'>>,
  ): Promise<{ error: string | null }> {
    try {
      await updateDoc(doc(db, 'jobs', jobId), updates as any);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message ?? 'Failed to update job' };
    }
  },

  /** Delete a job */
  async deleteJob(jobId: string): Promise<{ error: string | null }> {
    try {
      await deleteDoc(doc(db, 'jobs', jobId));
      return { error: null };
    } catch (err: any) {
      return { error: err?.message ?? 'Failed to delete job' };
    }
  },
};
