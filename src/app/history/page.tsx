'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  History,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MapPin,
  Flame,
} from 'lucide-react';

export default function HistoryPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [historyData, setHistoryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/attendance/history?month=${month}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [month, year]);

  const summary = historyData?.summary;
  const list = historyData?.attendances || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-600" />
            Lịch Sử Chấm Công Cá Nhân
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Theo dõi chi tiết ngày công, giờ check-in/out và làm thêm giờ trong tháng</p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-slate-400">Tổng Công Tháng</div>
          <div className="text-xl font-black text-emerald-600 mt-1">
            {summary?.totalWorkUnits || 0} <span className="text-xs font-normal text-slate-400">công</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-slate-400">Tổng Giờ Làm</div>
          <div className="text-xl font-black text-slate-800 mt-1">
            {summary?.totalWorkHours || 0} <span className="text-xs font-normal text-slate-400">giờ</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-slate-400">Tổng Đi Muộn</div>
          <div className="text-xl font-black text-amber-600 mt-1">
            {summary?.totalLateMinutes || 0} <span className="text-xs font-normal text-slate-400">phút</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-slate-400">Làm Thêm OT</div>
          <div className="text-xl font-black text-purple-600 mt-1">
            +{summary?.totalOtHours || 0} <span className="text-xs font-normal text-slate-400">giờ</span>
          </div>
        </div>
      </div>

      {/* List of Days */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
          <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Đang tải lịch sử công...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm">
          <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Chưa có dữ liệu chấm công nào trong tháng {month}/{year}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((item: any) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              {/* Left date and shift info */}
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center min-w-[54px]">
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    {new Date(item.workDate).toLocaleDateString('vi-VN', { weekday: 'short' })}
                  </div>
                  <div className="text-base font-extrabold text-slate-900 leading-tight">
                    {new Date(item.workDate).getDate()}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">
                      {new Date(item.workDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <span className="text-xs text-slate-500">({item.shift?.name || 'Ca Hành Chính'})</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-600 mt-2 flex-wrap">
                    <div>
                      <span>Vào: </span>
                      <strong className="text-slate-800">
                        {item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </strong>
                      {item.lateMinutes > 0 && <span className="text-amber-600 text-[10px] ml-1">(Trễ {item.lateMinutes}p)</span>}
                    </div>

                    <div>
                      <span>Ra: </span>
                      <strong className="text-slate-800">
                        {item.checkOutTime ? new Date(item.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </strong>
                      {item.earlyMinutes > 0 && <span className="text-amber-600 text-[10px] ml-1">(Sớm {item.earlyMinutes}p)</span>}
                    </div>

                    <div>
                      <span>Làm việc: </span>
                      <strong>{item.workHours}h</strong>
                    </div>

                    {item.otHours > 0 && (
                      <div className="text-purple-600 font-bold">
                        OT: +{item.otHours}h
                      </div>
                    )}
                  </div>

                  {item.note && (
                    <div className="text-[11px] text-slate-500 mt-1 italic">
                      Ghi chú: {item.note}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Calculated Work Units Badge */}
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Công ghi nhận</div>
                  <div className="text-base font-black text-emerald-700">
                    {item.calculatedWorkUnits} công
                  </div>
                </div>

                {item.checkInPhotoUrl && (
                  <img
                    src={item.checkInPhotoUrl}
                    alt="Selfie"
                    className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
                    title="Ảnh selfie check-in"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
