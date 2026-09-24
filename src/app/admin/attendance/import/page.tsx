'use client';

import { useState } from 'react';
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ImportAttendancePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ success?: string; error?: string; details?: string[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/attendance/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult({ success: data.message, details: data.results });
      setFile(null);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Import Máy Chấm Công</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tải lên file Excel (.xlsx) xuất từ máy vân tay (Sheet "CHẤM VÂN TAY") để hệ thống tự động trích xuất giờ Check-in/Check-out.
          </p>
        </div>
        <Link 
          href="/admin/timesheet"
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
        >
          Trở về Bảng công
        </Link>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div 
          className="border-2 border-dashed border-indigo-200 rounded-2xl p-12 text-center bg-indigo-50/50 hover:bg-indigo-50 transition-colors relative"
        >
          <input 
            type="file" 
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-indigo-100 text-indigo-600">
              {file ? <FileSpreadsheet className="w-8 h-8" /> : <UploadCloud className="w-8 h-8" />}
            </div>
            {file ? (
              <div>
                <p className="text-sm font-bold text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-slate-900">Kéo thả file Excel vào đây hoặc click để chọn</p>
                <p className="text-xs text-slate-500 mt-1">Hỗ trợ định dạng .xlsx, .xls</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-colors"
          >
            {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isUploading ? 'Đang xử lý dữ liệu...' : 'Bắt đầu Import'}
          </button>
        </div>
      </div>

      {result?.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Lỗi Import</p>
            <p className="text-sm mt-1">{result.error}</p>
          </div>
        </div>
      )}

      {result?.success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex gap-3 text-emerald-800">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="w-full">
            <p className="font-bold text-sm">Thành công</p>
            <p className="text-sm mt-1">{result.success}</p>
            
            {result.details && result.details.length > 0 && (
              <div className="mt-4 max-h-60 overflow-y-auto pr-2 text-xs bg-emerald-100/50 p-3 rounded-lg">
                <ul className="space-y-1 list-disc list-inside">
                  {result.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
