/**
 * OSC Camera Service — RoomLensPro
 * 
 * Works with ANY camera implementing Google Open Spherical Camera (OSC) protocol:
 *   - Insta360 X4, X3, X5  →  IP: 192.168.42.1
 *   - Ricoh Theta Z1, X     →  IP: 192.168.1.1
 * 
 * Pure fetch() calls — zero native SDKs required.
 * Spec: https://developers.google.com/streetview/open-spherical-camera
 */

import { CAMERA_ENDPOINTS } from '../constants/app';
import { CameraState, OSCCommandResult } from '../types';

const OSC_HEADERS = {
  'Content-Type': 'application/json;charset=utf-8',
  'Accept': 'application/json',
  'X-XSRF-Protected': '1',
};

const TIMEOUT_MS = 10000;  // 10s for commands
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 30; // 30s max wait for capture

class OSCCameraService {
  private baseUrl: string = CAMERA_ENDPOINTS.insta360.baseUrl;
  private cameraType: 'insta360' | 'theta' = 'insta360';

  // ─── Connection ────────────────────────────────────────────────────────────

  setCameraType(type: 'insta360' | 'theta') {
    this.cameraType = type;
    this.baseUrl = type === 'insta360'
      ? CAMERA_ENDPOINTS.insta360.baseUrl
      : CAMERA_ENDPOINTS.theta.baseUrl;
  }

  async checkConnection(): Promise<{ connected: boolean; info?: Partial<CameraState>; error?: string }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${this.baseUrl}/osc/info`, {
        method: 'GET',
        headers: OSC_HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      return {
        connected: true,
        info: {
          model: data.model ?? 'Unknown Camera',
          connected: true,
          cameraType: this.cameraType,
          ip: this.baseUrl.replace('http://', ''),
        },
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { connected: false, error: 'Connection timeout — is the camera WiFi on?' };
      }
      return { connected: false, error: err.message ?? 'Camera not reachable' };
    }
  }

  async getCameraState(): Promise<{ batteryLevel?: number; remainingSpace?: number } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/osc/state`, {
        method: 'POST',
        headers: OSC_HEADERS,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      return {
        batteryLevel: Math.round((data.state?.batteryLevel ?? 0) * 100),
        remainingSpace: data.state?.remainingSpace,
      };
    } catch {
      return null;
    }
  }

  // ─── Camera Settings ───────────────────────────────────────────────────────

  async setPhotoMode(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/osc/commands/execute`, {
        method: 'POST',
        headers: OSC_HEADERS,
        body: JSON.stringify({
          name: 'camera.setOptions',
          parameters: {
            options: {
              captureMode: 'image',
              photoStitching: 'ondevice',   // Enable on-device stitching (equirectangular output)
            },
          },
        }),
      });
      const data = await res.json();
      return data.state === 'done';
    } catch {
      return false;
    }
  }

  // ─── Capture ───────────────────────────────────────────────────────────────

  async takePicture(): Promise<OSCCommandResult> {
    try {
      // Step 1: Set photo mode
      await this.setPhotoMode();

      // Step 2: Trigger capture
      const captureRes = await fetch(`${this.baseUrl}/osc/commands/execute`, {
        method: 'POST',
        headers: OSC_HEADERS,
        body: JSON.stringify({ name: 'camera.takePicture' }),
      });
      const captureData = await captureRes.json();

      if (captureData.state === 'error') {
        return {
          success: false,
          error: captureData.error?.message ?? 'Capture failed',
        };
      }

      const commandId = captureData.id;

      // Step 3: Poll for completion
      for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
        await sleep(POLL_INTERVAL_MS);

        const statusRes = await fetch(`${this.baseUrl}/osc/commands/status`, {
          method: 'POST',
          headers: OSC_HEADERS,
          body: JSON.stringify({ id: commandId }),
        });
        const statusData = await statusRes.json();

        if (statusData.state === 'done') {
          const fileUrl = statusData.results?.fileUrl;
          return { success: true, fileUrl, commandId };
        }

        if (statusData.state === 'error') {
          return {
            success: false,
            error: statusData.error?.message ?? 'Capture error',
          };
        }
        // state === 'inProgress' → keep polling
      }

      return { success: false, error: 'Capture timed out after 30 seconds' };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Unknown camera error' };
    }
  }

  // ─── Download ──────────────────────────────────────────────────────────────

  async downloadPhoto(fileUrl: string): Promise<{ success: boolean; blob?: Blob; error?: string }> {
    try {
      // fileUrl is already a full HTTP URL like http://192.168.42.1/DCIM/...
      const res = await fetch(fileUrl, { headers: OSC_HEADERS });
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
      const blob = await res.blob();
      return { success: true, blob };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ─── File List ─────────────────────────────────────────────────────────────

  async listFiles(count: number = 10): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/osc/commands/execute`, {
        method: 'POST',
        headers: OSC_HEADERS,
        body: JSON.stringify({
          name: 'camera.listFiles',
          parameters: {
            fileType: 'image',
            entryCount: count,
            maxThumbSize: 0,
          },
        }),
      });
      const data = await res.json();
      return (data.results?.entries ?? []).map((e: any) => e.fileUrl);
    } catch {
      return [];
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/osc/commands/execute`, {
        method: 'POST',
        headers: OSC_HEADERS,
        body: JSON.stringify({
          name: 'camera.delete',
          parameters: { fileUrls: [fileUrl] },
        }),
      });
      const data = await res.json();
      return data.state === 'done';
    } catch {
      return false;
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const oscCamera = new OSCCameraService();
export default oscCamera;
