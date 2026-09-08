'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  CheckCircle2,
  X,
  FileCheck,
  RefreshCw,
  SwitchCamera,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface PaperSlipUploadProps {
  photoUrl: string | null;
  onPhotoChange: (base64OrUrl: string | null) => void;
  paperSlipCode?: string;
  onCodeChange?: (code: string) => void;
  signedByApproverName?: string;
  onSignerNameChange?: (name: string) => void;
  showMetadataFields?: boolean;
}

export default function PaperSlipUpload({
  photoUrl,
  onPhotoChange,
  paperSlipCode = '',
  onCodeChange,
  signedByApproverName = '',
  onSignerNameChange,
  showMetadataFields = true,
}: PaperSlipUploadProps) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle camera streaming
  const startCamera = async () => {
    setIsCameraOpen(true);
    setIsInitializing(true);
    setCameraError(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ Camera Web API');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraError('Không thể truy cập camera. Vui lòng cấp quyền hoặc tải ảnh có sẵn.');
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 600;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    stopCamera();
    onPhotoChange(dataUrl);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        onPhotoChange(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          onPhotoChange(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-4 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-emerald-50/40 rounded-2xl border border-indigo-100/90 space-y-3.5">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header Info */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <FileCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              Ảnh Đính Kèm Chứng Từ / Giấy Viết Tay
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                Không bắt buộc
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Đính kèm ảnh phiếu xác nhận đã có chữ ký tay của Bác sĩ / Quản lý
            </p>
          </div>
        </div>

        {photoUrl && (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã đính kèm ảnh
          </span>
        )}
      </div>

      {/* Photo Uploader / Preview Area */}
      {photoUrl ? (
        /* Image Preview Box */
        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-indigo-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 cursor-pointer group shadow-sm bg-slate-100 flex-shrink-0"
              onClick={() => setShowZoomModal(true)}
              title="Click để phóng to xem chi tiết"
            >
              <img
                src={photoUrl}
                alt="Chứng từ đính kèm"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Eye className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                Phiếu chứng từ đã sẵn sàng
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Đã lưu ảnh phiếu giấy có chữ ký duyệt thực tế
              </p>
              <button
                type="button"
                onClick={() => setShowZoomModal(true)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 mt-1"
              >
                <Eye className="w-3 h-3" /> Phóng to xem ảnh
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
              title="Đổi ảnh khác"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đổi ảnh</span>
            </button>
            <button
              type="button"
              onClick={() => onPhotoChange(null)}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
              title="Xóa ảnh này"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xóa</span>
            </button>
          </div>
        </div>
      ) : isCameraOpen ? (
        /* Live Camera Scanner Box */
        <div className="p-3 bg-slate-900 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="relative w-full max-w-sm h-56 rounded-lg overflow-hidden bg-black flex items-center justify-center">
            {isInitializing && (
              <div className="text-white text-xs flex flex-col items-center gap-2">
                <span className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span>Đang mở máy ảnh...</span>
              </div>
            )}

            {cameraError ? (
              <div className="p-4 text-center text-rose-300 text-xs">
                <AlertCircle className="w-6 h-6 text-rose-400 mx-auto mb-1" />
                {cameraError}
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Visual Document Guideline overlay */}
                <div className="absolute inset-3 border-2 border-dashed border-emerald-400/60 rounded-md pointer-events-none flex items-end justify-center pb-2">
                  <span className="text-[10px] text-emerald-300 bg-black/60 px-2 py-0.5 rounded font-mono">
                    Căn khung phiếu xác nhận / chữ ký
                  </span>
                </div>
              </>
            )}

            {/* Switch Camera */}
            {!cameraError && !isInitializing && (
              <button
                type="button"
                onClick={() => setFacingMode((p) => (p === 'environment' ? 'user' : 'environment'))}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/90 text-white p-1.5 rounded-full"
                title="Đổi camera trước/sau"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {!cameraError && !isInitializing && (
              <button
                type="button"
                onClick={capturePhoto}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" /> Chụp phiếu
              </button>
            )}
            <button
              type="button"
              onClick={stopCamera}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold"
            >
              Đóng Camera
            </button>
          </div>
        </div>
      ) : (
        /* Action Dropzone Area */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`p-4 rounded-xl border-2 border-dashed text-center transition-all bg-white/70 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50'
              : 'border-slate-200/90 hover:border-indigo-400 hover:bg-white'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Tải ảnh từ máy tính/điện thoại
            </button>

            <span className="text-slate-400 text-xs font-medium hidden sm:inline">hoặc</span>

            <button
              type="button"
              onClick={startCamera}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-indigo-600" /> Chụp ảnh trực tiếp bằng Camera
            </button>
          </div>

          <p className="text-[10px] text-slate-400 mt-2">
            Hỗ trợ ảnh JPG, PNG, WEBP. Kéo thả file trực tiếp vào đây. (Không bắt buộc)
          </p>
        </div>
      )}

      {/* Optional Metadata Inputs: Mã phiếu giấy & Tên bác sĩ ký */}
      {showMetadataFields && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-indigo-100/60">
          {onSignerNameChange && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Bác sĩ / Quản lý ký xác nhận (Nếu có):
              </label>
              <input
                type="text"
                value={signedByApproverName}
                onChange={(e) => onSignerNameChange(e.target.value)}
                placeholder="VD: BS. Lê Hoàng, BS. Nguyễn Văn..."
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
              />
            </div>
          )}

          {onCodeChange && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Mã số phiếu giấy / Số lưu trữ (Nếu có):
              </label>
              <input
                type="text"
                value={paperSlipCode}
                onChange={(e) => onCodeChange(e.target.value)}
                placeholder="VD: PKT-202609-001, GIAI-TRINH-02..."
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
              />
            </div>
          )}
        </div>
      )}

      {/* Zoom Modal */}
      {showZoomModal && photoUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                Ảnh Chụp Phiếu Giấy Xác Nhận Gốc
              </div>
              <button
                type="button"
                onClick={() => setShowZoomModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-900/5 rounded-2xl p-2">
              <img
                src={photoUrl}
                alt="Phiếu giấy gốc"
                className="max-h-[65vh] w-auto object-contain rounded-xl shadow-md"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>{signedByApproverName ? `Bác sĩ ký: ${signedByApproverName}` : 'Chứng từ đã đối soát'}</span>
              <button
                type="button"
                onClick={() => setShowZoomModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
