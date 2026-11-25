'use client';

const loadImageElement = (src: string, crossOrigin?: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error(`Failed to encode image as ${mimeType}`));
      },
      mimeType,
      quality
    );
  });

const stripExtension = (name: string): string => name.replace(/\.[^.]+$/, '') || 'image';

/**
 * Converts an uploaded File/Blob or data URL into WebP on the client device
 * before sending it to CDN storage.
 */
export const convertImageToWebp = async (
  input: File | Blob | string,
  options?: { fileName?: string; quality?: number; maxDimension?: number }
): Promise<{ file: File; width: number; height: number }> => {
  const quality = options?.quality ?? 0.88;
  const maxDimension = options?.maxDimension ?? 2048;

  let objectUrl: string | null = null;
  let src: string;
  let baseName = options?.fileName ? stripExtension(options.fileName) : 'image';

  if (typeof input === 'string') {
    src = input;
  } else {
    if (input instanceof File && input.name) {
      baseName = stripExtension(input.name);
    }
    objectUrl = URL.createObjectURL(input);
    src = objectUrl;
  }

  try {
    const img = await loadImageElement(src);
    let width = img.naturalWidth || img.width || 1;
    let height = img.naturalHeight || img.height || 1;

    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0, width, height);

    const webpBlob = await canvasToBlob(canvas, 'image/webp', quality);
    const file = new File([webpBlob], `${baseName}.webp`, { type: 'image/webp' });
    return { file, width, height };
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
};

/**
 * Downloads a CDN/remote image and converts it to PNG on the user's device.
 */
export const downloadImageAsPng = async (
  url: string,
  fileName = 'deepchat-image'
): Promise<void> => {
  const baseName = stripExtension(fileName);
  let objectUrl: string | null = null;

  try {
    let img: HTMLImageElement;
    if (url.startsWith('data:')) {
      img = await loadImageElement(url);
    } else {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      img = await loadImageElement(objectUrl);
    }

    const width = img.naturalWidth || img.width || 1;
    const height = img.naturalHeight || img.height || 1;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0, width, height);

    const pngBlob = await canvasToBlob(canvas, 'image/png');
    const downloadUrl = URL.createObjectURL(pngBlob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `${baseName}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
  } catch {
    // Fallback if remote host blocks CORS fetch
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${baseName}.png`;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
};
