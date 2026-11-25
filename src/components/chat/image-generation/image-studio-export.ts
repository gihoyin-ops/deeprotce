import { type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';

export type ImageStudioMode = 'view' | 'edit' | 'annotate' | 'resize' | 'remove';

export interface EditPin {
  id: string;
  x: number; // normalized 0..1 relative to image width
  y: number; // normalized 0..1 relative to image height
  note: string;
}

export interface StrokePoint {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
}

export interface AnnotationStroke {
  id: string;
  kind: 'draw' | 'mask' | 'erase';
  color: string;
  size: number; // normalized relative to min(width, height)
  points: StrokePoint[];
}

export interface ImageStudioEditRequest {
  mode: 'edit' | 'annotate' | 'resize' | 'remove';
  userDisplayText: string;
  modelPrompt: string;
  aspectRatio: ImageAspectRatio;
  sourceImageDataUrl: string;
  maskDataUrl?: string;
  annotatedDataUrl?: string;
  thumbnailDataUrl?: string;
}

export interface ExportedCanvasPng {
  dataUrl: string;
  width: number;
  height: number;
}

const MAX_EXPORT_PNG_BYTES = 3_000_000;

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const body = commaIdx === -1 ? dataUrl : dataUrl.slice(commaIdx + 1);
  return Math.ceil((body.length * 3) / 4);
}

export function getExportDimensions(
  natWidth: number,
  natHeight: number,
  maxSide = 1280
): { width: number; height: number } {
  const safeW = Math.max(1, natWidth || 1024);
  const safeH = Math.max(1, natHeight || 1024);
  const largest = Math.max(safeW, safeH);
  if (largest <= maxSide) {
    return { width: Math.round(safeW), height: Math.round(safeH) };
  }
  const scale = maxSide / largest;
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

export async function loadImageForCanvas(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (/^https?:\/\// i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.decoding = 'async';
    img.onload = () => {
      if (typeof img.decode === 'function') {
        void img
          .decode()
          .catch(() => undefined)
          .then(() => resolve(img));
      } else {
        resolve(img);
      }
    };
    img.onerror = () => {
      reject(new Error('Could not load image into studio canvas.'));
    };
    img.src = src;
  });
}

export function drawStrokePolyline(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  width: number,
  height: number,
  lineWidth: number,
  fillMode = false
) {
  if (points.length === 0) return;

  if (points.length === 1) {
    const px = points[0].x * width;
    const py = points[0].y * height;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1, lineWidth / 2), 0, Math.PI * 2);
    if (fillMode) {
      ctx.fill();
    } else {
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
    return;
  }

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x * width, points[0].y * height);

  if (points.length === 2) {
    ctx.lineTo(points[1].x * width, points[1].y * height);
  } else {
    for (let i = 1; i < points.length - 1; i += 1) {
      const midX = ((points[i].x + points[i + 1].x) * 0.5) * width;
      const midY = ((points[i].y + points[i + 1].y) * 0.5) * height;
      ctx.quadraticCurveTo(points[i].x * width, points[i].y * height, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x * width, last.y * height);
  }

  ctx.stroke();
}

export function exportCleanSourcePng(
  img: HTMLImageElement,
  initialMaxSide = 1280
): ExportedCanvasPng {
  const candidates = [initialMaxSide, 960, 768];
  let lastResult: ExportedCanvasPng = { dataUrl: '', width: 1, height: 1 };

  for (const maxSide of candidates) {
    const { width, height } = getExportDimensions(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      maxSide
    );
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(img, 0, 0, width, height);
    lastResult = {
      dataUrl: canvas.toDataURL('image/png'),
      width,
      height,
    };
    if (estimateDataUrlBytes(lastResult.dataUrl) <= MAX_EXPORT_PNG_BYTES) {
      return lastResult;
    }
  }

  return lastResult;
}

export function exportCompactThumbnailJpeg(
  img: HTMLImageElement,
  maxSide = 220
): string {
  const { width, height } = getExportDimensions(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    maxSide
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

/**
 * Generates an OpenAI-compatible RGBA PNG mask where transparent pixels (alpha = 0)
 * indicate the regions to edit or remove, and opaque pixels (alpha = 255) are preserved
 */
export function exportOpenAiAlphaMaskPng(
  width: number,
  height: number,
  strokes: AnnotationStroke[]
): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const minDim = Math.min(canvas.width, canvas.height);

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    const lineWidth = Math.max(4, stroke.size * minDim);

    if (stroke.kind === 'mask') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      ctx.shadowColor = 'rgba(0, 0, 0, 1)';
      ctx.shadowBlur = Math.max(2, lineWidth * 0.14);
      drawStrokePolyline(ctx, stroke.points, canvas.width, canvas.height, lineWidth, true);
      ctx.restore();
    } else if (stroke.kind === 'erase') {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      drawStrokePolyline(ctx, stroke.points, canvas.width, canvas.height, lineWidth, true);
      ctx.restore();
    }
  }

  return canvas.toDataURL('image/png');
}

export function exportAnnotatedCompositePng(
  img: HTMLImageElement,
  strokes: AnnotationStroke[],
  initialMaxSide = 1280,
  includeMaskTint = false
): ExportedCanvasPng {
  const candidates = [initialMaxSide, 960, 768];
  let lastResult: ExportedCanvasPng = { dataUrl: '', width: 1, height: 1 };

  for (const maxSide of candidates) {
    const { width, height } = getExportDimensions(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      maxSide
    );
    const minDim = Math.min(width, height);

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = width;
    baseCanvas.height = height;
    const baseCtx = baseCanvas.getContext('2d');
    if (!baseCtx) throw new Error('Canvas 2D context unavailable.');
    baseCtx.drawImage(img, 0, 0, width, height);

    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    const overlayCtx = overlayCanvas.getContext('2d');
    if (overlayCtx) {
      for (const stroke of strokes) {
        if (stroke.points.length === 0) continue;
        const lineWidth = Math.max(3, stroke.size * minDim);

        if (stroke.kind === 'erase') {
          overlayCtx.save();
          overlayCtx.globalCompositeOperation = 'destination-out';
          overlayCtx.strokeStyle = '#000000';
          overlayCtx.fillStyle = '#000000';
          drawStrokePolyline(overlayCtx, stroke.points, width, height, lineWidth, true);
          overlayCtx.restore();
        } else if (stroke.kind === 'draw') {
          overlayCtx.save();
          overlayCtx.globalCompositeOperation = 'source-over';
          overlayCtx.strokeStyle = stroke.color;
          overlayCtx.fillStyle = stroke.color;
          drawStrokePolyline(overlayCtx, stroke.points, width, height, lineWidth, true);
          overlayCtx.restore();
        } else if (includeMaskTint && stroke.kind === 'mask') {
          overlayCtx.save();
          overlayCtx.globalCompositeOperation = 'source-over';
          overlayCtx.globalAlpha = 0.36;
          overlayCtx.strokeStyle = '#e28666';
          overlayCtx.fillStyle = '#e28666';
          drawStrokePolyline(overlayCtx, stroke.points, width, height, lineWidth, true);
          overlayCtx.restore();
        }
      }

      baseCtx.drawImage(overlayCanvas, 0, 0);
    }

    lastResult = {
      dataUrl: baseCanvas.toDataURL('image/png'),
      width,
      height,
    };
    if (estimateDataUrlBytes(lastResult.dataUrl) <= MAX_EXPORT_PNG_BYTES) {
      return lastResult;
    }
  }

  return lastResult;
}

function describeNormalizedPosition(x: number, y: number): string {
  const vertical = y < 0.34 ? 'upper' : y > 0.66 ? 'lower' : 'middle';
  const horizontal = x < 0.34 ? 'left' : x > 0.66 ? 'right' : 'center';
  if (vertical === 'middle' && horizontal === 'center') return 'center';
  return `${vertical}-${horizontal}`;
}

export function buildSpatialPinPrompt(pins: EditPin[], generalPrompt: string): string {
  const activePins = pins
    .map((pin, idx) => ({ ...pin, num: idx + 1, trimmed: pin.note.trim() }))
    .filter((pin) => pin.trimmed.length > 0);

  const lines: string[] = [];

  if (activePins.length > 0) {
    lines.push('Apply the following targeted visual edits while preserving the rest of the image naturally:');
    for (const pin of activePins) {
      const px = Math.round(pin.x * 100);
      const py = Math.round(pin.y * 100);
      const region = describeNormalizedPosition(pin.x, pin.y);
      lines.push(`${pin.num}. Point ${pin.num} (${region}, ${px}% from left, ${py}% from top): ${pin.trimmed}`);
    }
  }

  const cleanGeneral = generalPrompt.trim();
  if (cleanGeneral) {
    if (lines.length > 0) {
      lines.push(`Additional overall instruction: ${cleanGeneral}`);
    } else {
      lines.push(cleanGeneral);
    }
  }

  return lines.join('\n');
}

function getExtensionFromSrc(src: string): string {
  const dataMatch = src.match(/^data:image\/([a-z0-9.+-]+)/i);
  if (dataMatch) {
    return dataMatch[1].toLowerCase().replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  }
  const pathMatch = src.split('?')[0]?.match(/\.([a-z0-9]+)$/i);
  if (pathMatch) {
    return pathMatch[1].toLowerCase();
  }
  return 'png';
}

export function downloadImageSrc(src: string, index = 0) {
  const ext = getExtensionFromSrc(src);
  const filename = `deepchat-image-${index + 1}.${ext}`;

  if (src.startsWith('data:')) {
    try {
      const commaIdx = src.indexOf(',');
      const header = src.slice(0, commaIdx);
      const body = src.slice(commaIdx + 1);
      const mimeMatch = header.match(/^data:([^;]+)/i);
      const mime = mimeMatch?.[1] || 'image/png';
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1200);
      return;
    } catch {
      // Fall through to direct link
    }
  }

  const link = document.createElement('a');
  link.href = src;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
