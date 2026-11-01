'use client';

import React, { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft } from '@/components/ui/icons';
import type { Area as CropArea } from 'react-easy-crop';
import type { CropArea as CropBox } from '../types';

const Cropper = dynamic(() => import('react-easy-crop'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-950/30 p-6">
      <div className="h-full max-h-64 w-full max-w-64 animate-pulse rounded-3xl border border-white/15 bg-white/15" />
    </div>
  )
});

// crop selection to jpeg data url
async function cropToDataUrl(imageSrc: string, box: CropBox): Promise<string | null> {
  const image = new Image();
  image.src = imageSrc;
  if (!image.complete) {
    const { promise, resolve } = Promise.withResolvers<void>();
    image.addEventListener('load', () => resolve(), { once: true });
    await promise;
  }
  const canvas = document.createElement('canvas');
  canvas.width = box.width;
  canvas.height = box.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
  return canvas.toDataURL('image/jpeg');
}

interface CropDialogProps {
  image: string;
  closing: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => Promise<void> | void;
}

// client-side image crop modal
export function CropDialog({ image, closing, onClose, onSave }: CropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  const handleCropComplete = useCallback((_area: CropArea, pixels: CropArea) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    const dataUrl = await cropToDataUrl(image, croppedAreaPixels);
    if (dataUrl) await onSave(dataUrl);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-white p-4 sm:bg-slate-900/80"
      style={{ animation: `${closing ? 'settingsBackdropOut' : 'settingsBackdropIn'} 150ms ease-out both` }}
      onClick={event => { event.stopPropagation(); onClose(); }}
    >
      <div
        className="flex h-dvh w-full max-w-md flex-col overflow-hidden bg-white sm:h-[min(90dvh,680px)] sm:rounded-3xl sm:shadow-xl dark:bg-slate-900"
        style={{ animation: `${closing ? 'settingsPanelOut' : 'settingsPanelIn'} 180ms ease-out both` }}
        onClick={event => event.stopPropagation()}
      >
        <div className="relative shrink-0 px-4 pb-8 pt-4 text-center sm:border-b sm:border-slate-100 sm:pb-4 dark:sm:border-slate-700/60">
          <button onClick={onClose} className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#efeeee] text-black transition-transform active:scale-95 dark:bg-slate-800 dark:text-slate-200 sm:h-9 sm:w-9" aria-label="Close crop">
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <h3 className="flex h-10 items-center justify-center text-[28px] font-semibold leading-none text-black dark:text-slate-100 sm:h-9 sm:text-xl sm:font-bold sm:text-slate-800">Crop</h3>
          <p className="mt-10 text-[16px] font-medium text-[#777777] dark:text-slate-400 sm:mt-2 sm:text-sm">Pick the part of the photo you want to keep.</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 no-scrollbar sm:px-5">
          <div className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-[24px] bg-slate-950 shadow-[0_28px_80px_rgba(15,23,42,0.16)] sm:max-w-[420px]">
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              rotation={0}
              aspect={1}
              minZoom={1}
              maxZoom={3}
              zoomSpeed={1}
              cropShape="round"
              showGrid
              restrictPosition
              keyboardStep={1}
              style={{
                containerStyle: { background: '#0f172a' },
                cropAreaStyle: { border: '2px solid rgba(255,255,255,0.92)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.28)' }
              }}
              classes={{}}
              mediaProps={{}}
              cropperProps={{}}
              onCropChange={setCrop}
              onCropComplete={handleCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="mx-auto mt-9 max-w-[360px] sm:max-w-[420px]">
            <p className="mb-3 text-center text-[18px] font-medium text-black dark:text-slate-100">{zoom.toFixed(1)}x</p>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.05}
              aria-label="Zoom"
              onChange={event => setZoom(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-black dark:bg-slate-700"
            />
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-4 px-4 pb-8 pt-3 sm:border-t sm:border-slate-100 sm:p-5 dark:sm:border-slate-700/60">
          <button onClick={onClose} className="h-[54px] rounded-[16px] border border-slate-200 bg-white text-[16px] font-semibold text-black shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="h-[54px] rounded-[16px] bg-[#181818] text-[16px] font-semibold text-white shadow-sm transition-colors hover:bg-black dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
