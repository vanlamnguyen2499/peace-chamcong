'use client';

import React, { useState, useEffect } from 'react';
import { CalendarRange, CheckCircle2, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminSchedulesPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-28'));
  const [excludeSundays, setExcludeSundays] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        if (d.users) setSelectedUserIds(d.users.map((u: any) => u.id));
      });

    fetch('/api/admin/shifts')
      .then((r) => r.json())
      .then((d) => {
        setShifts(d.shifts || []);
        if (d.shifts?.[0]) setSelectedShiftId(d.shifts[0].id);
      });

    fetch('/api/admin/branches')
      .then((r) => r.json())
      .then((d) => setBranches(d.branches || []));

    fetch('/api/admin/departments')
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments || []));
  }, []);

  const handleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map((u) => u.id));
    }
  };

  const handleToggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const handleBatchSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0 || !selectedShiftId) {
      alert('Vui lòng chọn ít nhất 1 nhân viên và 1 ca làm việc');
      return;
    }

    setLoading(true);
    setMessage(null);

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

      setMessage(data.message);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <CalendarRange className="w-6 h-6 text-emerald-600" />
          Xếp Ca & Phân Lịch Làm Việc Hàng Loạt
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Gán ca làm việc theo tuần hoặc tháng cho từng nhân sự hoặc toàn bộ phòng ban
        </p>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          {message}
        </div>
      )}

      <form onSubmit={handleBatchSchedule} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
        {/* Step 1: Time range */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
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
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            2. Chọn Ca Làm Việc
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {shifts.map((s) => (
              <label
                key={s.id}
                className={`p-3.5 rounded-2xl border text-left cursor-pointer flex flex-col justify-between transition-all ${
                  selectedShiftId === s.id
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 shadow-sm'
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
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                    .filter((u) => (!filterBranch || u.branchId === filterBranch) && (!filterDept || u.departmentId === filterDept))
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {users
              .filter((u) => (!filterBranch || u.branchId === filterBranch) && (!filterDept || u.departmentId === filterDept))
              .map((u) => (
                <label
                  key={u.id}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-all ${
                    selectedUserIds.includes(u.id)
                      ? 'border-emerald-500 bg-emerald-50/50 text-slate-900'
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
                      {u.employeeCode} - {u.department?.name || 'Chưa xếp'} ({u.branch?.name || 'Chi nhánh'})
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
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {loading ? 'Đang phân ca...' : 'Áp Dụng Phân Ca'}
          </button>
        </div>
      </form>
    </div>
  );
}
