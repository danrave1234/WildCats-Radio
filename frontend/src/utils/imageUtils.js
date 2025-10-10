/**
 * Image utilities: optional downscale and encode with minimal quality loss.
 * - Only resize if the longest edge exceeds MAX_DIMENSION.
 * - For JPEG/WebP: encode at high quality (0.92) to balance quality/size.
 * - For PNG/GIF: return original Blob (avoid lossy conversion/animation loss).
 */

export const MAX_DIMENSION = 2560; // px
export const JPEG_QUALITY = 0.92;

/**
 * Determine whether to process the file in a canvas pipeline.
 */
export function shouldProcessInCanvas(file) {
  const type = file.type?.toLowerCase() || '';
  if (!type.startsWith('image/')) return false;
  // Never process GIFs to avoid breaking animations
  if (type === 'image/gif') return false;
  // Process JPEG/PNG/WebP via canvas when needed
  return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp';
}

/**
 * Load an image from a File/Blob to HTMLImageElement
 */
function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * Downscale and encode an image file if it is larger than MAX_DIMENSION.
 * Returns a Blob and contentType to upload.
 */
export async function maybeDownscaleAndEncode(file) {
  if (!shouldProcessInCanvas(file)) {
    // Return original without changes
    return { blob: file, contentType: file.type || 'application/octet-stream', suggestedExtension: getExtFromType(file.type) };
  }

  const img = await loadImageFromBlob(file);
  const { width, height } = img;

  let targetW = width;
  let targetH = height;

  const longest = Math.max(width, height);
  if (longest > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longest;
    targetW = Math.round(width * scale);
    targetH = Math.round(height * scale);
  }

  // Choose output type: keep JPEG as JPEG; keep WebP as WebP; keep PNG as PNG unless downscaling
  let outputType = file.type || 'image/jpeg';
  if (outputType !== 'image/png' && outputType !== 'image/webp' && outputType !== 'image/jpeg') {
    outputType = 'image/jpeg';
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const quality = outputType === 'image/jpeg' || outputType === 'image/webp' ? JPEG_QUALITY : 1.0;

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, outputType, quality));

  // If canvas.toBlob failed or produced a larger blob, fallback to original file
  if (!blob || blob.size >= file.size) {
    return { blob: file, contentType: file.type || 'application/octet-stream', suggestedExtension: getExtFromType(file.type) };
  }

  return { blob, contentType: outputType, suggestedExtension: getExtFromType(outputType) };
}

export function getExtFromType(type) {
  switch ((type || '').toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}
