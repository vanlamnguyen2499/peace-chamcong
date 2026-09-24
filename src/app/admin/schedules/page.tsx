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
  Zap,
  Save,
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
  const [weeklySchedule, setWeeklySchedule] = useState<any>(null);
  const [saveAsWeeklyPattern, setSaveAsWeeklyPattern] = useState<boolean>(true);
  const [quickShiftId, setQuickShiftId] = useState<string>('');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5, 6]); // Mặc định T2 -> T7
  const [userSearch, setUserSearch] = useState('');
  const [individualBranchFilter, setIndividualBranchFilter] = useState('');
  const [individualDeptFilter, setIndividualDeptFilter] = useState('');

  // --- Flexible Sunday State ---
  const [flexSundayEnabled, setFlexSundayEnabled] = useState(false);
  const [flexSundayShiftId, setFlexSundayShiftId] = useState('');
  const [flexSundayShiftsCount, setFlexSundayShiftsCount] = useState<number>(2);

  // --- Tab 2: Batch State ---
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [weekdayShifts, setWeekdayShifts] = useState<number>(3);
  const [sundayShifts, setSundayShifts] = useState<number>(2);

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
        setWeeklySchedule(data.weeklySchedule || null);
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

  // Synchronize flexible Sunday state with weeklySchedule
  useEffect(() => {
    if (weeklySchedule?.sundayFlexible) {
      setFlexSundayEnabled(Boolean(weeklySchedule.sundayFlexible.enabled));
      setFlexSundayShiftId(weeklySchedule.sundayFlexible.shiftId || (shifts[0]?.id || ''));
      setFlexSundayShiftsCount(Number(weeklySchedule.sundayFlexible.shiftsCount) || 2);
    } else {
      setFlexSundayEnabled(false);
      setFlexSundayShiftId(shifts[0]?.id || '');
      setFlexSundayShiftsCount(2);
    }
  }, [weeklySchedule, shifts]);

  // Filtered users for individual dropdown/picker
  const filteredUsers = useMemo(() => {
    const list = users.filter((u) => {
      if (individualBranchFilter && u.branchId !== individualBranchFilter && u.branch?.id !== individualBranchFilter) return false;
      if (individualDeptFilter && u.departmentId !== individualDeptFilter && u.department?.id !== individualDeptFilter) return false;
      if (userSearch) {
        const q = userSearch.toLowerCase();
        const matchName = u.name?.toLowerCase().includes(q);
        const matchCode = u.employeeCode?.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const deptA = a.department?.name || 'ZZZ';
      const deptB = b.department?.name || 'ZZZ';
      const deptComp = deptA.localeCompare(deptB, 'vi');
      if (deptComp !== 0) return deptComp;
      return (a.name || '').localeCompare(b.name || '', 'vi');
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
        } else if (sch.isSundayFlexible) {
          // Handled separately from weekly flexible quota below
        } else if (sch.shift) {
          assignedDays++;
          totalWorkUnits += sch.shift.workUnits || 1;
        }
      }
    }

    // If sundayFlexible is enabled on weekly pattern, add the flexible Sunday quota
    if (weeklySchedule?.sundayFlexible?.enabled) {
      const flexCount = Number(weeklySchedule.sundayFlexible.shiftsCount) || 0;
      const flexShift = shifts.find(
        (s) =>
          s.id === weeklySchedule.sundayFlexible.shiftId ||
          s.code === weeklySchedule.sundayFlexible.shiftId
      );
      const flexUnits = flexShift ? flexShift.workUnits || 1 : 1;
      totalWorkUnits += flexCount * flexUnits;
      assignedDays += flexCount;
    }

    return {
      totalDays,
      assignedDays,
      totalWorkUnits: Math.round(totalWorkUnits * 10) / 10,
      offDays,
      unassignedDays: Math.max(0, totalDays - assignedDays - offDays),
    };
  }, [userSchedules, currentMonth, currentYear, weeklySchedule, shifts]);

  // Handle shift update for single day (overrides that date)
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
          saveAsWeeklyPattern: false,
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

  // Direct weekday pattern update handler (e.g. user selects fixed shift for a weekday)
  const handleUpdateWeekdayPattern = async (dow: number, newShiftId: string) => {
    if (!selectedUserId) return;
    setLoading(true);
    setFeedback(null);
    try {
      const updated = { ...(weeklySchedule || {}) };
      if (!newShiftId) {
        delete updated[String(dow)];
      } else {
        updated[String(dow)] = newShiftId;
      }

      // If updating Sunday to a fixed shift or OFF, disable flexible mode
      if (dow === 0 && newShiftId !== 'FLEXIBLE') {
        if (updated.sundayFlexible) {
          updated.sundayFlexible = { ...updated.sundayFlexible, enabled: false };
        }
      }

      const res = await fetch('/api/admin/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          mode: 'SET_WEEKLY_PATTERN',
          weeklyPattern: updated,
          month: currentMonth,
          year: currentYear,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setWeeklySchedule(updated);
        await fetchUserSchedules();
        setFeedback({
          type: 'success',
          text: `Đã lưu ca cố định cho ${dow === 0 ? 'Chủ Nhật' : 'Thứ ' + (dow + 1)} và tự động đồng bộ sang tất cả các tháng!`,
        });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Lỗi cập nhật khung ca' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Lỗi kết nối máy chủ' });
    } finally {
      setLoading(false);
    }
  };

  // Save flexible Sunday schedule handler
  const handleSaveSundayFlexible = async (
    enabled: boolean,
    shiftId: string,
    shiftsCount: number
  ) => {
    if (!selectedUserId) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          mode: 'UPDATE_SUNDAY_FLEXIBLE',
          sundayFlexible: {
            enabled,
            shiftId,
            shiftsCount: Number(shiftsCount) || 1,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWeeklySchedule(data.weeklySchedule);
        await fetchUserSchedules();
        setFeedback({
          type: 'success',
          text: data.message || 'Đã cập nhật ca linh động Chủ Nhật!',
        });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Lỗi lưu cấu hình' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message || 'Lỗi kết nối' });
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Quick batch apply for selected user
  const handleQuickApplyUser = async (mode: 'CUSTOM_WEEKDAYS' | 'ALL_DAYS' | 'CLEAR') => {
    if (!selectedUserId) return;
    if (mode !== 'CLEAR' && !quickShiftId) {
      alert('Vui lòng chọn ca làm việc để gán');
      return;
    }
    if (mode === 'CUSTOM_WEEKDAYS' && selectedDaysOfWeek.length === 0) {
      alert('Vui lòng chọn ít nhất một thứ trong tuần (VD: T2, T3, T4...)');
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      if (mode === 'CLEAR') {
        const res = await fetch(
          `/api/admin/schedules?userId=${selectedUserId}&month=${currentMonth}&year=${currentYear}`,
          { method: 'DELETE' }
        );
        const data = await res.json();
        if (res.ok) {
          await fetchUserSchedules();
          setFeedback({
            type: 'success',
            text: 'Đã xóa toàn bộ lịch ca trong tháng này!',
          });
        } else {
          setFeedback({ type: 'error', text: data.error || 'Lỗi xóa lịch' });
        }
      } else {
        const res = await fetch('/api/admin/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUserId,
            mode: mode,
            selectedDaysOfWeek: selectedDaysOfWeek,
            shiftId: quickShiftId,
            month: currentMonth,
            year: currentYear,
            saveAsWeeklyPattern: saveAsWeeklyPattern,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          await fetchUserSchedules();
          setFeedback({
            type: 'success',
            text:
              data.message ||
              `Đã gán ca thành công và tự động lưu khung ca cố định cho các tháng sau!`,
          });
        } else {
          setFeedback({ type: 'error', text: data.error || 'Lỗi áp dụng lịch' });
        }
      }
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
    if (selectedUserIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 nhân viên');
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
          weekdayShifts,
          sundayShifts,
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
    if (sch.isSundayFlexible) {
      const s = sch.shift;
      return (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 text-purple-900 rounded-lg px-1.5 py-1 text-center shadow-xs">
          <div className="font-extrabold text-[10px] text-purple-900 flex items-center justify-center gap-1">
            <span>✨ CN Linh động</span>
          </div>
          <div className="text-[9px] text-purple-700 font-bold mt-0.5">
            {sch.sundayFlexibleShiftsCount ? `Thỏa thuận ${sch.sundayFlexibleShiftsCount} ngày/tháng` : 'Theo thỏa thuận'}
          </div>
          {s && (
            <div className="text-[8px] text-purple-600 opacity-90 mt-0.5 truncate">
              {s.name} ({s.workUnits}c)
            </div>
          )}
        </div>
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
                  {filteredUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      [{u.department?.name || 'Chưa xếp'}] {u.name} ({u.employeeCode}) - {u.branch?.name || 'Chi nhánh'}
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

          {/* Permanent Weekly Pattern Card */}
          <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white rounded-3xl p-5 sm:p-6 shadow-md space-y-4 border border-emerald-800/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-400/30">
                  <CalendarRange className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide text-white flex items-center gap-2">
                    Khung Ca Cố Định Theo Thứ — {selectedUser?.name}
                    <span className="text-[10px] font-mono font-bold bg-white/10 text-emerald-300 px-2 py-0.5 rounded-full border border-white/10">
                      Mã NV: {selectedUser?.employeeCode}
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-200/80 mt-0.5">
                    Lưu cố định ca làm việc theo từng thứ trong tuần và <strong>tự động áp dụng cho các tháng sau</strong>. Tổng công chuẩn của mỗi tháng sẽ tự động thay đổi đúng theo số lượng các thứ có trong tháng đó.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-full whitespace-nowrap self-start sm:self-auto flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Tự động áp dụng cho tháng sau
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {[
                { dow: 1, label: 'Thứ 2', isSun: false },
                { dow: 2, label: 'Thứ 3', isSun: false },
                { dow: 3, label: 'Thứ 4', isSun: false },
                { dow: 4, label: 'Thứ 5', isSun: false },
                { dow: 5, label: 'Thứ 6', isSun: false },
                { dow: 6, label: 'Thứ 7', isSun: false },
                { dow: 0, label: 'Chủ Nhật', isSun: true },
              ].map(({ dow, label, isSun }) => {
                const isFlexibleSun = isSun && weeklySchedule?.sundayFlexible?.enabled;
                const assignedVal = weeklySchedule ? (weeklySchedule[String(dow)] || weeklySchedule[dow]) : undefined;
                const matchedShift = shifts.find((s) => s.id === assignedVal || s.code === assignedVal);
                const isOff = assignedVal === 'OFF';

                const flexShift = isFlexibleSun
                  ? shifts.find(
                      (s) =>
                        s.id === weeklySchedule?.sundayFlexible?.shiftId ||
                        s.code === weeklySchedule?.sundayFlexible?.shiftId
                    )
                  : null;
                const flexCount = weeklySchedule?.sundayFlexible?.shiftsCount || 0;
                const flexUnits = flexShift ? flexShift.workUnits || 1 : 1;

                return (
                  <div
                    key={dow}
                    className={`rounded-2xl p-2.5 border transition-all ${
                      isFlexibleSun
                        ? 'bg-purple-950/50 border-purple-400/50 ring-1 ring-purple-400/30'
                        : isSun
                        ? 'bg-rose-950/40 border-rose-500/30'
                        : 'bg-emerald-950/40 border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-black ${
                          isFlexibleSun ? 'text-purple-300' : isSun ? 'text-rose-300' : 'text-emerald-300'
                        }`}
                      >
                        {label}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300">
                        {isFlexibleSun
                          ? `${flexCount} ngày (${flexCount * flexUnits}c)`
                          : isOff
                          ? '0 công'
                          : matchedShift
                          ? `${matchedShift.workUnits} công`
                          : 'Chưa gán'}
                      </span>
                    </div>

                    <select
                      value={isFlexibleSun ? 'FLEXIBLE' : isOff ? 'OFF' : assignedVal || ''}
                      onChange={(e) => {
                        if (e.target.value === 'FLEXIBLE') {
                          handleSaveSundayFlexible(true, flexSundayShiftId || shifts[0]?.id || '', flexSundayShiftsCount || 2);
                        } else {
                          handleUpdateWeekdayPattern(dow, e.target.value);
                        }
                      }}
                      disabled={loading}
                      className="w-full text-[11px] bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl py-1.5 px-2 font-bold text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="" className="text-slate-900">-- Chưa gán ca --</option>
                      {isSun && (
                        <option value="FLEXIBLE" className="text-purple-800 font-bold">
                          ✨ Chủ Nhật Linh Động ({flexCount || 2} ngày/tháng)
                        </option>
                      )}
                      <option value="OFF" className="text-slate-900">🏖️ Nghỉ (OFF - 0 công)</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id} className="text-slate-900">
                          {s.name} ({s.workUnits} công)
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Flexible Sunday Shift Settings Card */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl p-5 sm:p-6 shadow-md space-y-4 border border-purple-800/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-400/30">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide text-white flex items-center gap-2">
                    Cấu Hình Chủ Nhật Linh Động (Theo Thỏa Thuận Số Ngày)
                    {weeklySchedule?.sundayFlexible?.enabled && (
                      <span className="text-[10px] font-bold bg-purple-500/30 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-400/30">
                        Đang kích hoạt: {weeklySchedule.sundayFlexible.shiftsCount} ngày/tháng
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-purple-200/80 mt-0.5">
                    Dành cho nhân sự làm việc vào Chủ Nhật theo số lượng ngày thỏa thuận trong tháng. Hệ thống sẽ <strong>tự động tính tổng công chuẩn tháng</strong> và lưu cố định cho các tháng tiếp theo.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-2xl border border-white/20 transition-all self-start sm:self-auto">
                <input
                  type="checkbox"
                  checked={flexSundayEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFlexSundayEnabled(checked);
                    if (!checked) {
                      handleSaveSundayFlexible(false, flexSundayShiftId, flexSundayShiftsCount);
                    }
                  }}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-white/30"
                />
                <span className="text-xs font-bold text-purple-200">
                  {flexSundayEnabled ? 'Đang bật CN linh động' : 'Bật CN linh động'}
                </span>
              </label>
            </div>

            {flexSundayEnabled && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* 1. Chọn Ca áp dụng cho Chủ Nhật */}
                  <div className="md:col-span-6 space-y-1.5">
                    <label className="block text-[11px] font-bold text-purple-200 uppercase tracking-wider">
                      1. Ca Làm Việc Khi Làm Chủ Nhật:
                    </label>
                    <select
                      value={flexSundayShiftId}
                      onChange={(e) => setFlexSundayShiftId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white/10 hover:bg-white/15 border border-purple-400/30 rounded-xl text-xs font-bold text-white cursor-pointer focus:ring-2 focus:ring-purple-400 focus:outline-none"
                    >
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id} className="text-slate-900">
                          {s.name} ({s.startTime}-{s.endTime} = {s.workUnits} công)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Số ngày phải làm trong tháng */}
                  <div className="md:col-span-6 space-y-1.5">
                    <label className="block text-[11px] font-bold text-purple-200 uppercase tracking-wider">
                      2. SỐ NGÀY CHỦ NHẬT PHẢI LÀM TRONG THÁNG:
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setFlexSundayShiftsCount(cnt)}
                          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all border ${
                            flexSundayShiftsCount === cnt
                              ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/30 ring-2 ring-purple-300/50'
                              : 'bg-white/10 hover:bg-white/20 text-purple-200 border-white/15'
                          }`}
                        >
                          {cnt} ngày
                        </button>
                      ))}
                      <div className="w-20">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={flexSundayShiftsCount}
                          onChange={(e) => setFlexSundayShiftsCount(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full py-2 px-2.5 text-center bg-white/10 border border-purple-400/30 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-purple-400 focus:outline-none"
                          placeholder="Khác"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Calculation Info Box */}
                {(() => {
                  const matchedShift = shifts.find((s) => s.id === flexSundayShiftId) || shifts[0];
                  const shiftUnits = matchedShift?.workUnits || 1;
                  const totalFlexUnits = (Number(flexSundayShiftsCount) || 0) * shiftUnits;
                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-900/40 border border-purple-500/30 rounded-2xl p-3.5">
                      <div className="space-y-0.5">
                        <div className="text-xs font-extrabold text-purple-200 flex items-center gap-1.5">
                          <span>📊 Quy đổi công chuẩn:</span>
                          <span className="text-amber-300 font-mono text-sm">
                            {flexSundayShiftsCount} ngày × {shiftUnits} công = {totalFlexUnits} công chuẩn Chủ Nhật
                          </span>
                        </div>
                        <p className="text-[11px] text-purple-300/80">
                          Tổng công chuẩn tháng của <strong>{selectedUser?.name}</strong> sẽ bằng: (Tổng công T2 ➔ T7 trong tháng) + <strong>{totalFlexUnits} công CN</strong>.
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          handleSaveSundayFlexible(
                            true,
                            flexSundayShiftId || shifts[0]?.id,
                            flexSundayShiftsCount
                          )
                        }
                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap self-stretch sm:self-auto cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        Lưu Cấu Hình CN Linh Động
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Quick Action Bar for Selected User */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Gán ca nhanh theo thứ (Tháng {currentMonth}/{currentYear}):
              </span>

              <div className="flex items-center gap-2">
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* 1. Chọn Ca */}
              <div className="lg:col-span-5 space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  1. Chọn Ca Làm Việc:
                </label>
                <select
                  value={quickShiftId}
                  onChange={(e) => setQuickShiftId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500/20"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime}-{s.endTime} = {s.workUnits} công)
                    </option>
                  ))}
                  <option value="OFF">🏖️ Đặt làm ngày Nghỉ (OFF - 0 công)</option>
                </select>
              </div>

              {/* 2. Chọn Thứ Trong Tuần */}
              <div className="lg:col-span-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    2. Chọn Thứ Cần Gán:
                  </label>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedDaysOfWeek([1, 2, 3, 4, 5, 6])}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      T2-T7
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDaysOfWeek([1, 2, 3, 4, 5])}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      T2-T6
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDaysOfWeek([0])}
                      className="text-rose-600 font-bold hover:underline"
                    >
                      Chủ Nhật
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {[
                    { day: 1, label: 'T2' },
                    { day: 2, label: 'T3' },
                    { day: 3, label: 'T4' },
                    { day: 4, label: 'T5' },
                    { day: 5, label: 'T6' },
                    { day: 6, label: 'T7' },
                    { day: 0, label: 'CN' },
                  ].map((d) => {
                    const isSelected = selectedDaysOfWeek.includes(d.day);
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() =>
                          setSelectedDaysOfWeek((prev) =>
                            prev.includes(d.day) ? prev.filter((x) => x !== d.day) : [...prev, d.day]
                          )
                        }
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                          isSelected
                            ? d.day === 0
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                              : 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Nút Áp Dụng */}
              <div className="lg:col-span-3 pt-2 lg:pt-5">
                <button
                  type="button"
                  disabled={loading || selectedDaysOfWeek.length === 0}
                  onClick={() => handleQuickApplyUser('CUSTOM_WEEKDAYS')}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Gán Nhanh ({selectedDaysOfWeek.length} thứ)
                </button>
              </div>
            </div>

            {/* Checkbox option to persist weekly template */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs font-medium text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveAsWeeklyPattern}
                  onChange={(e) => setSaveAsWeeklyPattern(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <span>
                  Đồng thời lưu làm <strong>Khung ca cố định theo thứ</strong> (Tự động áp dụng cho các tháng tiếp theo)
                </span>
              </label>
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
          {/* Step 1: Config Shifts */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              1. Cài đặt số lượng ca mặc định
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số ca ngày thường (T2 - T7)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={weekdayShifts}
                  onChange={(e) => setWeekdayShifts(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số ca Chủ Nhật</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={sundayShifts}
                  onChange={(e) => setSundayShifts(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Choose Users */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                2. Chọn Nhân Sự Áp Dụng ({selectedUserIds.length}/{users.length})
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
                    (!filterBranch || u.branchId === filterBranch || u.branch?.id === filterBranch) &&
                    (!filterDept || u.departmentId === filterDept || u.department?.id === filterDept)
                )
                .sort((a, b) => {
                  const deptA = a.department?.name || 'ZZZ';
                  const deptB = b.department?.name || 'ZZZ';
                  const deptComp = deptA.localeCompare(deptB, 'vi');
                  if (deptComp !== 0) return deptComp;
                  return (a.name || '').localeCompare(b.name || '', 'vi');
                })
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
                      <div className="font-bold truncate">
                        <span className="text-emerald-700 font-bold mr-1">[{u.department?.name || 'Chưa xếp'}]</span>
                        {u.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {u.employeeCode} - ({u.branch?.name || 'Chi nhánh'})
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
