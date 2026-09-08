'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
  FileText,
  Plus,
  CalendarOff,
  ClockAlert,
  Clock,
  Flame,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock3,
  Search,
  Filter,
  ArrowRight,
  User,
  Building,
  Check,
  X,
  Download,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  ChevronDown,
  UserCheck,
  Send,
  BarChart3,
  RefreshCw,
  Plane,
  GraduationCap,
  Laptop,
  Briefcase,
  FileCheck,
} from 'lucide-react';
import PaperSlipUpload from '@/components/PaperSlipUpload';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'my_requests' | 'pending_me' | 'history_me' | 'summary' | 'all'>('my_requests');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [templateFilter, setTemplateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>('');
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const [requests, setRequests] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [approversData, setApproversData] = useState<any>({ users: [], recommendations: {}, groups: {} });
  const [counts, setCounts] = useState<any>({
    myRequests: 0,
    myApproved: 0,
    myRejected: 0,
    myPending: 0,
    pendingMe: 0,
    historyMe: 0,
    all: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Showcase Category State
  const [showcaseCategory, setShowcaseCategory] = useState<string>('ALL');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalCategory, setModalCategory] = useState<string>('ALL');
  const [modalSearch, setModalSearch] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [formData, setFormData] = useState<{ [key: string]: any }>({});
  const [customApprovers, setCustomApprovers] = useState<{ [stepOrder: number]: string }>({});
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(null);
  const [paperSlipCode, setPaperSlipCode] = useState<string>('');
  const [signedDoctorName, setSignedDoctorName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch Requests & Counts
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('tab', tab === 'summary' ? 'all' : tab);
      if (statusFilter) params.set('status', statusFilter);
      if (templateFilter) params.set('templateCode', templateFilter);
      if (selectedCreatorId) params.set('creatorId', selectedCreatorId);
      if (selectedApproverId) params.set('approverId', selectedApproverId);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await fetch(`/api/approvals?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Templates
  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/approvals/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Eligible Approvers
  const fetchApprovers = async () => {
    try {
      const res = await fetch('/api/approvals/approvers');
      if (res.ok) {
        const data = await res.json();
        setApproversData(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [tab, statusFilter, templateFilter, selectedCreatorId, selectedApproverId, fromDate, toDate]);

  useEffect(() => {
    fetchTemplates();
    fetchApprovers();
  }, []);

  const handleOpenCreateModal = (tpl?: any) => {
    const target = tpl || templates.find((t) => t.code === 'LEAVE_ANNUAL') || templates[0];
    setSelectedTemplate(target);
    setFormData({});
    setTargetUserId('');
    setAttachedPhoto(null);
    setPaperSlipCode('');
    setSignedDoctorName('');
    setModalSearch('');
    setSubmitError(null);

    // Initialize default approvers for the template steps
    const initialApprovers: { [key: number]: string } = {};
    if (target?.defaultSteps) {
      const steps = Array.isArray(target.defaultSteps)
        ? target.defaultSteps
        : JSON.parse(target.defaultSteps || '[]');

      steps.forEach((st: any, idx: number) => {
        const order = st.stepOrder || idx + 1;
        if (st.approverRole === 'MANAGER' && approversData.recommendations?.directManager?.id) {
          initialApprovers[order] = approversData.recommendations.directManager.id;
        } else if (st.approverRole === 'HR_ADMIN' && approversData.recommendations?.defaultHr?.id) {
          initialApprovers[order] = approversData.recommendations.defaultHr.id;
        } else if (st.approverRole === 'SUPER_ADMIN' && approversData.recommendations?.defaultSuperAdmin?.id) {
          initialApprovers[order] = approversData.recommendations.defaultSuperAdmin.id;
        } else if (approversData.users?.length > 0) {
          initialApprovers[order] = approversData.users[0].id;
        }
      });
    }

    setCustomApprovers(initialApprovers);
    setShowCreateModal(true);
  };

  const handleFormFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleApproverChange = (stepOrder: number, approverId: string) => {
    setCustomApprovers((prev) => ({ ...prev, [stepOrder]: approverId }));
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          data: formData,
          approvers: customApprovers,
          targetUserId: targetUserId || undefined,
          paperSlipPhotoUrl: attachedPhoto || undefined,
          paperSlipCode: paperSlipCode || undefined,
          signedByApproverName: signedDoctorName || undefined,
          isDigitizedOffline: Boolean(attachedPhoto || signedDoctorName),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi tạo đơn phê duyệt');
      }

      setShowCreateModal(false);
      setFormData({});
      setTargetUserId('');
      setAttachedPhoto(null);
      setPaperSlipCode('');
      setSignedDoctorName('');
      setCustomApprovers({});
      await fetchRequests();
    } catch (err: any) {
      setSubmitError(err.message || 'Lỗi gửi đơn');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (templateFilter) params.set('templateCode', templateFilter);
      if (selectedCreatorId) params.set('creatorId', selectedCreatorId);
      if (selectedApproverId) params.set('approverId', selectedApproverId);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await fetch(`/api/approvals/export?${params.toString()}`);
      if (!res.ok) throw new Error('Không thể xuất file');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_Cao_Phe_Duyet_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || 'Lỗi xuất file Excel');
    } finally {
      setExporting(false);
    }
  };

  const getTemplateIcon = (code: string) => {
    switch (code) {
      case 'LEAVE':
      case 'LEAVE_ANNUAL':
        return <CalendarOff className="w-5 h-5 text-emerald-600" />;
      case 'LEAVE_UNPAID':
        return <FileText className="w-5 h-5 text-slate-500" />;
      case 'LEAVE_SICK':
        return <ShieldCheck className="w-5 h-5 text-rose-600" />;
      case 'LEAVE_SPECIAL':
        return <Sparkles className="w-5 h-5 text-purple-600" />;
      case 'LEAVE_HALF_SHIFT':
        return <Clock className="w-5 h-5 text-teal-600" />;
      case 'LATE_EARLY':
      case 'LATE_EARLY_CONFIRM':
        return <ClockAlert className="w-5 h-5 text-blue-600" />;
      case 'ADJUSTMENT':
      case 'FORGOT_CHECKIN_CONFIRM':
        return <UserCheck className="w-5 h-5 text-indigo-600" />;
      case 'OVERTIME':
      case 'OVERTIME_X2_CONFIRM':
        return <Flame className="w-5 h-5 text-orange-600" />;
      case 'BUSINESS_TRIP':
        return <Plane className="w-5 h-5 text-amber-600" />;
      case 'TRAINING_REQUEST':
        return <GraduationCap className="w-5 h-5 text-violet-600" />;
      case 'WFH_REQUEST':
        return <Laptop className="w-5 h-5 text-sky-600" />;
      case 'PAYMENT':
        return <CreditCard className="w-5 h-5 text-fuchsia-600" />;
      default:
        return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
            <CheckCircle className="w-3.5 h-3.5" /> Đã duyệt
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
            <XCircle className="w-3.5 h-3.5" /> Bị từ chối
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
            <Clock3 className="w-3.5 h-3.5" /> Chờ duyệt
          </span>
        );
    }
  };

  const isManager = user?.role !== 'EMPLOYEE';
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN';

  // Comprehensive Standard Business Templates (MỤC 5 & Enterprise Clinic Workflows)
  const ALL_BUSINESS_TEMPLATES = [
    // Nhóm 1: Nghỉ Phép & Chế Độ (MỤC 5)
    {
      code: 'LEAVE_ANNUAL',
      name: 'Nghỉ Phép Năm',
      category: 'LEAVE',
      desc: 'Trừ vào quỹ phép năm, tính đủ công có lương',
      icon: CalendarOff,
      badge: 'Trừ Quỹ Phép',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      code: 'LEAVE_UNPAID',
      name: 'Nghỉ Không Lương',
      category: 'LEAVE',
      desc: 'Nghỉ việc không hưởng lương, không trừ quỹ phép',
      icon: FileText,
      badge: '0 Công',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      code: 'LEAVE_SICK',
      name: 'Nghỉ Ốm / BHXH',
      category: 'LEAVE',
      desc: 'Kèm giấy xác nhận y tế / viện phí hưởng BHXH',
      icon: ShieldCheck,
      badge: 'Hưởng BHXH',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      code: 'LEAVE_SPECIAL',
      name: 'Nghỉ Việc Riêng (Hiếu/Hỷ)',
      category: 'LEAVE',
      desc: 'Kết hôn, hiếu hỷ,... hưởng 100% nguyên lương',
      icon: Sparkles,
      badge: '100% Lương',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    {
      code: 'LEAVE_HALF_SHIFT',
      name: 'Nghỉ Nửa Ca (0.5 Công)',
      category: 'LEAVE',
      desc: 'Nghỉ 0.5 công phép, hệ thống không phạt đi trễ',
      icon: Clock,
      badge: '0.5 Công Phép',
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    },

    // Nhóm 2: Chấm Công, Đi Trễ & Tăng Ca (MỤC 2, 3, 4)
    {
      code: 'FORGOT_CHECKIN_CONFIRM',
      name: 'Phiếu Xác Nhận Quên Chấm Công',
      category: 'ATTENDANCE',
      desc: 'Bù giờ vào/ra khi quên bấm vân tay, khôi phục 100% công',
      icon: UserCheck,
      badge: 'Khôi Phục 100% Công',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      code: 'LATE_EARLY_CONFIRM',
      name: 'Phiếu Xác Nhận Đi Trễ / Về Sớm',
      category: 'ATTENDANCE',
      desc: 'Xác nhận lý do chính đáng, xóa phạt trễ > 30p, khôi phục đủ 3 công',
      icon: ClockAlert,
      badge: 'Xóa Phạt Trễ > 30p',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      code: 'OVERTIME_X2_CONFIRM',
      name: 'Phiếu Xác Nhận Tăng Ca (OT x2)',
      category: 'ATTENDANCE',
      desc: 'Tăng ca từ 15p trở lên, tự động nhân đôi (x2) số phút làm thêm',
      icon: Flame,
      badge: 'Hệ Số OT x2',
      badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
    },
    {
      code: 'ADJUSTMENT',
      name: 'Đơn Giải Trình Chấm Công Bổ Sung',
      category: 'ATTENDANCE',
      desc: 'Giải trình lỗi GPS thiết bị, mất mạng hoặc đi gặp khách hàng',
      icon: ClockAlert,
      badge: 'Giải Trình Công',
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    },

    // Nhóm 3: Công Tác, Đào Tạo & Tài Chính
    {
      code: 'BUSINESS_TRIP',
      name: 'Đơn Xin Đi Công Tác',
      category: 'WORK_FINANCE',
      desc: 'Lịch công tác, khám tuyến cơ sở, gặp đối tác (tính đủ công)',
      icon: Plane,
      badge: 'Công Tác Tuyến',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      code: 'TRAINING_REQUEST',
      name: 'Đơn Đi Học / Đào Tạo Nâng Cao',
      category: 'WORK_FINANCE',
      desc: 'Tham gia đào tạo chuyên môn Y khoa (đặc cách 2 công 14h-19h30)',
      icon: GraduationCap,
      badge: 'Đặc Cách 2 Công',
      badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
    },
    {
      code: 'WFH_REQUEST',
      name: 'Đơn Làm Việc Từ Xa (WFH)',
      category: 'WORK_FINANCE',
      desc: 'Đăng ký làm việc tại nhà theo KPI khối văn phòng / Marketing / IT',
      icon: Laptop,
      badge: 'Làm Việc Từ Xa',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    },
    {
      code: 'PAYMENT',
      name: 'Đơn Đề Xuất Tạm Ứng / Chi Tiêu',
      category: 'WORK_FINANCE',
      desc: 'Tạm ứng chi phí công tác, mua sắm vật tư y tế hoặc thanh toán',
      icon: CreditCard,
      badge: 'Tạm Ứng Quỹ',
      badgeColor: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    },
  ];

  // Client-side search filtering
  const filteredRequests = requests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.code?.toLowerCase().includes(q) ||
      r.template?.name?.toLowerCase().includes(q) ||
      r.creator?.name?.toLowerCase().includes(q) ||
      r.creator?.employeeCode?.toLowerCase().includes(q) ||
      r.data?.reason?.toLowerCase().includes(q) ||
      r.data?.purpose?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Trung Tâm Phê Duyệt</h1>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              Enterprise Hub (MỤC 5)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quy trình phê duyệt 3 bước, danh mục 8 mẫu đơn chuẩn và tổng hợp đối soát tự động
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN') && (
            <Link
              href="/admin/digitize"
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-3.5 py-2.5 rounded-2xl shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all"
            >
              <FileCheck className="w-4 h-4" /> ⚡ Số Hóa Phiếu Ký Tay (HR)
            </Link>
          )}

          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-2xl shadow-sm hover:shadow transition-all disabled:opacity-50"
            title="Xuất danh sách đơn phê duyệt ra file Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>

          <button
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" /> Tạo Đơn / Phiếu Mới
          </button>
        </div>
      </div>

      {/* 3-Step Approval Workflow Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-5 text-white shadow-lg border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Quy Trình Phê Duyệt 3 Bước Chuẩn Doanh Nghiệp (MỤC 5)
            </h2>
          </div>
          <span className="text-[10px] text-slate-400">Dựa trên Giấy xác nhận / Kê khai trực tuyến</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 text-xs font-mono">
              1
            </div>
            <div>
              <div className="font-bold text-white">Bước 1: Ký Phiếu Xác Nhận</div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Nhân sự báo Quản lý chi nhánh, ký Phiếu xác nhận giấy/viết tay (dùng chung cho Nghỉ phép, Tăng ca, Quên vân tay, Đi trễ).
              </div>
            </div>
          </div>

          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center flex-shrink-0 text-xs font-mono">
              2
            </div>
            <div>
              <div className="font-bold text-white">Bước 2: Cập Nhật Lên Hệ Thống</div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Quản lý / HR hoặc Nhân sự bấm chọn mẫu đơn tương ứng và gửi đơn lên hệ thống PEACE.
              </div>
            </div>
          </div>

          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-xs font-mono">
              3
            </div>
            <div>
              <div className="font-bold text-white">Bước 3: Quản Lý / HR Duyệt</div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Bấm <strong>Approve (Duyệt)</strong> $\to$ Hệ thống tự động bù công, xóa phạt trễ &gt; 30p, nhân đôi giờ OT x2.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Standard 13 Templates Grid Showcase */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              Danh Mục 13 Mẫu Đơn &amp; Phiếu Xác Nhận Chuẩn (Click để tạo ngay)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chọn một trong các mẫu đơn chuẩn hóa dưới đây để tạo phiếu xác nhận nhanh
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowcaseCategory('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                showcaseCategory === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất Cả ({ALL_BUSINESS_TEMPLATES.length})
            </button>
            <button
              type="button"
              onClick={() => setShowcaseCategory('LEAVE')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                showcaseCategory === 'LEAVE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏖️ Nghỉ Phép (5)
            </button>
            <button
              type="button"
              onClick={() => setShowcaseCategory('ATTENDANCE')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                showcaseCategory === 'ATTENDANCE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ⏱️ Chấm Công &amp; OT (4)
            </button>
            <button
              type="button"
              onClick={() => setShowcaseCategory('WORK_FINANCE')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                showcaseCategory === 'WORK_FINANCE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              💼 Công Tác &amp; Chi Tiêu (4)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ALL_BUSINESS_TEMPLATES.filter(
            (st) => showcaseCategory === 'ALL' || st.category === showcaseCategory
          ).map((st) => {
            const matchedTpl = templates.find((t) => t.code === st.code) || templates.find((t) => t.code === 'LEAVE');
            const Icon = st.icon;

            return (
              <button
                key={st.code}
                type="button"
                onClick={() => handleOpenCreateModal(matchedTpl)}
                className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/40 text-left transition-all group flex flex-col justify-between hover:shadow-md cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                      <Icon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${st.badgeColor}`}>
                      {st.badge}
                    </span>
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {st.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {st.desc}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-emerald-600 font-bold">
                  <span>Tạo đơn ngay</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Card 1: My Requests (Người được duyệt) */}
        <div
          onClick={() => setTab('my_requests')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            tab === 'my_requests'
              ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
              : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
            <span className="flex items-center gap-1.5 text-slate-700">
              <Send className="w-3.5 h-3.5 text-emerald-600" /> Đơn Của Tôi
            </span>
            <span className="text-emerald-700 bg-emerald-100/70 text-[10px] px-1.5 py-0.5 rounded font-mono">
              {counts.myApproved}/{counts.myRequests} duyệt
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            {counts.myRequests}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2">
            <span className="text-emerald-600 font-semibold">{counts.myApproved} đã duyệt</span>
            <span>•</span>
            <span className="text-amber-600 font-semibold">{counts.myPending} chờ</span>
            <span>•</span>
            <span className="text-rose-600 font-semibold">{counts.myRejected} từ chối</span>
          </div>
        </div>

        {/* Card 2: Pending for Me (Người duyệt) */}
        <div
          onClick={() => setTab('pending_me')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all relative overflow-hidden ${
            tab === 'pending_me'
              ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
              : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'
          }`}
        >
          {counts.pendingMe > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
          )}
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
            <span className="flex items-center gap-1.5 text-slate-700">
              <Clock3 className="w-3.5 h-3.5 text-amber-600" /> Cần Tôi Duyệt
            </span>
            <span className="text-amber-700 bg-amber-100 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Chờ xử lý
            </span>
          </div>
          <div className="text-2xl font-extrabold text-amber-700 tracking-tight mt-1">
            {counts.pendingMe}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 truncate">
            {counts.pendingMe > 0 ? 'Có đơn cần bạn phê duyệt ngay' : 'Đã xử lý xong tất cả đơn'}
          </p>
        </div>

        {/* Card 3: History Processed by Me (Người đã duyệt) */}
        <div
          onClick={() => setTab('history_me')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            tab === 'history_me'
              ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
              : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
            <span className="flex items-center gap-1.5 text-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" /> Tôi Đã Duyệt
            </span>
            <span className="text-blue-700 bg-blue-100 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Đã xử lý
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            {counts.historyMe}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 truncate">
            Lịch sử các đơn bạn đã duyệt / từ chối
          </p>
        </div>

        {/* Card 4: Summary / Company Audit */}
        <div
          onClick={() => setTab('summary')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            tab === 'summary'
              ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 shadow-sm'
              : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
            <span className="flex items-center gap-1.5 text-slate-700">
              <BarChart3 className="w-3.5 h-3.5 text-purple-600" /> Bảng Tổng Hợp
            </span>
            <span className="text-purple-700 bg-purple-100 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Đối soát
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            {isAdmin ? counts.all : counts.myRequests}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 truncate">
            Tra cứu ma trận & xuất báo cáo Excel
          </p>
        </div>
      </div>

      {/* Filter Tabs & Advanced Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            <button
              onClick={() => setTab('my_requests')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                tab === 'my_requests'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Đơn Của Tôi (Người Được Duyệt)
              {counts.myRequests > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${tab === 'my_requests' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {counts.myRequests}
                </span>
              )}
            </button>

            {isManager && (
              <button
                onClick={() => setTab('pending_me')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  tab === 'pending_me'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Clock3 className="w-3.5 h-3.5" />
                Cần Tôi Duyệt
                {counts.pendingMe > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {counts.pendingMe}
                  </span>
                )}
              </button>
            )}

            {isManager && (
              <button
                onClick={() => setTab('history_me')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  tab === 'history_me'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Tôi Đã Duyệt (Người Đã Duyệt)
                {counts.historyMe > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${tab === 'history_me' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {counts.historyMe}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setTab('summary')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                tab === 'summary'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Bảng Tổng Hợp & Đối Soát
            </button>
          </div>

          <button
            onClick={() => fetchRequests()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 transition-colors"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Multi-Filters Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          {/* Text Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã đơn, tên, lý do..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt (Thành công)</option>
            <option value="REJECTED">Bị từ chối</option>
          </select>

          {/* Template Filter */}
          <select
            value={templateFilter}
            onChange={(e) => setTemplateFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">Tất cả loại mẫu đơn</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.code}>
                {tpl.name}
              </option>
            ))}
          </select>

          {/* Filter by Designated / Acting Approver */}
          <select
            value={selectedApproverId}
            onChange={(e) => setSelectedApproverId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">Lọc theo Người duyệt...</option>
            {approversData.users?.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.position || u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests List & Matrix */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Đang tải danh sách đơn phê duyệt...</span>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Không có đơn nào khớp</h3>
          <p className="text-xs text-slate-500 mt-1">
            Không tìm thấy bản ghi phê duyệt nào trong bộ lọc hiện tại.
          </p>
          <button
            onClick={() => handleOpenCreateModal()}
            className="mt-4 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Tạo đơn ngay
          </button>
        </div>
      ) : tab === 'summary' ? (
        /* Summary Matrix Table View */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bảng Tổng Hợp Đối Soát Phê Duyệt</h3>
              <p className="text-xs text-slate-500">Hiển thị chi tiết người gửi, người duyệt và kết quả xử lý</p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full font-mono">
              Tổng: {filteredRequests.length} đơn
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-700 border-b border-slate-200 font-bold">
                  <th className="py-3 px-4">Mã Đơn</th>
                  <th className="py-3 px-4">Loại Đơn</th>
                  <th className="py-3 px-4">Người Gửi (Người Được Duyệt)</th>
                  <th className="py-3 px-4">Ngày Gửi</th>
                  <th className="py-3 px-4">Người Duyệt C1</th>
                  <th className="py-3 px-4">Người Duyệt C2</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {filteredRequests.map((req) => {
                  const step1 = req.steps?.find((s: any) => s.stepOrder === 1);
                  const step2 = req.steps?.find((s: any) => s.stepOrder === 2);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        {req.code}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {getTemplateIcon(req.template?.code)}
                          <span className="font-semibold text-slate-900">{req.template?.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{req.creator?.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {req.creator?.employeeCode} • {req.creator?.department?.name || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3.5 px-4">
                        {step1 ? (
                          <div>
                            <div className="font-medium text-slate-800 flex items-center gap-1">
                              {step1.status === 'APPROVED' ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : step1.status === 'REJECTED' ? (
                                <X className="w-3 h-3 text-rose-600" />
                              ) : (
                                <Clock3 className="w-3 h-3 text-amber-500" />
                              )}
                              {step1.approver?.name || step1.approverRole || 'Quản lý'}
                            </div>
                            {step1.note && (
                              <div className="text-[10px] text-slate-400 italic truncate max-w-[140px]" title={step1.note}>
                                &quot;{step1.note}&quot;
                              </div>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {step2 ? (
                          <div>
                            <div className="font-medium text-slate-800 flex items-center gap-1">
                              {step2.status === 'APPROVED' ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : step2.status === 'REJECTED' ? (
                                <X className="w-3 h-3 text-rose-600" />
                              ) : (
                                <Clock3 className="w-3 h-3 text-amber-500" />
                              )}
                              {step2.approver?.name || step2.approverRole || 'HR/Ban Giám Đốc'}
                            </div>
                            {step2.note && (
                              <div className="text-[10px] text-slate-400 italic truncate max-w-[140px]" title={step2.note}>
                                &quot;{step2.note}&quot;
                              </div>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(req.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/approvals/${req.id}`}
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold text-xs"
                        >
                          Xem <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Regular Card List View */
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <Link
              key={req.id}
              href={`/approvals/${req.id}`}
              className="block bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 hover:border-emerald-500 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left info */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    {getTemplateIcon(req.template?.code)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {req.code}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                        {req.template?.name}
                      </h3>
                      {req.isDigitizedOffline && (
                        <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-sm">
                          ✍️ Ký Tay ({req.signedByApproverName || 'Bác sĩ'})
                        </span>
                      )}
                      {req.paperSlipPhotoUrl && (
                        <span className="inline-flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-sm">
                          📎 Có Ảnh Kèm
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-slate-800">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {req.creator?.name} ({req.creator?.employeeCode})
                      </span>
                      {req.creator?.department && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {req.creator.department.name}
                        </span>
                      )}
                      <span>
                        Ngày gửi: {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    {/* Summary preview */}
                    <div className="text-xs text-slate-600 mt-2 bg-slate-50 px-3 py-1.5 rounded-lg inline-block max-w-xl truncate">
                      {req.data?.reason || req.data?.purpose || req.data?.taskDescription || 'Không có ghi chú'}
                      {req.data?.duration && ` (${req.data.duration} ngày)`}
                      {req.data?.amount && ` (${Number(req.data.amount).toLocaleString('vi-VN')} đ)`}
                    </div>

                    {/* Designated approver tags */}
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 flex-wrap">
                      <span className="font-bold text-slate-600">Người duyệt chỉ định:</span>
                      {req.steps?.map((st: any) => (
                        <span
                          key={st.id}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${
                            st.status === 'APPROVED'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : st.status === 'REJECTED'
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          Cấp {st.stepOrder}: {st.approver?.name || st.approverRole || 'Quản lý'}
                          {st.status === 'APPROVED' && ' (✓)'}
                          {st.status === 'REJECTED' && ' (✕)'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Steps & Status */}
                <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                  <div className="flex items-center gap-1">
                    {req.steps?.map((st: any) => (
                      <div
                        key={st.id}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                          st.status === 'APPROVED'
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : st.status === 'REJECTED'
                            ? 'bg-rose-500 text-white border-rose-500'
                            : st.stepOrder === req.currentStep && req.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}
                        title={`Bước ${st.stepOrder}: ${st.approver?.name || st.approverRole || 'Người duyệt'}`}
                      >
                        {st.status === 'APPROVED' ? (
                          <Check className="w-3 h-3" />
                        ) : st.status === 'REJECTED' ? (
                          <X className="w-3 h-3" />
                        ) : (
                          st.stepOrder
                        )}
                      </div>
                    ))}
                  </div>

                  <div>{getStatusBadge(req.status)}</div>

                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors hidden sm:block" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Request Modal with Designated Approver Selector */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Tạo Đơn Phê Duyệt Mới</h2>
                <p className="text-xs text-slate-500 mt-0.5">Chọn mẫu đơn chuẩn hóa và chỉ định người duyệt theo quy định</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {submitError && (
              <div className="my-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold">
                {submitError}
              </div>
            )}

            {/* Template Selection Browser */}
            <div className="my-4 space-y-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" /> Danh Mục 13 Loại Đơn Chuẩn:
                </label>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm nhanh mẫu đơn..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  />
                </div>
              </div>

              {/* Category Filter Tabs in Modal */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setModalCategory('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    modalCategory === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Tất Cả ({ALL_BUSINESS_TEMPLATES.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalCategory('LEAVE')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    modalCategory === 'LEAVE'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  🏖️ Nghỉ Phép (5)
                </button>
                <button
                  type="button"
                  onClick={() => setModalCategory('ATTENDANCE')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    modalCategory === 'ATTENDANCE'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  ⏱️ Chấm Công &amp; OT (4)
                </button>
                <button
                  type="button"
                  onClick={() => setModalCategory('WORK_FINANCE')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    modalCategory === 'WORK_FINANCE'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  💼 Công Tác &amp; Chi Tiêu (4)
                </button>
              </div>

              {/* Template Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                {ALL_BUSINESS_TEMPLATES.filter((tpl) => {
                  const matchCategory = modalCategory === 'ALL' || tpl.category === modalCategory;
                  const matchSearch =
                    !modalSearch.trim() ||
                    tpl.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
                    tpl.desc.toLowerCase().includes(modalSearch.toLowerCase()) ||
                    tpl.code.toLowerCase().includes(modalSearch.toLowerCase());
                  return matchCategory && matchSearch;
                }).map((tpl) => {
                  const matchedTpl = templates.find((t) => t.code === tpl.code) || templates.find((t) => t.code === 'LEAVE') || templates[0];
                  const isSelected = selectedTemplate?.code === tpl.code || selectedTemplate?.id === matchedTpl?.id;
                  const Icon = tpl.icon;

                  return (
                    <button
                      key={tpl.code}
                      type="button"
                      onClick={() => {
                        setSelectedTemplate(matchedTpl);
                        setFormData({});
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg border flex-shrink-0 ${isSelected ? 'bg-emerald-100 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-slate-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate leading-tight">{tpl.name}</div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{tpl.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Form for Selected Template */}
            {selectedTemplate && (
              <form onSubmit={handleSubmitRequest} className="space-y-4 pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-500 italic mb-2">
                  {selectedTemplate.description}
                </div>

                {/* Manager / HR Create on behalf of employee (MỤC 2) */}
                {isManager && (
                  <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        Nhân sự được xác nhận / Tạo đơn hộ:
                      </label>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        Dành cho Quản lý / HR (MỤC 2)
                      </span>
                    </div>
                    <select
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    >
                      <option value="">-- Chính tôi ({user?.name}) --</option>
                      {approversData.users?.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.employeeCode}) — {u.position || u.role} {u.department ? `[${u.department.name}]` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      💡 <strong>Quy định MỤC 2:</strong> Nhân sự quên chấm công phải báo ngay trong ngày. Quản lý/HR có thể nhập phiếu xác nhận hộ và duyệt để khôi phục công hợp lệ trên Bảng công.
                    </p>
                  </div>
                )}

                {selectedTemplate.schemaFields?.map((field: any) => (
                  <div key={field.name}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {field.label} {field.required && <span className="text-rose-500">*</span>}
                    </label>

                    {field.type === 'select' ? (
                      <select
                        required={field.required}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="">-- Chọn {field.label} --</option>
                        {field.options?.map((opt: string) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        required={field.required}
                        rows={3}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        placeholder={`Nhập ${field.label.toLowerCase()}...`}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
                        step={field.type === 'number' ? 'any' : undefined}
                        required={field.required}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                        placeholder={`Nhập ${field.label.toLowerCase()}...`}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    )}
                  </div>
                ))}

                {/* Optional Paper Slip / Handwritten Document Photo Attachment */}
                <PaperSlipUpload
                  photoUrl={attachedPhoto}
                  onPhotoChange={setAttachedPhoto}
                  paperSlipCode={paperSlipCode}
                  onCodeChange={setPaperSlipCode}
                  signedByApproverName={signedDoctorName}
                  onSignerNameChange={setSignedDoctorName}
                  showMetadataFields={true}
                />

                {/* Designated Approver Selection Section */}
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    Chỉ định Người Duyệt Đơn:
                  </div>

                  {selectedTemplate.defaultSteps?.map((s: any, idx: number) => {
                    const stepOrder = s.stepOrder || idx + 1;
                    const stepTitle = s.label || s.approverRole || `Cấp ${stepOrder}`;

                    return (
                      <div key={stepOrder} className="bg-white p-3 rounded-xl border border-emerald-100">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                          Bước {stepOrder} ({stepTitle}):
                        </label>
                        <select
                          value={customApprovers[stepOrder] || ''}
                          onChange={(e) => handleApproverChange(stepOrder, e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        >
                          <option value="">-- Chọn người duyệt bước này --</option>
                          {approversData.users?.map((u: any) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.employeeCode}) — {u.position || u.role} {u.department ? `[${u.department.name}]` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submitting ? 'Đang gửi...' : <><Send className="w-3.5 h-3.5" /> Gửi Đơn Duyệt</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
