'use client';

import React, { useState, useEffect } from 'react';
import { CalendarDays, Plus, Clock, Edit2, CheckCircle2 } from 'lucide-react';

export default function AdminShiftsPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    startTime: '08:30',
    endTime: '17:30',
    breakStartTime: '12:00',
    breakEndTime: '13:30',
    gracePeriodLate: 15,
    gracePeriodEarly: 15,
    workUnits: 1.0,
    minWorkHours: 8.0,
  });

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/shifts');
      if (res.ok) {
        const data = await res.json();
        setShifts(data.shifts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleOpenCreate = () => {
    setEditingShift(null);
    setFormData({
      name: '',
      code: `CA_${shifts.length + 1}`,
      startTime: '08:30',
      endTime: '17:30',
      breakStartTime: '12:00',
      breakEndTime: '13:30',
      gracePeriodLate: 15,
      gracePeriodEarly: 15,
      workUnits: 1.0,
      minWorkHours: 8.0,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (s: any) => {
    setEditingShift(s);
    setFormData({
      name: s.name,
      code: s.code,
      startTime: s.startTime,
      endTime: s.endTime,
      breakStartTime: s.breakStartTime || '',
      breakEndTime: s.breakEndTime || '',
      gracePeriodLate: s.gracePeriodLate,
      gracePeriodEarly: s.gracePeriodEarly,
      workUnits: s.workUnits,
      minWorkHours: s.minWorkHours,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let res;
      if (editingShift) {
        res = await fetch(`/api/admin/shifts/${editingShift.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        res = await fetch('/api/admin/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }

      if (res.ok) {
        setShowModal(false);
        await fetchShifts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-emerald-600" />
            Cấu Hình Ca Làm Việc (Shifts)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Khung giờ làm việc, giờ nghỉ giữa ca, dung sai đi muộn về sớm và hệ số công</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" /> Thêm Ca Làm Việc
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shifts.map((s) => (
          <div key={s.id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {s.code}
                </span>
                <h3 className="font-extrabold text-slate-900 text-base mt-1">{s.name}</h3>
              </div>
              <button
                onClick={() => handleOpenEdit(s)}
                className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Khung giờ ca</div>
              <div className="text-xl font-black text-emerald-800 mt-0.5">
                {s.startTime} - {s.endTime}
              </div>
              <div className="text-xs font-bold text-emerald-600 mt-1">
                Hệ số: {s.workUnits} công
              </div>
            </div>

            <div className="text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Dung sai đi muộn:</span>
                <strong className="text-slate-800">{s.gracePeriodLate} phút</strong>
              </div>
              <div className="flex justify-between">
                <span>Dung sai về sớm:</span>
                <strong className="text-slate-800">{s.gracePeriodEarly} phút</strong>
              </div>
              {s.breakStartTime && (
                <div className="flex justify-between">
                  <span>Nghỉ trưa:</span>
                  <strong className="text-slate-800">{s.breakStartTime} - {s.breakEndTime}</strong>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingShift ? 'Cập Nhật Ca Làm Việc' : 'Thêm Ca Làm Việc Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên ca *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="VD: Ca Hành Chính"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã ca *</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="VD: CA_HC"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giờ bắt đầu</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giờ kết thúc</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bắt đầu nghỉ trưa</label>
                  <input
                    type="time"
                    value={formData.breakStartTime}
                    onChange={(e) => setFormData({ ...formData, breakStartTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kết thúc nghỉ trưa</label>
                  <input
                    type="time"
                    value={formData.breakEndTime}
                    onChange={(e) => setFormData({ ...formData, breakEndTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dung sai muộn (phút)</label>
                  <input
                    type="number"
                    value={formData.gracePeriodLate}
                    onChange={(e) => setFormData({ ...formData, gracePeriodLate: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Công ghi nhận</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.workUnits}
                    onChange={(e) => setFormData({ ...formData, workUnits: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-bold text-slate-600 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
