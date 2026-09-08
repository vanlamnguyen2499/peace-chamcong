'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import CameraSelfie from '@/components/CameraSelfie';
import {
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  FileEdit,
  ShieldCheck,
  Calendar,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Navigation,
  Info,
} from 'lucide-react';

export default function AttendancePage() {
  const { user, refreshUser } = useAuth();
  const [time, setTime] = useState<Date | null>(null);
  const [todayData, setTodayData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // GPS State
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGettingGps, setIsGettingGps] = useState<boolean>(true);

  // Selfie State
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Realtime clock
  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's shift and attendance
  const fetchTodayData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/attendance/today');
      if (res.ok) {
        const data = await res.json();
        setTodayData(data);
      }
    } catch (e) {
      console.error('Fetch today error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Get GPS Coordinates
  const getGpsLocation = () => {
    setIsGettingGps(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Trình duyệt không hỗ trợ Geolocation GPS.');
      setIsGettingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setIsGettingGps(false);
      },
      (err) => {
        console.warn('GPS Error:', err);
        // Fallback to default branch coordinates for dev testing if GPS blocked
        if (todayData?.branch) {
          setCoords({
            latitude: todayData.branch.latitude,
            longitude: todayData.branch.longitude,
          });
          setGpsError('Đã định vị tọa độ mô phỏng tại văn phòng (do thiết bị chưa cấp quyền GPS)');
        } else {
          setGpsError('Không thể lấy vị trí GPS. Vui lòng bật định vị.');
        }
        setIsGettingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    fetchTodayData();
    getGpsLocation();
  }, []);

  // Calculate distance if coords & branch available
  const calculateDistance = () => {
    if (!coords || !todayData?.branch) return null;
    const lat1 = coords.latitude;
    const lon1 = coords.longitude;
    const lat2 = todayData.branch.latitude;
    const lon2 = todayData.branch.longitude;

    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  const distance = calculateDistance();
  const radius = todayData?.branch?.radiusMeters || 300;
  const isInsideBranch = distance !== null ? distance <= radius : false;

  // Handle Check-in
  const handleCheckIn = async () => {
    if (!coords) {
      setFeedbackMsg({ type: 'error', text: 'Vui lòng cho phép định vị GPS để chấm công' });
      return;
    }
    if (!capturedPhoto) {
      setFeedbackMsg({ type: 'error', text: 'Vui lòng chụp ảnh selfie trước khi bấm Check-in' });
      return;
    }

    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          photo: capturedPhoto,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi check-in');

      setFeedbackMsg({ type: 'success', text: data.message });
      setCapturedPhoto(null);
      await fetchTodayData();
      await refreshUser();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Lỗi check-in' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Check-out
  const handleCheckOut = async () => {
    if (!coords) {
      setFeedbackMsg({ type: 'error', text: 'Vui lòng cho phép định vị GPS để chấm công' });
      return;
    }
    if (!capturedPhoto) {
      setFeedbackMsg({ type: 'error', text: 'Vui lòng chụp ảnh selfie trước khi bấm Check-out' });
      return;
    }

    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          photo: capturedPhoto,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi check-out');

      setFeedbackMsg({ type: 'success', text: data.message });
      setCapturedPhoto(null);
      await fetchTodayData();
      await refreshUser();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Lỗi check-out' });
    } finally {
      setActionLoading(false);
    }
  };

  const att = todayData?.attendance;
  const shift = todayData?.shift;
  const branch = todayData?.branch;

  const hasCheckedIn = Boolean(att?.checkInTime);
  const hasCheckedOut = Boolean(att?.checkOutTime);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header Card: Clock & Greeting */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-700/20 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Chấm Công Hôm Nay</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              {user ? `Xin chào, ${user.name}!` : 'PEACE Timekeeping'}
            </h1>
            <p className="text-emerald-100/80 text-xs sm:text-sm mt-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>
                {time ? time.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) : '...'}
              </span>
            </p>
          </div>

          {/* Digital Clock */}
          <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 text-center sm:text-right">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-wider">
              {time ? time.toLocaleTimeString('vi-VN') : '--:--:--'}
            </div>
            <div className="text-[11px] text-emerald-200 font-medium mt-0.5">Giờ máy chủ thực tế</div>
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl flex items-start gap-3 text-xs sm:text-sm font-semibold transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-sm'
              : feedbackMsg.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800 shadow-sm'
              : 'bg-blue-50 border border-blue-200 text-blue-800 shadow-sm'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">{feedbackMsg.text}</div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-slate-700 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left (Camera & Action) - Right (Shift Info & Today Stats) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewfinder & Big Action */}
        <div className="md:col-span-6 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Xác thực Khuôn mặt & Vị trí
              </h2>
              <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                Live Selfie
              </span>
            </div>

            {/* Camera Component */}
            <CameraSelfie
              onCapture={(img) => setCapturedPhoto(img)}
              capturedImage={capturedPhoto}
              onRetake={() => setCapturedPhoto(null)}
            />

            {/* GPS Status Card */}
            <div className="mt-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  Định vị GPS
                </span>
                <button
                  onClick={getGpsLocation}
                  disabled={isGettingGps}
                  className="text-emerald-600 hover:text-emerald-700 text-[11px] font-semibold flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isGettingGps ? 'animate-spin' : ''}`} />
                  Làm mới vị trí
                </button>
              </div>

              {branch && (
                <div className="mt-2 text-[11px] text-slate-600">
                  <span>Chi nhánh: </span>
                  <span className="font-bold text-slate-800">{branch.name}</span>
                  <div className="text-slate-400 truncate mt-0.5">{branch.address}</div>
                </div>
              )}

              {distance !== null ? (
                <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-200/60">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isInsideBranch ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'
                      }`}
                    />
                    <span className="font-semibold text-slate-700">
                      Khoảng cách: <strong className="text-slate-900">{distance}m</strong>
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isInsideBranch
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isInsideBranch ? `Hợp lệ (≤ ${radius}m)` : `Ngoài vùng (> ${radius}m)`}
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-slate-400 text-[11px] italic">
                  {isGettingGps ? 'Đang dò sóng GPS...' : gpsError || 'Chưa lấy được tọa độ GPS'}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6">
              {!hasCheckedIn ? (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading || !capturedPhoto}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/25 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Clock className="w-5 h-5" />
                      Check-in Vào Ca
                    </>
                  )}
                </button>
              ) : !hasCheckedOut ? (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading || !capturedPhoto}
                  className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-teal-600/25 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Clock className="w-5 h-5" />
                      Check-out Hết Ca
                    </>
                  )}
                </button>
              ) : (
                <div className="w-full py-3.5 bg-slate-100 text-emerald-800 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-emerald-200/60">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  Đã hoàn thành chấm công hôm nay
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Shift Schedule & Today's Attendance Details */}
        <div className="md:col-span-6 space-y-6">
          {/* Shift Details Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Thông Tin Ca Làm Việc Hôm Nay
            </h2>

            {shift ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                  <div>
                    <div className="font-extrabold text-slate-900 text-sm">{shift.name}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">Mã: {shift.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-700">
                      {shift.startTime} - {shift.endTime}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      Công: {shift.workUnits} công
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="text-slate-400 text-[10px]">Dung sai đi muộn</div>
                    <div className="font-bold text-slate-800 mt-0.5">{shift.gracePeriodLate} phút</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="text-slate-400 text-[10px]">Dung sai về sớm</div>
                    <div className="font-bold text-slate-800 mt-0.5">{shift.gracePeriodEarly} phút</div>
                  </div>
                </div>

                {shift.breakStartTime && (
                  <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                    <span>Nghỉ trưa:</span>
                    <span className="font-bold text-slate-800">
                      {shift.breakStartTime} - {shift.breakEndTime}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400">
                Chưa có lịch phân ca hôm nay
              </div>
            )}
          </div>

          {/* Today Attendance Status Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-emerald-600" />
              Kết Quả Chấm Công Hôm Nay
            </h2>

            {att ? (
              <div className="space-y-4">
                {/* In / Out Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Check-in Box */}
                  <div className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Giờ Check-in</div>
                    <div className="text-lg font-black text-slate-900 mt-0.5">
                      {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </div>
                    {att.checkInTime && (
                      <div className="mt-2 space-y-1 text-[11px]">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            att.lateMinutes > 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {att.lateMinutes > 0 ? `Trễ ${att.lateMinutes}p` : 'Đúng giờ'}
                        </span>
                        {att.checkInPhotoUrl && (
                          <div className="mt-1.5 flex items-center gap-1 text-slate-500">
                            <img
                              src={att.checkInPhotoUrl}
                              alt="Selfie Check-in"
                              className="w-6 h-6 rounded-full object-cover border border-slate-200"
                            />
                            <span className="text-[10px]">Đã lưu ảnh</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Check-out Box */}
                  <div className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Giờ Check-out</div>
                    <div className="text-lg font-black text-slate-900 mt-0.5">
                      {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </div>
                    {att.checkOutTime && (
                      <div className="mt-2 space-y-1 text-[11px]">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            att.earlyMinutes > 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {att.earlyMinutes > 0 ? `Sớm ${att.earlyMinutes}p` : 'Đúng giờ'}
                        </span>
                        {att.checkOutPhotoUrl && (
                          <div className="mt-1.5 flex items-center gap-1 text-slate-500">
                            <img
                              src={att.checkOutPhotoUrl}
                              alt="Selfie Check-out"
                              className="w-6 h-6 rounded-full object-cover border border-slate-200"
                            />
                            <span className="text-[10px]">Đã lưu ảnh</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics Summary */}
                <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-100 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-slate-500 text-[10px]">Tổng giờ làm:</div>
                    <div className="font-extrabold text-slate-800 text-sm">{att.workHours} giờ</div>
                  </div>
                  {att.otHours > 0 && (
                    <div>
                      <div className="text-slate-500 text-[10px]">Làm thêm (OT):</div>
                      <div className="font-extrabold text-amber-700 text-sm">+{att.otHours} giờ</div>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-slate-500 text-[10px]">Công ghi nhận:</div>
                    <div className="font-black text-emerald-700 text-sm">
                      {att.calculatedWorkUnits} công
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-400">
                Chưa có dữ liệu chấm công cho hôm nay
              </div>
            )}

            {/* Quick Actions for Exceptions */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <Link
                href="/approvals"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <FileEdit className="w-3.5 h-3.5" /> Gửi đơn giải trình / bổ sung công
              </Link>
              <Link
                href="/history"
                className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                Xem lịch sử <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access to Standardized Approval Slips (MỤC 5 & Workflows) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-emerald-600" />
              Danh Mục 13 Mẫu Đơn &amp; Phiếu Xác Nhận Chuẩn Hóa
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tạo phiếu xác nhận nhanh theo quy trình 3 bước (Quản lý ký xác nhận $\to$ Cập nhật hệ thống $\to$ Duyệt tự động)
            </p>
          </div>
          <Link
            href="/approvals"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            Vào Trung Tâm Duyệt Đơn <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {/* Nhóm 1: Nghỉ Phép & Chế Độ */}
          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono">Nghỉ Phép</span>
              <span className="text-[10px] text-emerald-600 font-bold">Trừ phép</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Nghỉ Phép Năm</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Trừ quỹ phép năm, tính đủ công</div>
          </Link>

          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-mono">Nghỉ Phép</span>
              <span className="text-[10px] text-slate-600 font-bold">0 công</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Nghỉ Không Lương</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Không trừ quỹ phép</div>
          </Link>

          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono">Chế Độ</span>
              <span className="text-[10px] text-rose-600 font-bold">BHXH</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Nghỉ Ốm / BHXH</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Kèm giấy xác nhận y tế</div>
          </Link>

          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-mono">Đặc Biệt</span>
              <span className="text-[10px] text-purple-600 font-bold">100% Lương</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Nghỉ Việc Riêng</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Kết hôn, hiếu hỷ,...</div>
          </Link>

          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-mono">Nửa Ca</span>
              <span className="text-[10px] text-teal-600 font-bold">0.5 công</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Nghỉ Nửa Ca (0.5)</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Không bị phạt đi trễ</div>
          </Link>

          {/* Nhóm 2: Chấm Công & OT */}
          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono">Chấm Công</span>
              <span className="text-[10px] text-indigo-600 font-bold">Bù 100%</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Quên Chấm Công</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Quên vân tay, bù công chuẩn</div>
          </Link>

          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">Đi Trễ</span>
              <span className="text-[10px] text-blue-600 font-bold">Xóa phạt</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Xác Nhận Đi Trễ</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Xóa phạt trễ &gt; 30 phút</div>
          </Link>

          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-mono">Tăng Ca</span>
              <span className="text-[10px] text-orange-600 font-bold">OT x2</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Tăng Ca (OT x2)</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Nhân đôi phút ngoài ca (&gt;=15p)</div>
          </Link>

          {/* Nhóm 3: Công Tác & Tài Chính */}
          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono">Công Tác</span>
              <span className="text-[10px] text-amber-600 font-bold">Đủ công</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Đi Công Tác</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Khám tuyến cơ sở, gặp đối tác</div>
          </Link>

          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 font-mono">Đào Tạo</span>
              <span className="text-[10px] text-violet-600 font-bold">2 công</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Đi Học / Đào Tạo</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Đặc cách 2 ca 14h00-19h30</div>
          </Link>

          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-mono">Từ Xa</span>
              <span className="text-[10px] text-sky-600 font-bold">WFH</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Làm Việc Từ Xa</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Làm tại nhà theo KPI</div>
          </Link>

          <Link
            href="/approvals"
            className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-500 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-100 text-fuchsia-800 font-mono">Tài Chính</span>
              <span className="text-[10px] text-fuchsia-600 font-bold">Tạm ứng</span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 mt-1.5">Tạm Ứng / Chi Tiêu</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">Chi phí công tác, mua vật tư</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
