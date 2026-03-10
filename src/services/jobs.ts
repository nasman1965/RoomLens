// ─────────────────────────────────────────────────────────────────────────────
// Jobs service — Supabase
// Reads/writes the same 'jobs' table as the web app
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';
import type { Job } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

function rowToJob(row: any): Job {
  return {
    id:               row.id,
    user_id:          row.user_id,
    insured_name:     row.insured_name ?? '',
    property_address: row.property_address ?? '',
    property_city:    row.property_city ?? '',
    claim_number:     row.claim_number ?? '',
    insurer_name:     row.insurer_name ?? '',
    job_type:         row.job_type ?? 'water_loss',
    status:           row.status ?? 'new',
    current_step:     row.current_step ?? 1,
    lead_source:      row.lead_source ?? 'manual',
    stopped:          row.stopped ?? false,
    stop_reason:      row.stop_reason ?? null,
    stop_notes:       row.stop_notes ?? null,
    stopped_at:       row.stopped_at ?? null,
    stopped_by:       row.stopped_by ?? null,
    override_active:  row.override_active ?? false,
    created_at:       row.created_at ?? new Date().toISOString(),
    updated_at:       row.updated_at ?? new Date().toISOString(),
  };
}

// ── jobsService ───────────────────────────────────────────────────────────────

export const jobsService = {
  /** Fetch all jobs for the current user */
  async getJobs(): Promise<{ jobs: Job[]; error: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { jobs: [], error: 'Not authenticated' };

      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) return { jobs: [], error: error.message };
      return { jobs: (data ?? []).map(rowToJob), error: null };
    } catch (err: any) {
      return { jobs: [], error: err?.message ?? 'Failed to load jobs' };
    }
  },

  /** Fetch a single job by ID */
  async getJob(id: string): Promise<{ job: Job | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return { job: null, error: error.message };
      return { job: rowToJob(data), error: null };
    } catch (err: any) {
      return { job: null, error: err?.message ?? 'Failed to load job' };
    }
  },

  /** Create a new job */
  async createJob(jobData: Partial<Job>): Promise<{ job: Job | null; error: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { job: null, error: 'Not authenticated' };

      const { data, error } = await supabase
        .from('jobs')
        .insert({ ...jobData, user_id: user.id })
        .select()
        .single();

      if (error) return { job: null, error: error.message };
      return { job: rowToJob(data), error: null };
    } catch (err: any) {
      return { job: null, error: err?.message ?? 'Failed to create job' };
    }
  },

  /** Update a job */
  async updateJob(id: string, updates: Partial<Job>): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err?.message ?? 'Failed to update job' };
    }
  },

  /** Stop a job */
  async stopJob(
    id: string,
    reason: string,
    notes: string,
    stoppedBy: string,
  ): Promise<{ error: string | null }> {
    return jobsService.updateJob(id, {
      stopped: true,
      stop_reason: reason,
      stop_notes: notes || null,
      stopped_at: new Date().toISOString(),
      stopped_by: stoppedBy,
      status: 'stopped' as any,
    });
  },

  /** Override (re-activate) a stopped job */
  async overrideJob(
    id: string,
    reason: string,
    overrideBy: string,
  ): Promise<{ error: string | null }> {
    return jobsService.updateJob(id, {
      stopped: false,
      override_active: true,
      override_reason: reason,
      override_by: overrideBy,
      override_at: new Date().toISOString(),
      status: 'active' as any,
    });
  },
};
