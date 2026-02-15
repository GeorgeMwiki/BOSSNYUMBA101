'use client';

import { useCallback, useState } from 'react';
import { Camera, X, Upload } from 'lucide-react';

export interface AttachmentPreview {
  id: string;
  url: string;
  filename: string;
  type: 'image' | 'video' | 'document';
}

interface AttachmentUploadProps {
  value?: AttachmentPreview[];
  onChange?: (attachments: AttachmentPreview[]) => void;
  maxFiles?: number;
  accept?: string;
  /** Label for the upload area */
  label?: string;
}

export function AttachmentUpload({
  value = [],
  onChange,
  maxFiles = 5,
  accept = 'image/*',
  label = 'Add photos',
}: AttachmentUploadProps) {
  const [attachments, setAttachments] = useState<AttachmentPreview[]>(value);
  const [isDragging, setIsDragging] = useState(false);

  const updateAttachments = useCallback(
    (newAttachments: AttachmentPreview[]) => {
      setAttachments(newAttachments);
      onChange?.(newAttachments);
    },
    [onChange]
  );

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || attachments.length >= maxFiles) return;
      const newFiles: AttachmentPreview[] = [];
      for (let i = 0; i < Math.min(files.length, maxFiles - attachments.length); i++) {
        const file = files[i];
        const url = URL.createObjectURL(file);
        newFiles.push({
          id: `preview-${Date.now()}-${i}`,
          url,
          filename: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'document',
        });
      }
      updateAttachments([...attachments, ...newFiles]);
    },
    [attachments, maxFiles, updateAttachments]
  );

  const handleRemove = useCallback(
    (id: string) => {
      const removed = attachments.find((a) => a.id === id);
      if (removed?.url.startsWith('blob:')) {
        URL.revokeObjectURL(removed.url);
      }
      updateAttachments(attachments.filter((a) => a.id !== id));
    },
    [attachments, updateAttachments]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {attachments.map((att) => (
          <div
            key={att.id}
            className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 group"
          >
            {att.type === 'image' ? (
              <img
                src={att.url}
                alt={att.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <button
              type="button"
              onClick={() => handleRemove(att.id)}
              className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {attachments.length < maxFiles && (
          <label
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <input
              type="file"
              accept={accept}
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <Camera className="w-6 h-6 text-gray-400 mb-1" />
            <span className="text-[10px] text-gray-500">{label}</span>
          </label>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {attachments.length}/{maxFiles} photos • Tap to add from camera or gallery
      </p>
    </div>
  );
}
