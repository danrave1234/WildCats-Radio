import { api } from './api/apiBase';
import { configUtils } from '../config';

const SIGNED_URL_API = configUtils.getApiUrl('/api/announcements/image/upload-url');

// Maximum allowed upload size AFTER optional compression (bytes)
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// Allowed content types
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

/**
 * Request a V4 signed URL for uploading an announcement image to GCS.
 * The backend returns: { uploadUrl, publicUrl, objectName, expiresAt, requiredContentType }
 */
export async function requestAnnouncementImageUploadUrl(fileName, contentType) {
  const { data } = await api.post(
    '/api/announcements/image/upload-url',
    { fileName, contentType },
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
  return data;
}

/**
 * PUT the bytes directly to the given signed URL.
 * Use XHR to get upload progress events.
 */
export function putToSignedUrl({ uploadUrl, blob, contentType, onProgress }) {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      // Only set the Content-Type header as required by the signed URL
      if (contentType) {
        xhr.setRequestHeader('Content-Type', contentType);
      }
      // Never send credentials to GCS for signed URL PUT
      xhr.withCredentials = false;

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && typeof onProgress === 'function') {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          onProgress({ loaded: evt.loaded, total: evt.total, percent });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`GCS upload failed with status ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during GCS upload'));
      xhr.send(blob);
    } catch (e) {
      reject(e);
    }
  });
}
