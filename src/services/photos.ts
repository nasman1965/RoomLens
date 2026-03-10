// ─────────────────────────────────────────────────────────────────────────────
// Photos service — Supabase Storage + damage_photos table
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

export interface Photo {
  id: string;
  job_id: string;
  photo_url: string;
  room_tag: string | null;
  damage_tag: string | null;
  timestamp: string;
  signedUrl?: string;
}

export const photosService = {
  /** Get all photos for a job with signed URLs */
  async getPhotos(jobId: string): Promise<{ photos: Photo[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('damage_photos')
        .select('*')
        .eq('job_id', jobId)
        .order('timestamp', { ascending: false });

      if (error) return { photos: [], error: error.message };

      const photos = await Promise.all((data ?? []).map(async (p) => {
        const path = extractPath(p.photo_url);
        if (!path) return { ...p, signedUrl: p.photo_url };
        const { data: s } = await supabase.storage
          .from('damage-photos')
          .createSignedUrl(path, 3600);
        return { ...p, signedUrl: s?.signedUrl ?? p.photo_url };
      }));

      return { photos, error: null };
    } catch (err: any) {
      return { photos: [], error: err?.message ?? 'Failed to load photos' };
    }
  },

  /** Upload a photo from URI to Supabase storage */
  async uploadPhoto(
    jobId: string,
    userId: string,
    uri: string,
    roomTag?: string,
    damageTag?: string,
  ): Promise<{ photo: Photo | null; error: string | null }> {
    try {
      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Upload to storage
      const { error: storageErr } = await supabase.storage
        .from('damage-photos')
        .upload(path, blob, { contentType: `image/${ext}`, upsert: false });

      if (storageErr) return { photo: null, error: storageErr.message };

      // Get public URL (stored in DB)
      const { data: { publicUrl } } = supabase.storage
        .from('damage-photos')
        .getPublicUrl(path);

      // Get signed URL (for display)
      const { data: signed } = await supabase.storage
        .from('damage-photos')
        .createSignedUrl(path, 3600);

      // Insert record
      const payload: Record<string, any> = {
        job_id: jobId,
        photo_url: publicUrl,
        technician_id: userId,
      };
      if (roomTag)   payload.room_tag   = roomTag;
      if (damageTag) payload.damage_tag = damageTag;

      const { data: rec, error: dbErr } = await supabase
        .from('damage_photos')
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

  /** Delete a photo */
  async deletePhoto(photo: Photo): Promise<{ error: string | null }> {
    try {
      const path = extractPath(photo.photo_url);
      if (path) await supabase.storage.from('damage-photos').remove([path]);
      await supabase.from('damage_photos').delete().eq('id', photo.id);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message ?? 'Delete failed' };
    }
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function extractPath(url: string): string | null {
  try {
    const patterns = [
      /\/object\/(?:public|authenticated|sign)\/damage-photos\/(.+?)(?:\?|$)/,
      /\/damage-photos\/(.+?)(?:\?|$)/,
    ];
    for (const re of patterns) {
      const m = url.match(re);
      if (m) return decodeURIComponent(m[1]);
    }
    return null;
  } catch { return null; }
}
