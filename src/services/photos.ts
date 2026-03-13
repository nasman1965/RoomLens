// ─────────────────────────────────────────────────────────────────────────────
// Photos service — Supabase Storage (job-photos bucket) + job_photos table
// Same bucket & table as the web dashboard
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

export interface Photo {
  id: string;
  job_id: string;
  photo_url: string;
  room_tag: string | null;
  damage_tag: string | null;
  area: string | null;
  timestamp: string;
  signedUrl?: string;
}

const BUCKET = 'job-photos';
const TABLE  = 'job_photos';

export const photosService = {

  /** Get all photos for a job with signed URLs */
  async getPhotos(jobId: string): Promise<{ photos: Photo[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('job_id', jobId)
        .order('timestamp', { ascending: false });

      if (error) return { photos: [], error: error.message };

      const photos = await Promise.all((data ?? []).map(async (p) => {
        if (p.photo_url?.startsWith('http')) return { ...p, signedUrl: p.photo_url };
        try {
          const { data: s } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(p.photo_url, 3600);
          return { ...p, signedUrl: s?.signedUrl ?? p.photo_url };
        } catch {
          return { ...p, signedUrl: p.photo_url };
        }
      }));

      return { photos, error: null };
    } catch (err: any) {
      return { photos: [], error: err?.message ?? 'Failed to load photos' };
    }
  },

  /** Upload a photo from a local URI to Supabase storage */
  async uploadPhoto(
    jobId: string,
    userId: string,
    uri: string,
    roomTag?: string,
    damageTag?: string,
    area?: string,
  ): Promise<{ photo: Photo | null; error: string | null }> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      const uriLower = uri.toLowerCase();
      let ext = 'jpg';
      if (uriLower.includes('.png'))  ext = 'png';
      if (uriLower.includes('.webp')) ext = 'webp';
      if (uriLower.includes('.heic')) ext = 'heic';
      if (uriLower.includes('.heif')) ext = 'heif';

      const path = `${userId}/${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType, upsert: false });

      if (storageErr) return { photo: null, error: storageErr.message };

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);

      const payload: Record<string, any> = {
        job_id:        jobId,
        photo_url:     publicUrl,
        technician_id: userId,
      };
      if (roomTag)   payload.room_tag   = roomTag;
      if (damageTag) payload.damage_tag = damageTag;
      if (area)      payload.area       = area;

      const { data: rec, error: dbErr } = await supabase
        .from(TABLE)
        .insert(payload)
        .select()
        .single();

      if (dbErr) return { photo: null, error: dbErr.message };

      return {
        photo: { ...rec, signedUrl: signed?.signedUrl ?? publicUrl },
        error: null,
      };
    } catch (err: any) {
      return { photo: null, error: err?.message ?? 'Upload failed' };
    }
  },

  /** Delete a photo from storage and database */
  async deletePhoto(photo: Photo): Promise<{ error: string | null }> {
    try {
      const path = extractPath(photo.photo_url);
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      await supabase.from(TABLE).delete().eq('id', photo.id);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message ?? 'Delete failed' };
    }
  },
};

function extractPath(url: string): string | null {
  try {
    const patterns = [
      /\/object\/(?:public|authenticated|sign)\/job-photos\/(.+?)(?:\?|$)/,
      /\/job-photos\/(.+?)(?:\?|$)/,
    ];
    for (const re of patterns) {
      const m = url.match(re);
      if (m) return decodeURIComponent(m[1]);
    }
    return null;
  } catch { return null; }
}
