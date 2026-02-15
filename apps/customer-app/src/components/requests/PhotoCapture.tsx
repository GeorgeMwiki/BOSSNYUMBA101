'use client';

import { useCallback, useRef } from 'react';
import { Camera, X, ImageIcon } from 'lucide-react';

export interface PhotoPreview {
  id: string;
  url: string;
  file?: File;
}

interface PhotoCaptureProps {
  photos: PhotoPreview[];
  onChange: (photos: PhotoPreview[]) => void;
  maxPhotos?: number;
}

export function PhotoCapture({
  photos,
  onChange,
  maxPhotos = 5,
}: PhotoCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || photos.length >= maxPhotos) return;

      const newPhotos: PhotoPreview[] = [];
      const remaining = maxPhotos - photos.length;

      for (let i = 0; i < Math.min(files.length, remaining); i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const url = URL.createObjectURL(file);
        newPhotos.push({
          id: `photo-${Date.now()}-${i}`,
          url,
          file,
        });
      }

      onChange([...photos, ...newPhotos]);
    },
    [photos, maxPhotos, onChange]
  );

  const handleRemove = useCallback(
    (id: string) => {
      const removed = photos.find((p) => p.id === id);
      if (removed?.url.startsWith('blob:')) {
        URL.revokeObjectURL(removed.url);
      }
      onChange(photos.filter((p) => p.id !== id));
    },
    [photos, onChange]
  );

  const openCamera = () => cameraRef.current?.click();
  const openGallery = () => galleryRef.current?.click();

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 group"
          >
            <img
              src={photo.url}
              alt="Upload"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(photo.id)}
              className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {photos.length < maxPhotos && (
          <>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                handleFileSelect(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFileSelect(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={openCamera}
                className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500 transition-colors"
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs mt-1">Camera</span>
              </button>
              <button
                type="button"
                onClick={openGallery}
                className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500 transition-colors"
              >
                <ImageIcon className="w-6 h-6" />
                <span className="text-xs mt-1">Gallery</span>
              </button>
            </div>
          </>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {photos.length}/{maxPhotos} photos • Add up to {maxPhotos} photos
      </p>
    </div>
  );
}
