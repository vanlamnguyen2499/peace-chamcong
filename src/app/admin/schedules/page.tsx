'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  Users,
  Calendar as CalendarIcon,
  User,
  ChevronLeft,
  ChevronRight,
  Clock,
  Trash2,
  Sparkles,
  Building,
  Briefcase,
  AlertCircle,
  Filter,
  Check,
} from 'lucide-react';
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';

export default function AdminSchedulesPage() {
  const [activeTab, setActiveTab] = useState<'individual' | 'batch'>('individual');

  // Master data
  const [users, setUsers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Tab 1: Individual State ---
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [userSchedules, setUserSchedules] = useState<Record<string, any>>({}); // key: 'yyyy-MM-dd' -> schedule object
  const [quickShiftId, setQuickShiftId] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [individualBranchFilter, setIndividualBranchFilter] = useState('');
  const [individualDeptFilter, setIndividualDeptFilter] = useState('');

  // --- Tab 2: Batch State ---
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-28'));
  const [excludeSundays, setExcludeSundays] = useState<boolean>(true);

  // Load master data
  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => {
        const uList = d.users || [];
        setUsers(uList);
        if (uList.length > 0) {
          setSelectedUserId(uList[0].id);
          setSelectedUserIds(uList.map((u: any) => u.id));
        }
      });

    fetch('/api/admin/shifts')
      .then((r) => r.json())
      .then((d) => {
        const sList = d.shifts || [];
        setShifts(sList);
        if (sList.length > 0) {
          setSelectedShiftId(sList[0].id);
          setQuickShiftId(sList[0].id);
        }
      });

    fetch('/api/admin/branches')
      .then((r) => r.json())
      .then((d) => setBranches(d.branches || []));

    fetch('/api/admin/departments')
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments || []));
  }, []);

  // Fetch individual user schedules whenever userId, month, or year changes
  const fetchUserSchedules = async () => {
    if (!selectedUserId) return;
    try {
      const padMonth = String(currentMonth).padStart(2, '0');
      const res = await fetch(
        `/api/admin/schedules?userId=${selectedUserId}&month=${padMonth}&year=${currentYear}`
      );
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = {};
        (data.schedules || []).forEach((sch: any) => {
          map[sch.workDate] = sch;
        });
        setUserSchedules(map);
      }
    } catch (err) {
      console.error('Lỗi tải lịch cá nhân:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'individual' && selectedUserId) {
      fetchUserSchedules();
    }
  }, [selectedUserId, currentMonth, currentYear, activeTab]);

  // Selected user details
  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId);
  }, [users, selectedUserId]);

  // Filtered users for individual dropdown/picker
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (individualBranchFilter && u.branchId !== individualBranchFilter) return false;
      if (individualDeptFilter && u.departmentId !== individualDeptFilter) return false;
      if (userSearch) {
        const q = userSearch.toLowerCase();
        const matchName = u.name?.toLowerCase().includes(q);
        const matchCode = u.employeeCode?.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [users, individualBranchFilter, individualDeptFilter, userSearch]);

  // Monthly statistics for selected user
  const monthlyStats = useMemo(() => {
    const padMonth = String(currentMonth).padStart(2, '0');
    const totalDays = getDaysInMonth(new Date(currentYear, currentMonth - 1));
    let assignedDays = 0;
    let totalWorkUnits = 0;
    let offDays = 0;

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${currentYear}-${padMonth}-${String(day).padStart(2, '0')}`;
      const sch = userSchedules[dateStr];
      if (sch) {
        if (sch.isOffDay) {
          offDays++;
        } else if (sch.shift) {
          assignedDays++;
          totalWorkUnits += sch.shift.workUnits || 1;
        }
      }
    }

    return {
      totalDays,
      assignedDays,
      totalWorkUnits,
      offDays,
      unassignedDays: totalDays - assignedDays - offDays,
    };
  }, [userSchedules, currentMonth, currentYear]);

  // Handle shift update for single day
  const handleAssignSingleDay = async (dateStr: string, shiftId: string | null, isOffDay = false) => {
    if (!selectedUserId) return;
    try {
      const res = await fetch('/api/admin/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          workDate: dateStr,
          shiftId: isOffDay ? null : shiftId,
          isOffDay,
        }),
      });

      if (res.ok) {
        await fetchUserSchedules();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi cập nhật lịch');
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi kết nối máy chủ');
    }
  };

  // Quick batch apply for selected user
  const handleQuickApplyUser = async (mode: 'WEEKDAYS' | 'ALL_DAYS' | 'WEEKENDS' | 'CLEAR') => {
    if (!selectedUserId) return;
    if (mode !== 'CLEAR' && !quickShiftId) {
      alert('Vui lòng chọn ca làm việc để gán nhanh');
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const padMonth = String(currentMonth).padStart(2, '0');
      const totalDays = getDaysInMonth(new Date(currentYear, currentMonth - 1));

      for (let day = 1; day <= totalDays; day++) {
        const dateObj = new Date(currentYear, currentMonth - 1, day);
        const dayOfWeek = getDay(dateObj); // 0: Sunday, 1: Mon, ..., 6: Sat
        const dateStr = `${currentYear}-${padMonth}-${String(day).padStart(2, '0')}`;

        let shouldApply = false;
        if (mode === 'ALL_DAYS') shouldApply = true;
        if (mode === 'WEEKDAYS' && dayOfWeek !== 0) shouldApply = true; // Mon-Sat
        if (mode === 'WEEKENDS' && (dayOfWeek === 0 || dayOfWeek === 6)) shouldApply = true; // Sat-Sun
        if (mode === 'CLEAR') shouldApply = true;

        if (shouldApply) {
          if (mode === 'CLEAR') {
            await fetch(`/api/admin/schedules?userId=${selectedUserId}&workDate=${dateStr}`, {
              method: 'DELETE',
            });
          } else {
            await fetch('/api/admin/schedules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: selectedUserId,
                workDate: dateStr,
                shiftId: quickShiftId,
                isOffDay: false,
              }),
            });
          }
        }
      }

      await fetchUserSchedules();
      setFeedback({
        type: 'success',
        text:
          mode === 'CLEAR'
            ? 'Đã xóa toàn bộ lịch trong tháng này!'
            : 'Đã gán nhanh ca làm việc thành công!',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Lỗi áp dụng lịch' });
    } finally {
      setLoading(false);
    }
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // --- Tab 2: Batch Scheduling ---
  const handleBatchSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0 || !selectedShiftId) {
      alert('Vui lòng chọn ít nhất 1 nhân viên và 1 ca làm việc');
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/schedules/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedUserIds,
          shiftId: selectedShiftId,
          startDate,
          endDate,
          excludeSundays,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi phân ca');

      setFeedback({ type: 'success', text: data.message || 'Đã phân ca hàng loạt thành công!' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Lỗi phân ca hàng loạt' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  // Helper styling for shift badge
  const getShiftBadge = (sch: any) => {
    if (!sch) {
      return (
        <span className="text-[10px] text-slate-400 font-medium italic block text-center py-1">
          Chưa xếp ca
        </span>
      );
    }
    if (sch.isOffDay) {
      return (
        <div className="bg-slate-100 text-slate-600 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-[10px]">
          🏖️ Nghỉ (OFF)
        </div>
      );
    }
    const s = sch.shift;
    if (!s) return null;

    let colorCls = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (s.code === 'CA_1_SANG' || s.code === 'CA_SANG') {
      colorCls = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (s.code === 'CA_2_CHIEU' || s.code === 'CA_CHIEU') {
      colorCls = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (s.code === 'CA_3_TOI') {
      colorCls = 'bg-purple-50 text-purple-700 border-purple-200';
    } else if (s.code === 'CA_ALL_DAY') {
      colorCls = 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-300';
    } else if (s.code?.startsWith('CA_CN')) {
      colorCls = 'bg-teal-50 text-teal-700 border-teal-200';
    }

    return (
      <div className={`${colorCls} border rounded-lg px-1.5 py-1 text-center shadow-xs`}>
        <div className="font-extrabold text-[11px] truncate">{s.name}</div>
        <div className="text-[9px] opacity-80 mt-0.5">
          {s.startTime}-{s.endTime} ({s.workUnits} công)
        </div>
      </div>
    );
  };

  // Build calendar grid days
  const calendarCells = useMemo(() => {
    const totalDays = getDaysInMonth(new Date(currentYear, currentMonth - 1));
    const padMonth = String(currentMonth).padStart(2, '0');
    const firstDayOfWeek = getDay(new Date(currentYear, currentMonth - 1, 1)); // 0: Sun, 1: Mon...
    // Offset for Mon-start calendar (0: Mon, 1: Tue, ..., 6: Sun)
    const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const cells: { type: 'empty' | 'day'; day?: number; dateStr?: string; isSunday?: boolean }[] = [];

    // Leading empty cells
    for (let i = 0; i < offset; i++) {
      cells.push({ type: 'empty' });
    }

    // Actual month days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentYear}-${padMonth}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = getDay(new Date(currentYear, currentMonth - 1, d));
      cells.push({
        type: 'day',
        day: d,
        dateStr,
        isSunday: dayOfWeek === 0,
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Quản Lý Phân Ca &amp; Xếp Lịch Trực Peace Dentistry</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Xếp Ca &amp; Lịch Làm Việc Nhân Sự
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed">
              Xếp ca trực quan từng ngày cho từng Bác sĩ / Nhân viên hoặc phân ca hàng loạt theo chi nhánh, phòng ban.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('individual')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'individual'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <User className="w-4 h-4" />
              👤 Xếp Ca Từng Người (Lịch Cá Nhân)
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'batch'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              👥 Xếp Ca Hàng Loạt (Nhóm / Chi Nhánh)
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: XẾP CA TỪNG NGƯỜI (INDIVIDUAL CALENDAR VIEW) */}
      {/* ========================================================================= */}
      {activeTab === 'individual' && (
        <div className="space-y-6">
          {/* Top Control Bar: User Selector & Month Navigator */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* User Selection */}
            <div className="lg:col-span-6 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-600" />
                1. Chọn Nhân Sự Cần Xếp Ca
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.employeeCode}) - {u.department?.name || 'Phòng ban'} ({u.branch?.name || 'Chi nhánh'})
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  <select
                    value={individualBranchFilter}
                    onChange={(e) => setIndividualBranchFilter(e.target.value)}
                    className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700"
                  >
                    <option value="">Tất cả CN</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={individualDeptFilter}
                    onChange={(e) => setIndividualDeptFilter(e.target.value)}
                    className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700"
                  >
                    <option value="">Tất cả Khoa</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedUser && (
                <div className="text-[11px] text-slate-500 flex items-center gap-3 pt-1">
                  <span className="font-semibold text-slate-800">
                    Mã NV: <strong className="font-mono text-emerald-700">{selectedUser.employeeCode}</strong>
                  </span>
                  <span>•</span>
                  <span>{selectedUser.department?.name || 'Chưa có phòng ban'}</span>
                  <span>•</span>
                  <span>{selectedUser.branch?.name || 'Chưa xếp chi nhánh'}</span>
                </div>
              )}
            </div>

            {/* Month & Year Navigator */}
            <div className="lg:col-span-6 flex flex-col sm:flex-row sm:items-center justify-end gap-4">
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-white rounded-xl text-slate-600 transition-all"
                  title="Tháng trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="px-3 text-center">
                  <div className="text-xs font-black text-slate-900">
                    Tháng {String(currentMonth).padStart(2, '0')} / {currentYear}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">Lịch làm việc cá nhân</div>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-white rounded-xl text-slate-600 transition-all"
                  title="Tháng sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Quick monthly summary pills */}
              <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-200 rounded-2xl p-2.5">
                <div className="text-center px-2 border-r border-emerald-200">
                  <div className="text-[10px] text-emerald-700 font-bold uppercase">Ngày Có Ca</div>
                  <div className="text-sm font-black text-emerald-900">
                    {monthlyStats.assignedDays} / {monthlyStats.totalDays}
                  </div>
                </div>
                <div className="text-center px-2">
                  <div className="text-[10px] text-emerald-700 font-bold uppercase">Tổng Công</div>
                  <div className="text-sm font-black text-emerald-900">
                    {monthlyStats.totalWorkUnits} công
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Bar for Selected User */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Thao tác nhanh cho tháng {currentMonth}/{currentYear}:
              </span>

              <select
                value={quickShiftId}
                onChange={(e) => setQuickShiftId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-indigo-900"
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime}-{s.endTime} = {s.workUnits} công)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickApplyUser('WEEKDAYS')}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-all flex items-center gap-1"
                title="Gán ca này cho tất cả ngày từ Thứ 2 đến Thứ 7 trong tháng"
              >
                📅 Gán T2 - T7
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickApplyUser('ALL_DAYS')}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition-all flex items-center gap-1"
                title="Gán ca này cho toàn bộ các ngày trong tháng"
              >
                🌟 Gán Cả Tháng
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickApplyUser('CLEAR')}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all flex items-center gap-1"
                title="Xóa toàn bộ lịch ca của nhân sự này trong tháng"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa Lịch Tháng
              </button>
            </div>
          </div>

          {/* Visual 31-Day Calendar Grid */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-emerald-600" />
                Lưới Phân Ca Tháng {currentMonth}/{currentYear} - {selectedUser?.name}
              </h2>
              <span className="text-[11px] text-slate-400">
                💡 Bấm vào ô bất kỳ để đổi ca làm việc trực tiếp 1-click
              </span>
            </div>

            {/* 7-column Calendar Header */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
              <div className="py-1">Thứ 2</div>
              <div className="py-1">Thứ 3</div>
              <div className="py-1">Thứ 4</div>
              <div className="py-1">Thứ 5</div>
              <div className="py-1">Thứ 6</div>
              <div className="py-1 text-indigo-600">Thứ 7</div>
              <div className="py-1 text-rose-600">Chủ Nhật</div>
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell, idx) => {
                if (cell.type === 'empty') {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[105px] bg-slate-50/40 rounded-2xl border border-dashed border-slate-200/60"
                    />
                  );
                }

                const dateStr = cell.dateStr!;
                const sch = userSchedules[dateStr];
                const isSunday = cell.isSunday;

                return (
                  <div
                    key={dateStr}
                    className={`min-h-[105px] rounded-2xl p-2.5 border flex flex-col justify-between transition-all ${
                      isSunday
                        ? 'bg-rose-50/30 border-rose-100 hover:border-rose-300'
                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                    }`}
                  >
                    {/* Cell Date Header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                          isSunday
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {cell.day}
                      </span>

                      {sch && (
                        <button
                          type="button"
                          onClick={() => handleAssignSingleDay(dateStr, null, false)}
                          className="text-slate-300 hover:text-rose-500 transition-colors p-0.5"
                          title="Xóa ca ngày này"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Assigned Shift Badge */}
                    <div className="my-auto">{getShiftBadge(sch)}</div>

                    {/* Quick 1-click select shift dropdown */}
                    <div className="mt-1.5 pt-1 border-t border-slate-100">
                      <select
                        value={sch?.isOffDay ? 'OFF' : sch?.shiftId || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            handleAssignSingleDay(dateStr, null, false);
                          } else if (val === 'OFF') {
                            handleAssignSingleDay(dateStr, null, true);
                          } else {
                            handleAssignSingleDay(dateStr, val, false);
                          }
                        }}
                        className="w-full text-[10px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md py-0.5 px-1 font-semibold text-slate-700 cursor-pointer focus:outline-none"
                      >
                        <option value="">-- Chưa ca --</option>
                        <option value="OFF">🏖️ Nghỉ (OFF)</option>
                        {shifts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.startTime}-{s.endTime})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: XẾP CA HÀNG LOẠT (BATCH SCHEDULING FORM) */}
      {/* ========================================================================= */}
      {activeTab === 'batch' && (
        <form
          onSubmit={handleBatchSchedule}
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6"
        >
          {/* Step 1: Time range */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-emerald-600" />
              1. Khoảng Thời Gian Áp Dụng
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Từ ngày</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Đến ngày</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeSundays}
                onChange={(e) => setExcludeSundays(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <span>Bỏ qua Chủ Nhật (Không xếp ca ngày nghỉ tuần)</span>
            </label>
          </div>

          {/* Step 2: Choose Shift */}
          <div className="pt-4 border-t border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              2. Chọn Ca Làm Việc Cần Gán
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {shifts.map((s) => (
                <label
                  key={s.id}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer flex flex-col justify-between transition-all ${
                    selectedShiftId === s.id
                      ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 shadow-sm ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">{s.name}</span>
                    <input
                      type="radio"
                      name="shift"
                      value={s.id}
                      checked={selectedShiftId === s.id}
                      onChange={() => setSelectedShiftId(s.id)}
                      className="text-emerald-600"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {s.startTime} - {s.endTime} ({s.workUnits} công)
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Step 3: Choose Users */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                3. Chọn Nhân Sự Áp Dụng ({selectedUserIds.length}/{users.length})
              </h2>

              <div className="flex items-center gap-2">
                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700"
                >
                  <option value="">Tất cả Chi nhánh</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700"
                >
                  <option value="">Tất cả Phòng ban</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const displayedIds = users
                      .filter(
                        (u) =>
                          (!filterBranch || u.branchId === filterBranch) &&
                          (!filterDept || u.departmentId === filterDept)
                      )
                      .map((u) => u.id);
                    const allSelected = displayedIds.every((id) => selectedUserIds.includes(id));
                    if (allSelected) {
                      setSelectedUserIds((prev) => prev.filter((id) => !displayedIds.includes(id)));
                    } else {
                      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...displayedIds])));
                    }
                  }}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 whitespace-nowrap"
                >
                  Chọn / Bỏ nhóm này
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {users
                .filter(
                  (u) =>
                    (!filterBranch || u.branchId === filterBranch) &&
                    (!filterDept || u.departmentId === filterDept)
                )
                .map((u) => (
                  <label
                    key={u.id}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-all ${
                      selectedUserIds.includes(u.id)
                        ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 font-semibold'
                        : 'border-slate-100 bg-slate-50/60 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={() => handleToggleUser(u.id)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="truncate">
                      <div className="font-bold truncate">{u.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {u.employeeCode} - {u.department?.name || 'Chưa xếp'} (
                        {u.branch?.name || 'Chi nhánh'})
                      </div>
                    </div>
                  </label>
                ))}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Đang phân ca...' : 'Áp Dụng Phân Ca Hàng Loạt'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
