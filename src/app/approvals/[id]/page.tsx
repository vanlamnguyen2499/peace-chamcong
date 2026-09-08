'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Building,
  MapPin,
  Calendar,
  MessageSquare,
  Send,
  ShieldCheck,
  Check,
  X,
  AlertTriangle,
  FileText,
  UserCheck,
  Award,
} from 'lucide-react';

export default function ApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id as string;

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [previewPhotoModal, setPreviewPhotoModal] = useState(false);

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/approvals/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRequest(data.request);
      } else {
        router.push('/approvals');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetail();
  }, [id]);

  const handleAction = async (action: 'APPROVE' | 'REJECT', noteStr?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/approvals/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          note: noteStr || (action === 'APPROVE' ? approveNote : rejectReason),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi thao tác');

      setShowRejectModal(false);
      setRejectReason('');
      setApproveNote('');
      await fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Lỗi thao tác phê duyệt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setCommentLoading(true);
    try {
      const res = await fetch(`/api/approvals/${id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      });

      if (res.ok) {
        setCommentText('');
        await fetchDetail();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCommentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
        <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>Đang tải thông tin đơn...</span>
      </div>
    );
  }

  if (!request) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/approvals"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </Link>
        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
          {request.code}
        </span>
      </div>

      {/* Main Request Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              {request.template?.name}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">
              {request.data?.reason || request.data?.purpose || request.template?.name}
            </h1>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-2 flex-wrap">
              <span className="flex items-center gap-1 font-semibold text-slate-800">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {request.creator?.name} ({request.creator?.employeeCode})
              </span>
              {request.creator?.position && (
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px]">
                  {request.creator.position}
                </span>
              )}
              {request.creator?.department && (
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  {request.creator.department.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {new Date(request.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>
          </div>

          <div>
            {request.status === 'APPROVED' ? (
              <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-2xl font-bold text-xs shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Đã duyệt hoàn tất
              </div>
            ) : request.status === 'REJECTED' ? (
              <div className="flex items-center gap-2 bg-rose-100 text-rose-800 px-4 py-2 rounded-2xl font-bold text-xs shadow-sm">
                <XCircle className="w-4 h-4 text-rose-600" /> Bị từ chối
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-2xl font-bold text-xs shadow-sm animate-pulse">
                <Clock className="w-4 h-4 text-amber-600" /> Đang chờ duyệt (Cấp {request.currentStep})
              </div>
            )}
          </div>
        </div>

        {/* Attached Proof Photo / Offline Digitization Audit Banner */}
        {(request.paperSlipPhotoUrl || request.data?.paperSlipPhotoUrl || request.isDigitizedOffline) && (
          <div className="p-4 bg-gradient-to-r from-indigo-50/90 to-blue-50/70 rounded-2xl border border-indigo-200 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-sm">
                  ✍️ {request.isDigitizedOffline ? 'Số Hóa Ký Tay' : 'Chứng Từ Đính Kèm'}
                </span>
                <div>
                  <h3 className="text-xs font-bold text-indigo-950">
                    {request.isDigitizedOffline
                      ? 'Phiếu Xác Nhận Đã Được Bác Sĩ / Quản Lý Ký Tay Thực Tế'
                      : 'Đơn Đã Đính Kèm Ảnh Phiếu Xác Nhận Viết Tay'}
                  </h3>
                  <p className="text-[11px] text-indigo-700">
                    {request.signedByApproverName
                      ? `Bác sĩ / Quản lý ký xác nhận: ${request.signedByApproverName}`
                      : 'Đã lưu trữ ảnh chụp chứng từ để đối soát'}
                    {request.paperSlipCode && ` • Mã phiếu: ${request.paperSlipCode}`}
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full w-fit">
                ✓ {request.status === 'APPROVED' ? 'Đã Đối Soát & Tự Động Duyệt' : 'Chứng Từ Hợp Lệ'}
              </span>
            </div>

            {(request.paperSlipPhotoUrl || request.data?.paperSlipPhotoUrl) && (
              <div className="pt-2.5 border-t border-indigo-100 flex items-center gap-3.5">
                <div
                  className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-indigo-300 shadow-sm cursor-pointer group bg-slate-900 flex-shrink-0"
                  onClick={() => setPreviewPhotoModal(true)}
                  title="Click để phóng to ảnh xem chữ ký"
                >
                  <img
                    src={request.paperSlipPhotoUrl || request.data?.paperSlipPhotoUrl}
                    alt="Ảnh chụp phiếu ký tay"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                    Phóng to
                  </div>
                </div>

                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Ảnh Chụp / Scan Phiếu Giấy Gốc
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Click vào ảnh để xem toàn màn hình đối chiếu chữ ký và nội dung
                  </p>
                  <button
                    type="button"
                    onClick={() => setPreviewPhotoModal(true)}
                    className="mt-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                  >
                    🔍 Xem ảnh kích thước đầy đủ
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Data Breakdown */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Chi Tiết Nội Dung Đề Xuất
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(request.data || {}).map(([key, val]) => (
              <div key={key} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  {key}
                </div>
                <div className="text-xs font-bold text-slate-800 mt-1 break-words">
                  {typeof val === 'number' && key.toLowerCase().includes('amount')
                    ? `${Number(val).toLocaleString('vi-VN')} VNĐ`
                    : String(val)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step-by-Step Approval Chain & Designated Approvers */}
        <div className="pt-6 border-t border-slate-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            Tiến Trình Phê Duyệt & Người Được Chỉ Định
          </h2>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {request.steps?.map((step: any) => {
              const isCurrent = step.stepOrder === request.currentStep && request.status === 'PENDING';
              const isApproved = step.status === 'APPROVED';
              const isRejected = step.status === 'REJECTED';

              return (
                <div key={step.id} className="relative">
                  {/* Status icon dot */}
                  <div
                    className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 bg-white ${
                      isApproved
                        ? 'border-emerald-500 text-emerald-600'
                        : isRejected
                        ? 'border-rose-500 text-rose-600'
                        : isCurrent
                        ? 'border-amber-500 text-amber-600 animate-ping'
                        : 'border-slate-300 text-slate-400'
                    }`}
                  >
                    {isApproved ? <Check className="w-3 h-3 text-emerald-600" /> : isRejected ? <X className="w-3 h-3 text-rose-600" /> : step.stepOrder}
                  </div>

                  <div className={`p-4 rounded-2xl border ${isCurrent ? 'bg-amber-50/50 border-amber-200 shadow-sm' : isApproved ? 'bg-emerald-50/40 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="font-bold text-xs text-slate-800">
                          Bước {step.stepOrder}: {step.approver?.name || step.approverRole || 'Người duyệt'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {step.approver?.position ? `${step.approver.position} • ` : ''}
                          {step.approver?.employeeCode ? `Mã NV: ${step.approver.employeeCode}` : `Vai trò: ${step.approverRole || 'Quản lý'}`}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          isApproved
                            ? 'bg-emerald-100 text-emerald-700'
                            : isRejected
                            ? 'bg-rose-100 text-rose-700'
                            : isCurrent
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isApproved ? 'Đã duyệt' : isRejected ? 'Từ chối' : isCurrent ? 'Đang chờ duyệt' : 'Chưa đến lượt'}
                      </span>
                    </div>

                    {step.note && (
                      <div className="mt-2.5 p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-700">
                        <span className="font-bold text-slate-900">Ý kiến phê duyệt: </span>
                        <span className="italic">&quot;{step.note}&quot;</span>
                      </div>
                    )}

                    {step.actedAt && (
                      <div className="text-[10px] text-slate-400 mt-2">
                        Thời gian xử lý: {new Date(step.actedAt).toLocaleString('vi-VN')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approver Action Panel */}
        {request.canApprove && (
          <div className="p-6 bg-emerald-50/80 rounded-2xl border border-emerald-200 mt-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Bạn có quyền phê duyệt cho bước này ({user?.name})
            </div>

            <input
              type="text"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Ghi chú thêm khi duyệt (không bắt buộc)..."
              className="w-full px-3.5 py-2.5 bg-white border border-emerald-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleAction('APPROVE')}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Đồng Ý Phê Duyệt
              </button>

              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <X className="w-4 h-4" /> Từ Chối
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Discussion & Comments Box */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          Trao Đổi & Bình Luận ({request.comments?.length || 0})
        </h2>

        {/* Comment list */}
        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
          {request.comments?.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 italic">
              Chưa có trao đổi nào trên đơn này.
            </div>
          ) : (
            request.comments?.map((c: any) => (
              <div key={c.id} className="p-3 bg-slate-50 rounded-2xl text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800">{c.user?.name}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(c.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <p className="text-slate-600">{c.content}</p>
              </div>
            ))
          )}
        </div>

        {/* Comment input */}
        <form onSubmit={handleSendComment} className="flex gap-2 pt-2 border-t border-slate-100">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Viết bình luận, phản hồi cho người tạo đơn..."
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={commentLoading || !commentText.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1"
          >
            <Send className="w-3.5 h-3.5" /> Gửi
          </button>
        </form>
      </div>

      {/* Reject Confirmation Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" /> Xác Nhận Từ Chối Đơn
            </h3>
            <p className="text-xs text-slate-500">
              Vui lòng nhập lý do từ chối để thông báo lại cho nhân viên {request.creator?.name}:
            </p>
            <textarea
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối cụ thể..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleAction('REJECT', rejectReason)}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                Xác Nhận Từ Chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Photo Zoom Modal */}
      {previewPhotoModal && (request.paperSlipPhotoUrl || request.data?.paperSlipPhotoUrl) && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Ảnh Chụp Phiếu Xác Nhận Gốc ({request.code})
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhotoModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-2xl p-2">
              <img
                src={request.paperSlipPhotoUrl || request.data?.paperSlipPhotoUrl}
                alt="Phiếu xác nhận gốc"
                className="max-h-[68vh] w-auto object-contain rounded-xl shadow-lg"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 pt-1">
              <div>
                <strong>Người ký xác nhận:</strong> {request.signedByApproverName || 'Bác sĩ / Quản lý chi nhánh'}
                {request.paperSlipCode && ` • Mã phiếu: ${request.paperSlipCode}`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.open(request.paperSlipPhotoUrl || request.data?.paperSlipPhotoUrl, '_blank')}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs"
                >
                  Mở tab mới
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPhotoModal(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
