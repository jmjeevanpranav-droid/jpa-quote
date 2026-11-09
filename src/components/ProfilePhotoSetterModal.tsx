'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  Check,
  X,
  Trash2,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { updateActiveUserAvatar, getActiveTabSession } from '@/lib/auth/client-context';

interface ProfilePhotoSetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  userName: string;
  userRole?: string;
  currentAvatarUrl?: string | null;
  onAvatarUpdated?: (newAvatarUrl: string | null) => void;
}

export function ProfilePhotoSetterModal({
  isOpen,
  onClose,
  userId,
  userName,
  userRole = 'Employee',
  currentAvatarUrl,
  onAvatarUpdated,
}: ProfilePhotoSetterModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgElementRef = useRef<HTMLImageElement | null>(null);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setImageSrc(null);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  // Load new image from file
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        imgElementRef.current = img;
        setImageSrc(src);
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
        setError('');
      };
      img.onerror = () => {
        setError('Failed to load image. Please try another file.');
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // Redraw the manual tracer canvas
  const drawTracerCanvas = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const img = imgElementRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    // Move to center of canvas
    ctx.translate(size / 2 + pan.x, size / 2 + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);

    // Compute aspect ratio fitting
    const imgAspect = img.width / img.height;
    let drawW: number;
    let drawH: number;

    if (imgAspect > 1) {
      // Landscape: height matches frame, width scales
      drawH = size * zoom;
      drawW = drawH * imgAspect;
    } else {
      // Portrait or square: width matches frame, height scales
      drawW = size * zoom;
      drawH = drawW / imgAspect;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }, [pan, zoom, rotation]);

  useEffect(() => {
    if (imageSrc) {
      drawTracerCanvas();
    }
  }, [imageSrc, drawTracerCanvas]);

  // Mouse & Touch Pan Drag Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // High-Resolution Export and Save Handler
  const handleSaveCroppedPhoto = async () => {
    const img = imgElementRef.current;
    if (!imageSrc || !img) {
      setError('Please choose a photo to set as profile image.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // High-resolution target canvas (512x512) for ultra-crisp display
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 512;
      exportCanvas.height = 512;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas render context unavailable');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const size = 512;
      const previewSize = previewCanvasRef.current?.width || 320;
      const scaleFactor = size / previewSize;

      ctx.save();
      ctx.translate(size / 2 + pan.x * scaleFactor, size / 2 + pan.y * scaleFactor);
      ctx.rotate((rotation * Math.PI) / 180);

      const imgAspect = img.width / img.height;
      let drawW: number;
      let drawH: number;

      if (imgAspect > 1) {
        drawH = size * zoom;
        drawW = drawH * imgAspect;
      } else {
        drawW = size * zoom;
        drawH = drawW / imgAspect;
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Export as high-quality WebP with JPEG fallback
      const croppedDataUrl = exportCanvas.toDataURL('image/webp', 0.92);

      const activeSession = typeof window !== 'undefined' ? getActiveTabSession() : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (activeSession?.token) {
        headers['x-jpa-session-token'] = activeSession.token;
        headers['Authorization'] = `Bearer ${activeSession.token}`;
      }

      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          avatarUrl: croppedDataUrl,
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save profile photo');
      }

      // Update client context if current user
      updateActiveUserAvatar(croppedDataUrl);
      if (onAvatarUpdated) {
        onAvatarUpdated(croppedDataUrl);
      }

      setSuccess('Profile photo updated successfully!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the photo.');
    } finally {
      setSaving(false);
    }
  };

  // Remove photo handler
  const handleRemovePhoto = async () => {
    if (!confirm('Are you sure you want to remove this profile photo?')) return;
    setSaving(true);
    try {
      const activeSession = typeof window !== 'undefined' ? getActiveTabSession() : null;
      const headers: Record<string, string> = {};
      if (activeSession?.token) {
        headers['x-jpa-session-token'] = activeSession.token;
        headers['Authorization'] = `Bearer ${activeSession.token}`;
      }
      const url = userId ? `/api/user/avatar?userId=${encodeURIComponent(userId)}` : '/api/user/avatar';
      const res = await fetch(url, { method: 'DELETE', headers });
      if (res.ok) {
        updateActiveUserAvatar(null);
        if (onAvatarUpdated) {
          onAvatarUpdated(null);
        }
        setSuccess('Profile photo removed');
        setTimeout(() => {
          onClose();
        }, 500);
      }
    } catch {
      setError('Failed to remove photo.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-setter-title"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 id="photo-setter-title" className="text-lg font-bold text-slate-900 tracking-wide font-calibri">
                Set Profile Photo
              </h3>
              <p className="text-[11pt] text-slate-500 font-calibri">
                {userName} ({userRole})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11pt] font-semibold font-calibri flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11pt] font-semibold font-calibri flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Interactive Manual Tracer Canvas Viewport */}
          <div className="flex flex-col items-center">
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl bg-slate-900 overflow-hidden shadow-inner border-2 border-dashed flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none ${
                imageSrc ? 'border-blue-500' : 'border-slate-300 bg-slate-100'
              }`}
              title={imageSrc ? 'Click and drag to position face inside frame' : 'Click to choose image'}
              onClick={() => {
                if (!imageSrc) fileInputRef.current?.click();
              }}
            >
              {imageSrc ? (
                <>
                  <canvas
                    ref={previewCanvasRef}
                    width={320}
                    height={320}
                    className="w-full h-full object-cover"
                  />
                  {/* Visual Squircle Framing Guide */}
                  <div className="absolute inset-2 sm:inset-3 rounded-2xl border-2 border-white/80 pointer-events-none shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-[9.5pt] font-calibri font-bold tracking-wide flex items-center gap-1.5 pointer-events-none">
                    <Move className="w-3.5 h-3.5" />
                    <span>Drag to reposition</span>
                  </div>
                </>
              ) : currentAvatarUrl ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-4 text-center">
                  <img
                    src={currentAvatarUrl}
                    alt={userName}
                    className="w-40 h-40 object-cover rounded-2xl shadow-md border-2 border-white"
                  />
                  <span className="text-[10pt] text-slate-500 font-calibri mt-2">Current photo</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-500">
                  <Upload className="w-10 h-10 text-slate-400" />
                  <span className="text-[11pt] font-bold text-slate-700 font-calibri">
                    Upload High-Resolution Photo
                  </span>
                  <span className="text-[10pt] text-slate-500 font-calibri">
                    Supports high-px camera shots, JPG, PNG & WEBP
                  </span>
                </div>
              )}
            </div>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Interactive Manual Adjustment Controls */}
          {imageSrc && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 font-calibri">
              {/* Zoom Slider */}
              <div className="flex items-center gap-3">
                <span className="text-[11pt] font-bold text-slate-700 w-14 shrink-0">Zoom:</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                  className="p-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3.5, z + 0.1))}
                  className="p-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <span className="text-[10.5pt] font-mono font-bold text-slate-600 w-12 text-right">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              {/* Rotate & Reset Controls */}
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-[10.5pt] hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                  title="Rotate photo 90 degrees clockwise"
                >
                  <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Rotate 90°</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-[10.5pt] hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Center and fit to frame"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Center / Reset</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11pt] font-calibri transition-colors cursor-pointer shadow-2xs"
            >
              <Upload className="w-4 h-4 text-slate-600" />
              <span>{imageSrc ? 'Choose Different Photo' : 'Select Photo from Device'}</span>
            </button>

            <div className="flex items-center gap-2.5 ml-auto">
              {currentAvatarUrl && !imageSrc && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11pt] font-calibri transition-colors cursor-pointer"
                  title="Remove profile photo and restore initials"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              )}

              {imageSrc && (
                <button
                  type="button"
                  onClick={handleSaveCroppedPhoto}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11pt] font-calibri shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save Profile Photo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

