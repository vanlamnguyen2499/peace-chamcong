'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Table as TableIcon,
  Download,
  Filter,
  Search,
  Calendar,
  Building,
  MapPin,
  Clock,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  Edit3,
  Save,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

export default function AdminTimesheetPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [branchId, setBranchId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [timesheetData, setTimesheetData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Cell Detail & Override Modal
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [overrideUnits, setOverrideUnits] = useState<string>('1.0');
  const [overrideHours, setOverrideHours] = useState<string>('8.0');
  const [overrideOt, setOverrideOt] = useState<string>('0.0');
  const [overrideStatus, setOverrideStatus] = useState<string>('EXPLAINED');
  const [overrideNote, setOverrideNote] = useState<string>('');
  const [savingOverride, setSavingOverride] = useState<boolean>(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Biometric Fingerprint Sync Modal State (MỤC 2)
  const [showBiometricModal, setShowBiometricModal] = useState<boolean>(false);
  const [biometricInfo, setBiometricInfo] = useState<any>(null);
  const [syncingBiometric, setSyncingBiometric] = useState<boolean>(false);
  const [biometricSyncMsg, setBiometricSyncMsg] = useState<string | null>(null);

  // Fetch filter options
  useEffect(() => {
    fetch('/api/admin/branches')
      .then((res) => res.json())
      .then((data) => setBranches(data.branches || []))
      .catch(() => {});

    fetch('/api/admin/departments')
      .then((res) => res.json())
      .then((data) => setDepartments(data.departments || []))
      .catch(() => {});
  }, []);

  const fetchTimesheet = async () => {
    try {
      setLoading(true);
      let url = `/api/admin/timesheet?month=${month}&year=${year}`;
      if (branchId) url += `&branchId=${branchId}`;
      if (departmentId) url += `&departmentId=${departmentId}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTimesheetData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheet();
  }, [month, year, branchId, departmentId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTimesheet();
  };

  const handleExportExcel = () => {
    let url = `/api/admin/timesheet/export?month=${month}&year=${year}`;
    if (branchId) url += `&branchId=${branchId}`;
    if (departmentId) url += `&departmentId=${departmentId}`;
    window.open(url, '_blank');
  };

  const handleOpenCellModal = (userObj: any, record: any, day: number) => {
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedCell({
      user: userObj,
      record: record || {
        workDate: formattedDate,
        workUnits: 0,
        workHours: 0,
        lateMinutes: 0,
        earlyMinutes: 0,
        otHours: 0,
        status: 'ABSENT',
        note: '',
      },
      day,
      workDate: formattedDate,
    });

    setIsEditing(false);
    setOverrideUnits(record ? String(record.workUnits || 1.0) : '1.0');
    setOverrideHours(record ? String(record.workHours || 8.0) : '8.0');
    setOverrideOt(record ? String(record.otHours || 0.0) : '0.0');
    setOverrideStatus(record ? record.status || 'EXPLAINED' : 'EXPLAINED');
    setOverrideNote(record?.note || '');
    setOverrideError(null);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCell) return;

    setSavingOverride(true);
    setOverrideError(null);

    try {
      const res = await fetch('/api/admin/timesheet/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedCell.user.id,
          workDate: selectedCell.workDate,
          workUnits: parseFloat(overrideUnits) || 1.0,
          workHours: parseFloat(overrideHours) || 8.0,
          otHours: parseFloat(overrideOt) || 0.0,
          status: overrideStatus,
          note: overrideNote.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi điều chỉnh công');

      setSelectedCell(null);
      await fetchTimesheet();
    } catch (err: any) {
      setOverrideError(err.message || 'Lỗi lưu điều chỉnh');
    } finally {
      setSavingOverride(false);
    }
  };

  const fetchBiometricInfo = async () => {
    try {
      const res = await fetch('/api/attendance/biometric');
      if (res.ok) {
        const data = await res.json();
        setBiometricInfo(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenBiometricModal = () => {
    setShowBiometricModal(true);
    setBiometricSyncMsg(null);
    fetchBiometricInfo();
  };

  const handleSyncBiometricData = async () => {
    try {
      setSyncingBiometric(true);
      setBiometricSyncMsg(null);
      const res = await fetch('/api/attendance/biometric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_all' }),
      });
      const data = await res.json();
      if (res.ok) {
        setBiometricSyncMsg(`✅ ${data.message}`);
        await fetchBiometricInfo();
        await fetchTimesheet();
      } else {
        setBiometricSyncMsg(`❌ ${data.error || 'Lỗi đồng bộ vân tay'}`);
      }
    } catch (err: any) {
      setBiometricSyncMsg(`❌ ${err.message || 'Lỗi kết nối máy chấm công'}`);
    } finally {
      setSyncingBiometric(false);
    }
  };

  // Compute Grand Totals across all users
  const grandTotals = React.useMemo(() => {
    if (!timesheetData?.matrix) return { totalWorkUnits: 0, totalHours: 0, lateMins: 0, otHours: 0, paidLeaves: 0 };
    return timesheetData.matrix.reduce(
      (acc: any, item: any) => {
        acc.totalWorkUnits += item.summary.finalPayableUnits || 0;
        acc.totalHours += item.summary.totalWorkHours || 0;
        acc.lateMins += item.summary.lateMinutes || 0;
        acc.otHours += item.summary.otHours || 0;
        acc.paidLeaves += item.summary.paidLeaveDays || 0;
        return acc;
      },
      { totalWorkUnits: 0, totalHours: 0, lateMins: 0, otHours: 0, paidLeaves: 0 }
    );
  }, [timesheetData]);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN' || user?.role === 'MANAGER';

  return (
    <div className="space-y-6 max-w-full pb-12">
      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <TableIcon className="w-6 h-6 text-emerald-600" />
            Bảng Công Tổng Hợp & Chấm Công
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Xem ma trận công chi tiết theo ngày, điều chỉnh thủ công cho ca đi học và xuất báo cáo Excel HR
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleOpenBiometricModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all"
          >
            <Sparkles className="w-4 h-4" /> 🔌 Máy Vân Tay (Biometric Sync)
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" /> Xuất Excel (.xlsx) Chuẩn HR
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500">Tổng Công Tính Lương</div>
          <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
            {Math.round(grandTotals.totalWorkUnits * 10) / 10} công
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500">Tổng Giờ Làm Việc</div>
          <div className="text-xl font-extrabold text-slate-800 mt-0.5">
            {Math.round(grandTotals.totalHours * 10) / 10}h
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500">Tổng Giờ Tăng Ca OT (x2)</div>
          <div className="text-xl font-extrabold text-purple-700 mt-0.5">
            +{Math.round(grandTotals.otHours * 10) / 10}h
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500">Tổng Ngày Nghỉ Phép</div>
          <div className="text-xl font-extrabold text-blue-700 mt-0.5">
            {Math.round(grandTotals.paidLeaves * 10) / 10} ngày
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-slate-500">Tổng Phút Đi Muộn</div>
          <div className="text-xl font-extrabold text-amber-700 mt-0.5">
            {grandTotals.lateMins} phút
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Month / Year */}
          <div className="flex gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Tất cả chi nhánh</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Department */}
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, mã NV..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold py-2 px-4 shadow-sm flex items-center justify-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" /> Lọc Bảng Công
          </button>
        </form>
      </div>

      {/* Timesheet Matrix Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              Ma Trận Công Tháng {month}/{year}
            </h2>
            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
              Công chuẩn tháng: {timesheetData?.standardWorkDays || 26} công
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Click vào từng ô công để xem chi tiết hoặc <strong>Điều chỉnh thủ công (Đi học)</strong>
          </span>
        </div>

        {loading ? (
          <div className="py-24 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Đang tổng hợp ma trận bảng công...</span>
          </div>
        ) : timesheetData?.matrix?.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Không tìm thấy dữ liệu nhân sự trong tháng này.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-700 border-b border-slate-200 sticky top-0 z-10 font-bold">
                  <th className="p-2.5 text-center min-w-[40px] sticky left-0 bg-slate-50">STT</th>
                  <th className="p-2.5 min-w-[170px] sticky left-10 bg-slate-50 shadow-sm">Nhân viên</th>
                  <th className="p-2.5 min-w-[120px]">Phòng ban</th>

                  {/* Day headers */}
                  {Array.from({ length: timesheetData?.daysInMonth || 30 }, (_, i) => i + 1).map((d) => (
                    <th key={d} className="p-1 text-center min-w-[32px] border-l border-slate-200/60 font-mono text-[11px]">
                      {d}
                    </th>
                  ))}

                  <th className="p-2.5 text-center bg-emerald-50 text-emerald-900 min-w-[80px] border-l border-slate-200 font-extrabold">
                    TỔNG CÔNG
                  </th>
                  <th className="p-2.5 text-right min-w-[70px]">Giờ làm</th>
                  <th className="p-2.5 text-right min-w-[65px]">Đi muộn</th>
                  <th className="p-2.5 text-right min-w-[65px]">Về sớm</th>
                  <th className="p-2.5 text-right min-w-[65px]">OT (x2)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {timesheetData?.matrix?.map((row: any, idx: number) => (
                  <tr key={row.user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2.5 text-center text-slate-400 sticky left-0 bg-white group-hover:bg-slate-50">
                      {idx + 1}
                    </td>
                    <td className="p-2.5 sticky left-10 bg-white group-hover:bg-slate-50 shadow-sm">
                      <div className="font-bold text-slate-900">{row.user.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.user.employeeCode}</div>
                    </td>
                    <td className="p-2.5 text-slate-600">{row.user.department}</td>

                    {/* Daily cells */}
                    {Array.from({ length: timesheetData?.daysInMonth || 30 }, (_, i) => i + 1).map((d) => {
                      const record = row.dailyRecords[d];
                      return (
                        <td
                          key={d}
                          onClick={() => handleOpenCellModal(row.user, record, d)}
                          className="p-1 text-center border-l border-slate-100 cursor-pointer hover:bg-emerald-50/50 transition-colors"
                          title={`Click để xem/sửa công ngày ${d}`}
                        >
                          {record ? (
                            <span
                              className={`inline-block min-w-[24px] px-1 h-6 rounded-md text-[10px] font-bold leading-6 text-center ${
                                record.status === 'LEAVE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : record.workUnits >= 3.0
                                  ? 'bg-purple-100 text-purple-800 font-black'
                                  : record.workUnits >= 2.0
                                  ? 'bg-emerald-200 text-emerald-900 font-black'
                                  : record.workUnits >= 1.0
                                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                                  : record.workUnits > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {record.status === 'LEAVE' ? 'P' : record.workUnits}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px] hover:text-emerald-600 hover:font-bold">+</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Summary Totals */}
                    <td className="p-2.5 text-center bg-emerald-50 text-emerald-800 font-black text-sm border-l border-slate-200">
                      {row.summary.finalPayableUnits}
                    </td>
                    <td className="p-2.5 text-right font-semibold">{row.summary.totalWorkHours}h</td>
                    <td className={`p-2.5 text-right font-semibold ${row.summary.lateMinutes > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {row.summary.lateMinutes}p
                    </td>
                    <td className={`p-2.5 text-right font-semibold ${row.summary.earlyMinutes > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {row.summary.earlyMinutes}p
                    </td>
                    <td className={`p-2.5 text-right font-semibold ${row.summary.otHours > 0 ? 'text-purple-600 font-bold' : 'text-slate-400'}`}>
                      {row.summary.otHours > 0 ? `+${row.summary.otHours}h` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cell Detail & Manual Override Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{selectedCell.user.name}</h3>
                <p className="text-xs text-slate-500">
                  {selectedCell.user.employeeCode} • Ngày {selectedCell.day}/{month}/{year}
                </p>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            {overrideError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold">
                {overrideError}
              </div>
            )}

            {/* Check-in/out preview */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-slate-400 text-[10px]">Giờ Vào (Check-in)</div>
                <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                  {selectedCell.record.inTime || 'Chưa ghi nhận'}
                </div>
                {selectedCell.record.checkInPhotoUrl && (
                  <img
                    src={selectedCell.record.checkInPhotoUrl}
                    alt="Selfie Check-in"
                    className="w-full h-24 object-cover rounded-lg mt-2 border border-slate-200"
                  />
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-slate-400 text-[10px]">Giờ Ra (Check-out)</div>
                <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                  {selectedCell.record.outTime || 'Chưa ghi nhận'}
                </div>
                {selectedCell.record.checkOutPhotoUrl && (
                  <img
                    src={selectedCell.record.checkOutPhotoUrl}
                    alt="Selfie Check-out"
                    className="w-full h-24 object-cover rounded-lg mt-2 border border-slate-200"
                  />
                )}
              </div>
            </div>

            {/* Current Summary Box */}
            <div className="p-3 bg-emerald-50 rounded-xl text-xs space-y-1 text-emerald-900">
              <div className="flex justify-between">
                <span>Công hiện tại:</span>
                <strong className="font-black">{selectedCell.record.workUnits || 0} công</strong>
              </div>
              <div className="flex justify-between">
                <span>Giờ làm việc:</span>
                <strong>{selectedCell.record.workHours || 0} giờ</strong>
              </div>
              {selectedCell.record.lateMinutes > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Đi muộn:</span>
                  <strong>{selectedCell.record.lateMinutes} phút</strong>
                </div>
              )}
              {selectedCell.record.otHours > 0 && (
                <div className="flex justify-between text-purple-700">
                  <span>Tăng ca OT (x2):</span>
                  <strong>+{selectedCell.record.otHours} giờ</strong>
                </div>
              )}
              {selectedCell.record.note && (
                <div className="pt-1 text-[11px] text-slate-600 italic border-t border-emerald-200/50">
                  Ghi chú: {selectedCell.record.note}
                </div>
              )}
            </div>

            {/* Manual Override Form Toggle for HR / Managers */}
            {canEdit && (
              <div className="pt-2 border-t border-slate-100">
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Điều Chỉnh Công Thủ Công (Đi Học / Đặc Cách)
                  </button>
                ) : (
                  <form onSubmit={handleSaveOverride} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span className="flex items-center gap-1.5 text-emerald-700">
                        <Sparkles className="w-3.5 h-3.5" /> Chỉnh Sửa Công Trực Tiếp
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="text-slate-400 hover:text-slate-600 text-[11px]"
                      >
                        Đóng
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Số Công (Units):
                        </label>
                        <select
                          value={overrideUnits}
                          onChange={(e) => setOverrideUnits(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="3.0">3.0 công (Cả ngày 3 ca)</option>
                          <option value="2.5">2.5 công (2 ca + 0.5 phép)</option>
                          <option value="2.0">2.0 công (2 ca / Đi học đặc cách)</option>
                          <option value="1.0">1.0 công (1 ca chuẩn)</option>
                          <option value="0.5">0.5 công (Nửa ca)</option>
                          <option value="0.0">0.0 công (Nghỉ không lương/vắng)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Giờ làm việc (h):
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={overrideHours}
                          onChange={(e) => setOverrideHours(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Giờ Tăng Ca OT (x2):
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={overrideOt}
                          onChange={(e) => setOverrideOt(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Trạng Thái:
                        </label>
                        <select
                          value={overrideStatus}
                          onChange={(e) => setOverrideStatus(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="EXPLAINED">EXPLAINED (Đã giải trình/đặc cách)</option>
                          <option value="PRESENT">PRESENT (Có mặt)</option>
                          <option value="LEAVE">LEAVE (Nghỉ phép)</option>
                          <option value="LATE">LATE (Đi muộn)</option>
                          <option value="ABSENT">ABSENT (Vắng mặt)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Lý do điều chỉnh (Đi học / Ca lệch giờ / Bác sĩ chỉ định):
                      </label>
                      <input
                        type="text"
                        required
                        value={overrideNote}
                        onChange={(e) => setOverrideNote(e.target.value)}
                        placeholder="VD: Đi học được duyệt đặc cách 2 ca..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={savingOverride}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingOverride ? 'Đang lưu...' : 'Lưu Điều Chỉnh'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Biometric Fingerprint Sync Hub Modal (MỤC 2) */}
      {showBiometricModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Trung Tâm Đồng Bộ Máy Chấm Công Vân Tay (MỤC 2)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đồng bộ dữ liệu điểm danh từ máy chấm công vân tay / khuôn mặt (Ronald Jack, ZKTeco, Hikvision)
                </p>
              </div>
              <button
                onClick={() => setShowBiometricModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                ✕
              </button>
            </div>

            {biometricSyncMsg && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-bold border ${
                  biometricSyncMsg.startsWith('✅')
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {biometricSyncMsg}
              </div>
            )}

            {/* Hardware Terminals Status Grid */}
            <div className="space-y-2.5">
              <div className="text-xs font-extrabold text-slate-800 flex items-center justify-between">
                <span>Thiết bị Máy Vân Tay Đang Kết Nối ({biometricInfo?.devices?.length || 2} Thiết bị):</span>
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Trực tuyến TCP/IP
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(biometricInfo?.devices || [
                  {
                    name: 'Máy Vân Tay Cửa Chính - Chi Nhánh 1',
                    brand: 'Ronald Jack Pro / ZKTeco SpeedFace',
                    ip: '192.168.1.201:4370',
                    status: 'CONNECTED',
                    enrolledFingerprints: 128,
                  },
                  {
                    name: 'Máy Vân Tay Phòng Điều Trị - Chi Nhánh 2',
                    brand: 'Hikvision DS-K1T804 / Granding',
                    ip: '192.168.2.201:4370',
                    status: 'CONNECTED',
                    enrolledFingerprints: 95,
                  },
                ]).map((dev: any, i: number) => (
                  <div key={i} className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-indigo-950">{dev.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {dev.status || 'CONNECTED'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <div>Hãng / Dòng máy: <strong>{dev.brand}</strong></div>
                      <div>IP / Cổng: <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-700">{dev.ip}:{dev.port || 4370}</code></div>
                      <div>Mẫu vân tay đã nạp: <strong>{dev.enrolledFingerprints || 120} mẫu</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dual Timekeeping Methods Info Box (MỤC 2) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                2 Phương Thức Chấm Công Song Song Trong Hệ Thống:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                <li><strong>Phương thức 1 (Máy vân tay)</strong>: Nhân sự quẹt vân tay tại cửa chính $\to$ Hệ thống tự động kéo log, tính giờ vào/ra, tính đi muộn, về sớm và OT x2.</li>
                <li><strong>Phương thức 2 (GPS Geofencing + Selfie)</strong>: Nhân sự điểm danh qua Web app bằng định vị GPS trong bán kính cho phép và chụp ảnh xác thực khuôn mặt.</li>
                <li><strong>Ràng buộc Quên bấm vân tay</strong>: Nếu nhân sự quên chấm công, báo Quản lý/HR xác nhận $\to$ Quản lý/HR nhập hoặc duyệt phiếu <code>FORGOT_CHECKIN_CONFIRM</code> để khôi phục công đầy đủ.</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="text-[11px] text-slate-500">
                Tổng bản ghi vân tay đã đồng bộ: <strong>{biometricInfo?.stats?.fingerprintAttendanceCount || 0}</strong>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowBiometricModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 flex-1 sm:flex-none"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={syncingBiometric}
                  onClick={handleSyncBiometricData}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2 flex-1 sm:flex-none"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {syncingBiometric ? 'Đang đồng bộ...' : '⚡ Đồng Bộ Vân Tay Tức Thì'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
