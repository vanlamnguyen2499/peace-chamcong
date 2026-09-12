'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Camera,
  Upload,
  CheckCircle,
  ClockAlert,
  Flame,
  CalendarOff,
  UserCheck,
  Search,
  Filter,
  Eye,
  Download,
  ShieldCheck,
  User,
  Building,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  X,
  FileCheck,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import CameraSelfie from '@/components/CameraSelfie';

interface BatchRow {
  id: string;
  targetUserId: string;
  templateCode: string;
  signedByApproverId: string;
  workDate: string;
  // Specific data fields
  actualMinutes?: number;
  otStartTime?: string;
  otEndTime?: string;
  checkInTime?: string;
  checkOutTime?: string;
  duration?: number;
  reason?: string;
  paperSlipCode?: string;
  paperSlipPhotoUrl?: string | null;
}

export default function DigitizationPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'batch' | 'single' | 'audit'>('batch');

  // Master Data
  const [users, setUsers] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [digitizedList, setDigitizedList] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalDigitized: 0,
    totalWithPhoto: 0,
    totalPendingPhoto: 0,
    totalOTSlips: 0,
    totalForgotCheckinSlips: 0,
    totalLeaveSlips: 0,
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Photo modal preview
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Default date (today in YYYY-MM-DD)
  const todayStr = new Date().toISOString().slice(0, 10);

  // Batch Table State
  const [batchRows, setBatchRows] = useState<BatchRow[]>([
    {
      id: 'row-1',
      targetUserId: '',
      templateCode: 'FORGOT_CHECKIN_CONFIRM',
      signedByApproverId: '',
      workDate: todayStr,
      checkInTime: '08:00',
      checkOutTime: '17:30',
      reason: 'Quên bấm vân tay đầu ca, Bác sĩ/Quản lý đã ký xác nhận',
      paperSlipCode: '',
      paperSlipPhotoUrl: null,
    },
    {
      id: 'row-2',
      targetUserId: '',
      templateCode: 'OVERTIME_X2_CONFIRM',
      signedByApproverId: '',
      workDate: todayStr,
      actualMinutes: 60,
      otStartTime: '19:30',
      otEndTime: '20:30',
      reason: 'Ca điều trị kéo dài, Bác sĩ ký xác nhận tăng ca OT x2',
      paperSlipCode: '',
      paperSlipPhotoUrl: null,
    },
  ]);

  // Single Form State
  const [singleTargetUser, setSingleTargetUser] = useState<string>('');
  const [singleTemplateCode, setSingleTemplateCode] = useState<string>('FORGOT_CHECKIN_CONFIRM');
  const [singleDoctorId, setSingleDoctorId] = useState<string>('');
  const [singleDoctorName, setSingleDoctorName] = useState<string>('');
  const [singleWorkDate, setSingleWorkDate] = useState<string>(todayStr);
  const [singlePaperCode, setSinglePaperCode] = useState<string>('');
  const [singlePhoto, setSinglePhoto] = useState<string | null>(null);
  const [singleFormData, setSingleFormData] = useState<any>({
    reason: 'Bác sĩ đã ký xác nhận trên phiếu giấy thực tế',
    actualMinutes: 60,
    otStartTime: '19:30',
    otEndTime: '20:30',
    checkInTime: '08:00',
    checkOutTime: '17:30',
    duration: 1.0,
  });
  const [showSingleCamera, setShowSingleCamera] = useState<boolean>(false);

  // Audit Filters
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditTemplateFilter, setAuditTemplateFilter] = useState<string>('');
  const [auditPhotoFilter, setAuditPhotoFilter] = useState<string>('');
  const [auditFromDate, setAuditFromDate] = useState<string>('');
  const [auditToDate, setAuditToDate] = useState<string>('');

  // Fetch Master Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [approversRes, templatesRes, digitizeRes] = await Promise.all([
        fetch('/api/approvals/approvers'),
        fetch('/api/approvals/templates'),
        fetch('/api/approvals/digitize'),
      ]);

      if (approversRes.ok) {
        const appData = await approversRes.json();
        setUsers(appData.users || []);
        const docList = appData.users?.filter((u: any) => u.role === 'MANAGER' || u.role === 'SUPER_ADMIN' || u.position?.includes('Bác sĩ') || u.position?.includes('Quản lý')) || [];
        setDoctors(docList.length > 0 ? docList : appData.users || []);
      }

      if (templatesRes.ok) {
        const tplData = await templatesRes.json();
        setTemplates(tplData.templates || []);
      }

      if (digitizeRes.ok) {
        const digData = await digitizeRes.json();
        setDigitizedList(digData.requests || []);
        if (digData.stats) setStats(digData.stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Check Permissions
  const isAuthorized = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN';

  // Add new row to Batch
  const handleAddRow = () => {
    const newId = `row-${Date.now()}`;
    const defaultDoc = doctors[0]?.id || '';
    setBatchRows((prev) => [
      ...prev,
      {
        id: newId,
        targetUserId: '',
        templateCode: 'FORGOT_CHECKIN_CONFIRM',
        signedByApproverId: defaultDoc,
        workDate: todayStr,
        checkInTime: '08:00',
        checkOutTime: '17:30',
        actualMinutes: 60,
        otStartTime: '19:30',
        otEndTime: '20:30',
        duration: 1.0,
        reason: 'Bác sĩ/Quản lý đã ký tay xác nhận',
        paperSlipCode: '',
        paperSlipPhotoUrl: null,
      },
    ]);
  };

  const handleAdd5Rows = () => {
    const defaultDoc = doctors[0]?.id || '';
    const newRows: BatchRow[] = [];
    for (let i = 0; i < 5; i++) {
      newRows.push({
        id: `row-${Date.now()}-${i}`,
        targetUserId: '',
        templateCode: 'FORGOT_CHECKIN_CONFIRM',
        signedByApproverId: defaultDoc,
        workDate: todayStr,
        checkInTime: '08:00',
        checkOutTime: '17:30',
        actualMinutes: 60,
        duration: 1.0,
        reason: 'Bác sĩ/Quản lý đã ký tay xác nhận',
        paperSlipCode: '',
        paperSlipPhotoUrl: null,
      });
    }
    setBatchRows((prev) => [...prev, ...newRows]);
  };

  const handleRemoveRow = (id: string) => {
    if (batchRows.length <= 1) return;
    setBatchRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRowChange = (id: string, field: keyof BatchRow, value: any) => {
    setBatchRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return { ...r, [field]: value };
        }
        return r;
      })
    );
  };

  // Upload row photo
  const handleRowPhotoUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleRowChange(id, 'paperSlipPhotoUrl', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Batch Table
  const handleSubmitBatch = async () => {
    setFeedback(null);

    // Validation
    for (let i = 0; i < batchRows.length; i++) {
      const row = batchRows[i];
      if (!row.targetUserId) {
        setFeedback({ type: 'error', text: `Dòng số ${i + 1}: Vui lòng chọn Nhân sự được xác nhận!` });
        return;
      }
      if (!row.workDate) {
        setFeedback({ type: 'error', text: `Dòng số ${i + 1}: Vui lòng chọn Ngày áp dụng!` });
        return;
      }
    }

    setSubmitting(true);
    try {
      const itemsPayload = batchRows.map((r) => {
        const matchedDoc = doctors.find((d) => d.id === r.signedByApproverId);
        const dataPayload: any = {
          workDate: r.workDate,
          reason: r.reason || 'Bác sĩ đã ký xác nhận trên phiếu giấy thực tế',
        };

        if (r.templateCode === 'OVERTIME_X2_CONFIRM' || r.templateCode === 'OVERTIME') {
          dataPayload.actualMinutes = Number(r.actualMinutes || 60);
          dataPayload.otStartTime = r.otStartTime || '19:30';
          dataPayload.otEndTime = r.otEndTime || '20:30';
          dataPayload.doctorOrManagerName = matchedDoc?.name || 'Bác sĩ / Quản lý';
        } else if (r.templateCode === 'FORGOT_CHECKIN_CONFIRM' || r.templateCode === 'ADJUSTMENT') {
          dataPayload.checkInTime = r.checkInTime || '08:00';
          dataPayload.checkOutTime = r.checkOutTime || '17:30';
        } else if (r.templateCode.startsWith('LEAVE')) {
          dataPayload.duration = Number(r.duration || (r.templateCode === 'LEAVE_HALF_SHIFT' ? 0.5 : 1.0));
          dataPayload.startDate = r.workDate;
          dataPayload.endDate = r.workDate;
        }

        return {
          targetUserId: r.targetUserId,
          templateCode: r.templateCode,
          signedByApproverId: r.signedByApproverId || undefined,
          signedByApproverName: matchedDoc?.name || 'Bác sĩ / Quản lý chi nhánh',
          paperSlipCode: r.paperSlipCode || undefined,
          paperSlipPhotoUrl: r.paperSlipPhotoUrl || undefined,
          data: dataPayload,
        };
      });

      const res = await fetch('/api/approvals/digitize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsPayload }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi lưu hàng loạt');

      setFeedback({
        type: 'success',
        text: `Đã số hóa và duyệt tự động thành công ${data.count} phiếu xác nhận ký tay!`,
      });

      // Reset batch table
      setBatchRows([
        {
          id: `row-${Date.now()}`,
          targetUserId: '',
          templateCode: 'FORGOT_CHECKIN_CONFIRM',
          signedByApproverId: doctors[0]?.id || '',
          workDate: todayStr,
          checkInTime: '08:00',
          checkOutTime: '17:30',
          reason: 'Quên bấm vân tay đầu ca, Bác sĩ/Quản lý đã ký xác nhận',
          paperSlipCode: '',
          paperSlipPhotoUrl: null,
        },
      ]);

      await fetchData();
      setActiveTab('audit');
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Lỗi xử lý' });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Single Form
  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleTargetUser) {
      setFeedback({ type: 'error', text: 'Vui lòng chọn nhân sự được duyệt' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const matchedDoc = doctors.find((d) => d.id === singleDoctorId);
      const dataPayload = {
        ...singleFormData,
        workDate: singleWorkDate,
        startDate: singleWorkDate,
        endDate: singleWorkDate,
        doctorOrManagerName: singleDoctorName || matchedDoc?.name || 'Bác sĩ / Quản lý',
      };

      const res = await fetch('/api/approvals/digitize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: singleTargetUser,
          templateCode: singleTemplateCode,
          signedByApproverId: singleDoctorId || undefined,
          signedByApproverName: singleDoctorName || matchedDoc?.name || 'Bác sĩ / Quản lý',
          paperSlipCode: singlePaperCode || undefined,
          paperSlipPhotoUrl: singlePhoto || undefined,
          data: dataPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi lưu phiếu');

      setFeedback({
        type: 'success',
        text: 'Đã số hóa và duyệt thành công phiếu xác nhận ký tay!',
      });

      setSinglePhoto(null);
      setSinglePaperCode('');
      await fetchData();
      setActiveTab('audit');
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Lỗi gửi phiếu' });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter audit records
  const filteredAudit = digitizedList.filter((req) => {
    if (auditSearch) {
      const q = auditSearch.toLowerCase();
      const matchText =
        req.code?.toLowerCase().includes(q) ||
        req.creator?.name?.toLowerCase().includes(q) ||
        req.creator?.employeeCode?.toLowerCase().includes(q) ||
        req.signedByApproverName?.toLowerCase().includes(q) ||
        req.paperSlipCode?.toLowerCase().includes(q);
      if (!matchText) return false;
    }
    if (auditTemplateFilter && req.template?.code !== auditTemplateFilter) return false;
    if (auditPhotoFilter === 'yes' && !req.paperSlipPhotoUrl) return false;
    if (auditPhotoFilter === 'no' && req.paperSlipPhotoUrl) return false;
    if (auditFromDate && new Date(req.createdAt) < new Date(`${auditFromDate}T00:00:00.000Z`)) return false;
    if (auditToDate && new Date(req.createdAt) > new Date(`${auditToDate}T23:59:59.999Z`)) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
              <FileCheck className="w-3.5 h-3.5" />
              <span>Cổng Nghiệp Vụ Dành Cho HR &amp; Quản Lý (MỤC 2 &amp; 5)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Số Hóa &amp; Nhập Phiếu Xác Nhận Ký Tay Của Bác Sĩ
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 max-w-3xl leading-relaxed">
              Nhập và lưu trữ ảnh các phiếu xác nhận giấy đã được Bác sĩ / Quản lý ký tay (Tăng ca OT x2, Quên bấm vân tay, Đi trễ &gt; 30p, Nghỉ phép). Hệ thống <strong>tự động hoàn tất duyệt và ghi nhận ngay vào Bảng công</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/approvals"
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              Trung Tâm Duyệt Phiếu
            </Link>
            <Link
              href="/admin/timesheet"
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
            >
              <Building className="w-4 h-4" />
              Bảng Công Tháng
            </Link>
          </div>
        </div>

        {/* 4 Quick KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">Tổng phiếu đã số hóa:</div>
            <div className="text-2xl font-black text-white mt-0.5">{stats.totalDigitized}</div>
            <div className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Đã duyệt 100%
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">Phiếu Tăng Ca (OT x2):</div>
            <div className="text-2xl font-black text-orange-400 mt-0.5">{stats.totalOTSlips}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Nhân đôi phút làm thêm</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">Phiếu Quên Vân Tay:</div>
            <div className="text-2xl font-black text-blue-400 mt-0.5">{stats.totalForgotCheckinSlips}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Khôi phục công chuẩn</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium">Đã có ảnh chứng từ:</div>
            <div className="text-2xl font-black text-teal-400 mt-0.5">{stats.totalWithPhoto} / {stats.totalDigitized}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Đối soát kho giấy</div>
          </div>
        </div>
      </div>

      {/* Permission Guard */}
      {!isAuthorized && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>Bạn đang xem với vai trò {user?.role}. Để nhập và số hóa phiếu ký tay, bạn cần đăng nhập với tài khoản HR_ADMIN (hr@peace.vn) hoặc SUPER_ADMIN.</span>
        </div>
      )}

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm'
              : 'bg-rose-50 border-rose-200 text-rose-800 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-rose-600" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('batch')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'batch'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          ⚡ Bảng Nhập Nhanh Hàng Loạt ({batchRows.length} dòng)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('single')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'single'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" />
          📷 Form Phiếu Chi Tiết Kèm Camera
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          📋 Sổ Lưu Trữ &amp; Đối Soát Chứng Từ ({digitizedList.length})
        </button>
      </div>

      {/* TAB 1: BẢNG NHẬP NHANH HÀNG LOẠT (BATCH ENTRY TABLE) */}
      {activeTab === 'batch' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Bảng Nhập Liệu Hàng Loạt Phiếu Giấy Ký Tay (Batch Entry)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhập nhanh danh sách các phiếu xác nhận do Bác sĩ/Quản lý chi nhánh ký tay. Bấm lưu để hệ thống tự động duyệt và cập nhật Bảng công đồng loạt.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> +1 Dòng
              </button>
              <button
                type="button"
                onClick={handleAdd5Rows}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> +5 Dòng Nhanh
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                <tr>
                  <th className="p-3 w-10 text-center">STT</th>
                  <th className="p-3 min-w-[200px]">Nhân Sự Được Xác Nhận *</th>
                  <th className="p-3 min-w-[180px]">Loại Phiếu / Mẫu Phiếu Phê Duyệt *</th>
                  <th className="p-3 min-w-[170px]">Bác Sĩ / Quản Lý Ký Tay *</th>
                  <th className="p-3 w-36">Ngày Áp Dụng *</th>
                  <th className="p-3 min-w-[220px]">Thông Số / Chi Tiết Nghiệp Vụ</th>
                  <th className="p-3 w-32">Ảnh Phiếu Giấy</th>
                  <th className="p-3 w-12 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {batchRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>

                    {/* Employee Select */}
                    <td className="p-2.5">
                      <select
                        value={row.targetUserId}
                        onChange={(e) => handleRowChange(row.id, 'targetUserId', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                      >
                        <option value="">-- Chọn nhân viên --</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.employeeCode}) {u.department ? `[${u.department.name}]` : ''}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Template Select */}
                    <td className="p-2.5">
                      <select
                        value={row.templateCode}
                        onChange={(e) => handleRowChange(row.id, 'templateCode', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <optgroup label="⏱️ Chấm Công &amp; OT">
                          <option value="FORGOT_CHECKIN_CONFIRM">Quên Chấm Công (Bù 100%)</option>
                          <option value="OVERTIME_X2_CONFIRM">Tăng Ca (OT x2)</option>
                          <option value="LATE_EARLY_CONFIRM">Xác Nhận Đi Trễ (Xóa phạt)</option>
                          <option value="ADJUSTMENT">Giải Trình Bổ Sung Công</option>
                        </optgroup>
                        <optgroup label="🏖️ Nghỉ Phép &amp; Chế Độ">
                          <option value="LEAVE_ANNUAL">Nghỉ Phép Năm (Trừ phép)</option>
                          <option value="LEAVE_HALF_SHIFT">Nghỉ Nửa Ca (0.5 công)</option>
                          <option value="LEAVE_SICK">Nghỉ Ốm / BHXH</option>
                          <option value="LEAVE_SPECIAL">Nghỉ Việc Riêng (100% lương)</option>
                          <option value="LEAVE_UNPAID">Nghỉ Không Lương</option>
                        </optgroup>
                        <optgroup label="💼 Đào Tạo &amp; Công Tác">
                          <option value="TRAINING_REQUEST">Đi Học / Đào Tạo (2 công)</option>
                          <option value="BUSINESS_TRIP">Đi Công Tác</option>
                        </optgroup>
                      </select>
                    </td>

                    {/* Doctor Select */}
                    <td className="p-2.5">
                      <select
                        value={row.signedByApproverId}
                        onChange={(e) => handleRowChange(row.id, 'signedByApproverId', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                      >
                        <option value="">-- Bác sĩ / Quản lý ký --</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.position || d.role})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Work Date */}
                    <td className="p-2.5">
                      <input
                        type="date"
                        value={row.workDate}
                        onChange={(e) => handleRowChange(row.id, 'workDate', e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </td>

                    {/* Business Parameters based on Template */}
                    <td className="p-2.5">
                      {row.templateCode === 'OVERTIME_X2_CONFIRM' || row.templateCode === 'OVERTIME' ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">OT:</span>
                          <input
                            type="number"
                            placeholder="Số phút"
                            value={row.actualMinutes || 60}
                            onChange={(e) => handleRowChange(row.id, 'actualMinutes', Number(e.target.value))}
                            className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                          />
                          <span className="text-[10px] text-slate-500">phút &rarr; <strong>{((Number(row.actualMinutes || 60) * 2) / 60).toFixed(1)}h OT</strong></span>
                        </div>
                      ) : row.templateCode === 'FORGOT_CHECKIN_CONFIRM' || row.templateCode === 'ADJUSTMENT' ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={row.checkInTime || '08:00'}
                            onChange={(e) => handleRowChange(row.id, 'checkInTime', e.target.value)}
                            className="w-20 px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <span>-</span>
                          <input
                            type="time"
                            value={row.checkOutTime || '17:30'}
                            onChange={(e) => handleRowChange(row.id, 'checkOutTime', e.target.value)}
                            className="w-20 px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                      ) : row.templateCode.startsWith('LEAVE') ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500">Công nghỉ:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={row.templateCode === 'LEAVE_HALF_SHIFT' ? 0.5 : (row.duration || 1.0)}
                            onChange={(e) => handleRowChange(row.id, 'duration', Number(e.target.value))}
                            className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                          />
                          <span className="text-[10px] text-emerald-700 font-bold">công</span>
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Lý do / Ghi chú..."
                          value={row.reason || ''}
                          onChange={(e) => handleRowChange(row.id, 'reason', e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      )}
                    </td>

                    {/* Paper Slip Photo */}
                    <td className="p-2.5">
                      {row.paperSlipPhotoUrl ? (
                        <div className="flex items-center gap-1.5">
                          <img
                            src={row.paperSlipPhotoUrl}
                            alt="Phiếu"
                            className="w-7 h-7 object-cover rounded-lg border border-slate-200 cursor-pointer"
                            onClick={() => setPreviewPhoto(row.paperSlipPhotoUrl!)}
                          />
                          <button
                            type="button"
                            onClick={() => handleRowChange(row.id, 'paperSlipPhotoUrl', null)}
                            className="text-[10px] text-rose-500 hover:text-rose-700"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold text-slate-600">
                          <Upload className="w-3 h-3" /> Tải ảnh
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleRowPhotoUpload(row.id, e)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </td>

                    {/* Remove Row Button */}
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        disabled={batchRows.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Action Bar */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              ⚡ Tổng cộng: <strong>{batchRows.length} phiếu</strong> sẽ được số hóa &amp; tự động duyệt vào Bảng công.
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmitBatch}
                disabled={submitting || !isAuthorized}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Đang lưu &amp; duyệt...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> ⚡ Lưu &amp; Duyệt Hàng Loạt ({batchRows.length} Phiếu)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FORM PHIẾU CHI TIẾT KÈM CAMERA (SINGLE DETAILED FORM) */}
      {activeTab === 'single' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" />
              Số Hóa Phiếu Ký Tay (Chế Độ Form Chi Tiết Kèm Chụp Ảnh)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Điền chi tiết thông tin phiếu xác nhận giấy và chụp ảnh trực tiếp từ WebCam hoặc tải file ảnh chứng từ.
            </p>
          </div>

          <form onSubmit={handleSubmitSingle} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Employee */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nhân sự được xác nhận <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={singleTargetUser}
                  onChange={(e) => setSingleTargetUser(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.employeeCode}) {u.department ? `[${u.department.name}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mẫu phiếu xác nhận <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={singleTemplateCode}
                  onChange={(e) => setSingleTemplateCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <optgroup label="⏱️ Chấm Công &amp; OT">
                    <option value="FORGOT_CHECKIN_CONFIRM">Phiếu Xác Nhận Quên Chấm Công (Bù 100%)</option>
                    <option value="OVERTIME_X2_CONFIRM">Phiếu Xác Nhận Tăng Ca (OT x2)</option>
                    <option value="LATE_EARLY_CONFIRM">Phiếu Xác Nhận Đi Trễ (Xóa phạt &gt; 30p)</option>
                    <option value="ADJUSTMENT">Phiếu Giải Trình Chấm Công</option>
                  </optgroup>
                  <optgroup label="🏖️ Nghỉ Phép &amp; Chế Độ">
                    <option value="LEAVE_ANNUAL">Nghỉ Phép Năm (Trừ quỹ phép)</option>
                    <option value="LEAVE_HALF_SHIFT">Nghỉ Nửa Ca (0.5 công phép)</option>
                    <option value="LEAVE_SICK">Nghỉ Ốm / BHXH</option>
                    <option value="LEAVE_SPECIAL">Nghỉ Việc Riêng (100% lương)</option>
                    <option value="LEAVE_UNPAID">Nghỉ Không Lương</option>
                  </optgroup>
                  <optgroup label="💼 Đào Tạo &amp; Công Tác">
                    <option value="TRAINING_REQUEST">Phiếu Đi Học / Đào Tạo (2 công)</option>
                    <option value="BUSINESS_TRIP">Phiếu Đi Công Tác</option>
                  </optgroup>
                </select>
              </div>

              {/* Doctor / Manager Signer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bác sĩ / Quản lý đã ký tay <span className="text-rose-500">*</span>
                </label>
                <select
                  value={singleDoctorId}
                  onChange={(e) => {
                    setSingleDoctorId(e.target.value);
                    const doc = doctors.find((d) => d.id === e.target.value);
                    if (doc) setSingleDoctorName(doc.name);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                >
                  <option value="">-- Chọn Bác sĩ / Quản lý --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.position || d.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Work Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ngày áp dụng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={singleWorkDate}
                  onChange={(e) => setSingleWorkDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Template Specific Fields */}
            {(singleTemplateCode === 'OVERTIME_X2_CONFIRM' || singleTemplateCode === 'OVERTIME') && (
              <div className="p-4 bg-orange-50/70 rounded-2xl border border-orange-200 space-y-3">
                <div className="text-xs font-bold text-orange-900 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-600" />
                  Quy định Tăng ca (OT x2 - MỤC 4):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Giờ bắt đầu OT:</label>
                    <input
                      type="time"
                      value={singleFormData.otStartTime || '19:30'}
                      onChange={(e) => setSingleFormData((p: any) => ({ ...p, otStartTime: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Giờ kết thúc OT:</label>
                    <input
                      type="time"
                      value={singleFormData.otEndTime || '20:30'}
                      onChange={(e) => setSingleFormData((p: any) => ({ ...p, otEndTime: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Số phút làm thêm:</label>
                    <input
                      type="number"
                      value={singleFormData.actualMinutes || 60}
                      onChange={(e) => setSingleFormData((p: any) => ({ ...p, actualMinutes: Number(e.target.value) }))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-orange-700"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-orange-800">
                  ⚡ Hệ số x2: Làm thêm <strong>{singleFormData.actualMinutes || 60} phút</strong> &rarr; Quy đổi thành <strong>{((Number(singleFormData.actualMinutes || 60) * 2) / 60).toFixed(1)} giờ OT</strong> ghi nhận vào Bảng công.
                </p>
              </div>
            )}

            {(singleTemplateCode === 'FORGOT_CHECKIN_CONFIRM' || singleTemplateCode === 'ADJUSTMENT') && (
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-3">
                <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  Bù Giờ Chấm Công (Quên Bấm Vân Tay - MỤC 2):
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Giờ Check-in bù:</label>
                    <input
                      type="time"
                      value={singleFormData.checkInTime || '08:00'}
                      onChange={(e) => setSingleFormData((p: any) => ({ ...p, checkInTime: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Giờ Check-out bù:</label>
                    <input
                      type="time"
                      value={singleFormData.checkOutTime || '17:30'}
                      onChange={(e) => setSingleFormData((p: any) => ({ ...p, checkOutTime: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Photo Attachment & Camera Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  Ảnh Chụp Phiếu Xác Nhận Có Chữ Ký
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                    Không bắt buộc
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSingleCamera(!showSingleCamera)}
                    className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" /> {showSingleCamera ? 'Đóng Camera' : 'Chụp WebCam'}
                  </button>
                  <label className="cursor-pointer px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" /> Tải tệp ảnh
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const r = new FileReader();
                          r.onload = () => setSinglePhoto(r.result as string);
                          r.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {showSingleCamera && !singlePhoto && (
                <div className="p-3 bg-white rounded-xl border border-indigo-100">
                  <CameraSelfie
                    onCapture={(img) => {
                      setSinglePhoto(img);
                      setShowSingleCamera(false);
                    }}
                    capturedImage={singlePhoto}
                    onRetake={() => setSinglePhoto(null)}
                  />
                </div>
              )}

              {singlePhoto && (
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-200">
                  <img
                    src={singlePhoto}
                    alt="Chứng từ đã chụp"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer"
                    onClick={() => setPreviewPhoto(singlePhoto)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Đã đính kèm ảnh chụp phiếu giấy
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Click vào ảnh để xem kích thước đầy đủ</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSinglePhoto(null)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg hover:bg-rose-50"
                  >
                    Xóa ảnh
                  </button>
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ghi chú lưu vết đối soát của HR:
              </label>
              <textarea
                rows={2}
                value={singleFormData.reason || ''}
                onChange={(e) => setSingleFormData((p: any) => ({ ...p, reason: e.target.value }))}
                placeholder="Nhập ghi chú hoặc lý do xác nhận..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Submit */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={submitting || !isAuthorized}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Đang xử lý...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> ⚡ Lưu &amp; Duyệt Ngay Phiếu Này
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: SỔ LƯU TRỮ CHỨNG TỪ & ĐỐI SOÁT (AUDIT REGISTRY) */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Sổ Lưu Trữ &amp; Đối Soát Phiếu Giấy Ký Tay Đã Số Hóa
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tra cứu, kiểm tra ảnh chứng từ gốc và xuất dữ liệu đối soát kho hồ sơ giấy
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchData}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Làm mới
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã phiếu, tên nhân viên, Bác sĩ..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <select
              value={auditTemplateFilter}
              onChange={(e) => setAuditTemplateFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
            >
              <option value="">-- Tất cả mẫu phiếu --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={auditPhotoFilter}
              onChange={(e) => setAuditPhotoFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
            >
              <option value="">-- Tình trạng ảnh chứng từ --</option>
              <option value="yes">Đã đính kèm ảnh</option>
              <option value="no">Chưa có ảnh (Chờ bổ sung)</option>
            </select>

            <div className="flex items-center gap-1">
              <input
                type="date"
                value={auditFromDate}
                onChange={(e) => setAuditFromDate(e.target.value)}
                className="w-1/2 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px]"
                title="Từ ngày"
              />
              <span>-</span>
              <input
                type="date"
                value={auditToDate}
                onChange={(e) => setAuditToDate(e.target.value)}
                className="w-1/2 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px]"
                title="Đến ngày"
              />
            </div>
          </div>

          {/* Audit List Table */}
          {filteredAudit.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Chưa có phiếu xác nhận ký tay nào phù hợp với bộ lọc
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Mã Phiếu / Ngày</th>
                    <th className="p-3">Nhân Sự Được Duyệt</th>
                    <th className="p-3">Mẫu Phiếu / Nghiệp Vụ</th>
                    <th className="p-3">Bác Sĩ / Quản Lý Ký Tay</th>
                    <th className="p-3">Chi Tiết / Lý Do</th>
                    <th className="p-3 text-center">Ảnh Phiếu Gốc</th>
                    <th className="p-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredAudit.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <div className="font-mono font-bold text-indigo-700">{req.code}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(req.createdAt).toLocaleDateString('vi-VN')} {new Date(req.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900">{req.creator?.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {req.creator?.employeeCode} {req.creator?.department ? `• ${req.creator.department.name}` : ''}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-bold">
                          {req.template?.name}
                        </span>
                        {req.isDigitizedOffline && (
                          <span className="block mt-1 text-[9px] font-bold text-emerald-700 uppercase">
                            ✓ Ký tay &amp; Số hóa
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                          {req.signedByApproverName || 'Bác sĩ / Quản lý'}
                        </div>
                      </td>

                      <td className="p-3 max-w-xs truncate">
                        <div className="truncate text-slate-600">
                          {req.data?.reason || req.data?.taskDescription || 'Không có ghi chú'}
                        </div>
                        {req.data?.actualMinutes && (
                          <div className="text-[10px] text-orange-600 font-bold mt-0.5">
                            OT: {req.data.actualMinutes}p $\to$ {((req.data.actualMinutes * 2) / 60).toFixed(1)}h (x2)
                          </div>
                        )}
                        {req.data?.checkInTime && (
                          <div className="text-[10px] text-blue-600 mt-0.5">
                            Giờ bù: {req.data.checkInTime} - {req.data.checkOutTime}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        {req.paperSlipPhotoUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewPhoto(req.paperSlipPhotoUrl)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100 transition-colors"
                          >
                            <Eye className="w-3 h-3" /> Xem ảnh
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Chưa có ảnh</span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <Link
                          href={`/approvals/${req.id}`}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1"
                        >
                          Chi tiết <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal View Photo */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                Ảnh Chụp Phiếu Xác Nhận Gốc Có Chữ Ký
              </h3>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-900 rounded-2xl p-2">
              <img src={previewPhoto} alt="Phiếu ký tay gốc" className="max-w-full max-h-[65vh] object-contain rounded-lg" />
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
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
