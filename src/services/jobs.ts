import { supabase } from './supabase';
import { Job } from '../types';
import { JobType } from '../constants/app';

export const jobsService = {

  async createJob(params: {
    userId: string;
    address: string;
    jobType: JobType;
    notes?: string;
    gpsLat?: number;
    gpsLng?: number;
  }): Promise<{ job?: Job; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          user_id: params.userId,
          property_address: params.address,
          job_type: params.jobType,
          notes: params.notes ?? null,
          gps_lat: params.gpsLat ?? null,
          gps_lng: params.gpsLng ?? null,
          status: 'active',
        })
        .select()
        .single();

      if (error) return { error: error.message };
      return { job: data as Job };
    } catch (err: any) {
      return { error: err.message ?? 'Failed to create job' };
    }
  },

  async getJobs(userId: string, limit: number = 20): Promise<{ jobs?: Job[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return { error: error.message };
      return { jobs: data as Job[] };
    } catch (err: any) {
      return { error: err.message ?? 'Failed to fetch jobs' };
    }
  },

  async getJob(id: string): Promise<{ job?: Job; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return { error: error.message };
      return { job: data as Job };
    } catch (err: any) {
      return { error: err.message ?? 'Failed to fetch job' };
    }
  },

  async updateJobStatus(id: string, status: Job['status']): Promise<{ error?: string }> {
    const { error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', id);
    return { error: error?.message };
  },

  async updateJob(id: string, updates: Partial<Job>): Promise<{ error?: string }> {
    const { error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', id);
    return { error: error?.message };
  },

  async deleteJob(id: string): Promise<{ error?: string }> {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', id);
    return { error: error?.message };
  },
};
