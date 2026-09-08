'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertCircle, SwitchCamera, Upload } from 'lucide-react';

interface CameraSelfieProps {
  onCapture: (base64Image: string) => void;
  capturedImage: string | null;
  onRetake: () => void;
}

export default function CameraSelfie({ onCapture, capturedImage, onRetake }: CameraSelfieProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const startCamera = async () => {
    setIsInitializing(true);
    setCameraError(null);

    // Stop existing stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ Camera Web API');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera access failed:', err);
      setCameraError('Không thể mở Camera. Vui lòng cho phép quyền Camera hoặc tải ảnh khuôn mặt.');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (!capturedImage) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, capturedImage]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;

    // Flip horizontally if front camera for natural selfie
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Stop camera stream after capture
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    onCapture(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        onCapture(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="w-full flex flex-col items-center">
      <canvas ref={canvasRef} className="hidden" />

      {capturedImage ? (
        /* Captured Preview */
        <div className="w-full flex flex-col items-center">
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden border-4 border-emerald-500 shadow-xl shadow-emerald-500/10">
            <img
              src={capturedImage}
              alt="Selfie Check-in"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
              <div className="bg-emerald-600 text-white rounded-full p-1.5 shadow-md">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onRetake}
            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 px-3 py-1.5 rounded-full transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Chụp lại ảnh khác
          </button>
        </div>
      ) : (
        /* Live Camera Feed */
        <div className="w-full flex flex-col items-center">
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden bg-slate-900 border-4 border-slate-200 shadow-inner flex items-center justify-center">
            {isInitializing && (
              <div className="text-white text-xs flex flex-col items-center gap-2">
                <span className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span>Đang mở camera...</span>
              </div>
            )}

            {cameraError ? (
              <div className="p-4 text-center text-rose-400 text-xs flex flex-col items-center gap-1.5">
                <AlertCircle className="w-6 h-6 text-rose-500" />
                <span className="text-[11px] leading-tight text-white">{cameraError}</span>
                <label className="mt-2 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer shadow-md">
                  <Upload className="w-3.5 h-3.5" /> Chọn ảnh có sẵn
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
                {/* Visual Focus Guides */}
                <div className="absolute inset-0 border-2 border-emerald-400/40 rounded-full pointer-events-none animate-pulse" />
              </>
            )}

            {/* Switch Camera Button */}
            {!cameraError && !isInitializing && (
              <button
                type="button"
                onClick={toggleFacingMode}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition-all"
                title="Đổi camera trước/sau"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Capture Trigger Button */}
          {!cameraError && !isInitializing && (
            <button
              type="button"
              onClick={capturePhoto}
              className="mt-3 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all"
            >
              <Camera className="w-4 h-4" /> Chụp ảnh chấm công
            </button>
          )}
        </div>
      )}
    </div>
  );
}
