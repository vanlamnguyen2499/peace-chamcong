'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, XCircle, CheckSquare, Square, Search, RefreshCw, Check, ArrowRight, User, Building2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function DeleteRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/approvals/delete-requests');
      const data = await res.json();
      if (res.ok) {
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    let dataStr = '';
    try {
      const parsed = JSON.parse(req.data || '{}');
      dataStr = (parsed.reason || parsed.purpose || '').toLowerCase();
    } catch (e) {}

    return (
      req.code.toLowerCase().includes(term) ||
      req.template?.name?.toLowerCase().includes(term) ||
      req.creator?.name?.toLowerCase().includes(term) ||
      req.creator?.employeeCode?.toLowerCase().includes(term) ||
      dataStr.includes(term)
    );
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRequests.length) setSelectedIds([]);
    else setSelectedIds(filteredRequests.map((r) => r.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleAction = async (isApprove: boolean, specificId?: string) => {
    const ids = specificId ? [specificId] : selectedIds;
    if (ids.length === 0) return;
    const actionName = isApprove ? 'ĐỒNG Ý XÓA (Hoàn tác công & phép)' : 'TỪ CHỐI XÓA (Khôi phục phiếu)';
    if (!confirm(`Bạn chắc chắn muốn ${actionName} cho ${ids.length} phiếu đã chọn?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/approvals/delete-requests', {
        method: isApprove ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestIds: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
        fetchRequests();
      } else {
        alert(data.error || 'Có lỗi xảy ra');
      }
    } catch (e) {
      alert('Lỗi kết nối máy chủ');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-100 text-rose-700 rounded-2xl">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Kiểm Duyệt Xóa Phiếu Hàng Loạt
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Dành cho <strong>Quản Lý &amp; Admin</strong> phê duyệt các phiếu nhân sự yêu cầu xóa do nhập nhầm
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchRequests}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 shadow-sm flex items-center gap-2 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-400'}`} />
          Làm mới ({requests.length})
        </button>
      </div>

      {/* Workflow Guidance Card */}
      <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-200 rounded-2xl p-4 text-xs text-slate-700 space-y-1">
        <div className="font-bold text-amber-900 flex items-center gap-1.5">
          <span>💡 Quy trình kiểm soát &amp; bảo toàn dữ liệu chấm công:</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          1. <strong>Nhập phiếu:</strong> Nhân sự nhập phiếu lên sẽ được tự động duyệt và tính công ngay vào Bảng công.<br />
          2. <strong>Xác nhận xóa nhầm:</strong> Khi phát hiện nhập nhầm, Nhân sự bấm &quot;Xóa phiếu&quot; để gửi yêu cầu vào danh sách chờ xác nhận này.<br />
          3. <strong>Duyệt xóa:</strong> Quản lý / Admin kiểm tra, tích chọn hàng loạt và duyệt xóa. Hệ thống sẽ <strong>tự động hoàn tác công &amp; hoàn lại quỹ phép</strong> tương ứng.
        </p>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="p-1 text-slate-500 hover:text-slate-700 flex items-center gap-2 text-xs font-bold"
              title="Chọn tất cả"
            >
              {selectedIds.length === filteredRequests.length && filteredRequests.length > 0 ? (
                <CheckSquare className="w-5 h-5 text-emerald-600" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
              <span>Chọn tất cả</span>
            </button>
            <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              Đã chọn: <span className="text-rose-600 font-extrabold">{selectedIds.length}</span> / {filteredRequests.length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã phiếu, nhân sự, lý do..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            {/* Batch Action Buttons */}
            <button
              onClick={() => handleAction(false)}
              disabled={selectedIds.length === 0 || actionLoading}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <XCircle className="w-3.5 h-3.5 text-slate-500" /> Từ chối Xóa ({selectedIds.length})
            </button>
            <button
              onClick={() => handleAction(true)}
              disabled={selectedIds.length === 0 || actionLoading}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-sm shadow-rose-600/20"
            >
              <Trash2 className="w-3.5 h-3.5" /> Duyệt Xóa Đồng Loạt ({selectedIds.length})
            </button>
          </div>
        </div>

        {/* Table list */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-12 text-center">Chọn</th>
                <th className="px-4 py-3">Mã Phiếu</th>
                <th className="px-4 py-3">Loại Phiếu</th>
                <th className="px-4 py-3">Nhân Sự Được Tính Công</th>
                <th className="px-4 py-3">Nội Dung / Lý Do</th>
                <th className="px-4 py-3">Thời Gian Gửi Xóa</th>
                <th className="px-4 py-3 text-right">Thao Tác Nhanh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <span className="inline-block w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mr-2 align-middle" />
                    Đang tải danh sách phiếu chờ xóa...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    🎉 Không có phiếu nào đang chờ xác nhận xóa.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  let parsedData: any = {};
                  try {
                    parsedData = JSON.parse(req.data || '{}');
                  } catch (e) {}

                  const isSelected = selectedIds.includes(req.id);

                  return (
                    <tr
                      key={req.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-rose-50/50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleSelect(req.id)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        <Link href={`/approvals/${req.id}`} className="hover:text-emerald-600 hover:underline">
                          {req.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-bold border border-slate-200">
                          {req.template?.name || 'Phiếu'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-400" />
                          {req.creator?.name}
                          <span className="font-mono text-slate-400 font-normal">({req.creator?.employeeCode})</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                          {req.creator?.department?.name && <span>Phòng: {req.creator.department.name}</span>}
                          {req.creator?.branch?.name && <span>• {req.creator.branch.name}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs truncate text-slate-700 font-medium" title={parsedData.reason || parsedData.purpose || 'Không có ghi chú'}>
                          {parsedData.reason || parsedData.purpose || 'Nhân sự xác nhận xóa do nhập nhầm'}
                        </div>
                        <div className="text-[10px] text-rose-600 mt-0.5 font-bold">
                          {parsedData.workDate && `Ngày công: ${parsedData.workDate}`}
                          {parsedData.startDate && ` (Từ: ${parsedData.startDate} ~ ${parsedData.endDate || ''})`}
                          {parsedData.duration && ` [${parsedData.duration} ngày]`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {format(new Date(req.updatedAt || req.createdAt), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAction(false, req.id)}
                            disabled={actionLoading}
                            title="Từ chối xóa, giữ lại phiếu"
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            Từ Chối
                          </button>
                          <button
                            onClick={() => handleAction(true, req.id)}
                            disabled={actionLoading}
                            title="Đồng ý xóa và hoàn tác công/phép"
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
                          >
                            Duyệt Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
