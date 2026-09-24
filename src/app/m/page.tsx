'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Clock, FileCheck, History, User, MapPin, Camera, CheckCircle2, ChevronRight, LogOut, Bell, FileEdit } from 'lucide-react';
import CameraSelfie from '@/components/CameraSelfie';

export default function MobileApp() {
  const { user, pendingApprovalsCount, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'requests' | 'history' | 'profile'>('home');
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!user) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      {/* Mobile Header */}
      <header className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 pt-10 pb-6 text-white shadow-md rounded-b-[2rem] relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg border border-white/30 backdrop-blur-sm">
              {user.name.charAt(0)}
            </div>
            <div>
              <div className="text-emerald-100 text-[11px] font-medium uppercase tracking-wider">
                {user.role === 'EMPLOYEE' ? 'Nhân viên' : 'Quản lý'}
              </div>
              <div className="font-bold text-lg leading-tight">{user.name}</div>
            </div>
          </div>
          <button className="relative w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
            <Bell className="w-5 h-5 text-white" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 -mt-4 relative z-20">
        {activeTab === 'home' && <MobileHome time={time} />}
        {activeTab === 'requests' && <MobileRequests />}
        {activeTab === 'history' && <MobileHistory />}
        {activeTab === 'profile' && <MobileProfile user={user} logout={logout} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/80 pb-safe pt-2 px-6 flex items-center justify-between shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-50">
        <TabButton id="home" icon={Clock} label="Chấm công" isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <TabButton id="requests" icon={FileCheck} label="Đơn từ" isActive={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
        <TabButton id="history" icon={History} label="Lịch sử" isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        <TabButton id="profile" icon={User} label="Cá nhân" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
      </nav>
    </div>
  );
}

function TabButton({ id, icon: Icon, label, isActive, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 min-w-[60px] pb-2 ${isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}>
      <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-emerald-50' : 'bg-transparent'}`}>
        <Icon className={`w-5 h-5 ${isActive ? 'fill-emerald-100' : ''}`} />
      </div>
      <span className={`text-[10px] font-semibold transition-all ${isActive ? 'font-bold' : ''}`}>{label}</span>
    </button>
  );
}

// =======================
// SUB-VIEWS
// =======================

function MobileHome({ time }: { time: Date | null }) {
  const [photo, setPhoto] = useState<string | null>(null);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Realtime Clock Card */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 text-center">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
          {time ? time.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) : '...'}
        </div>
        <div className="text-4xl font-black font-mono tracking-widest text-slate-800">
          {time ? time.toLocaleTimeString('vi-VN', { hour12: false }) : '--:--:--'}
        </div>
        
        <div className="mt-4 p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 flex items-center justify-between text-left">
          <div>
            <div className="text-[10px] text-slate-500 font-semibold">Ca làm việc hôm nay</div>
            <div className="text-xs font-bold text-emerald-800 mt-0.5">Hành Chính (08:00 - 17:30)</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Camera & GPS Module */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-600" />
            Xác thực khuôn mặt
          </h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Hợp lệ
          </span>
        </div>
        
        <div className="w-full h-56 rounded-2xl overflow-hidden border-2 border-slate-100 relative bg-slate-50 flex items-center justify-center">
          <CameraSelfie 
            onCapture={setPhoto} 
            capturedImage={photo} 
            onRetake={() => setPhoto(null)} 
          />
        </div>

        <button className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 text-lg">
          <Clock className="w-6 h-6" />
          CHẤM CÔNG VÀO
        </button>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
            <FileEdit className="w-4 h-4" />
          </div>
          <div className="text-[10px] text-slate-400 font-semibold">Nghỉ phép còn</div>
          <div className="text-base font-black text-slate-800 mt-0.5">12.0 ngày</div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-2">
            <History className="w-4 h-4" />
          </div>
          <div className="text-[10px] text-slate-400 font-semibold">Đi muộn tháng</div>
          <div className="text-base font-black text-slate-800 mt-0.5">14 phút</div>
        </div>
      </div>
    </div>
  );
}

function MobileRequests() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Quản lý đơn từ</h2>
        <button className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl">
          + Tạo đơn mới
        </button>
      </div>
      
      {/* Types of requests */}
      <div className="grid grid-cols-2 gap-3">
        {['Nghỉ phép', 'Giải trình', 'Tăng ca', 'Tạm ứng'].map((type, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-95 transition-transform">
            <span className="font-semibold text-xs text-slate-700">{type}</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
        ))}
      </div>

      <div className="pt-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Đơn gần đây</h3>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-800">Đơn xin nghỉ phép</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Ngày 18/09/2026 - Cả ngày</div>
            </div>
            <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-lg">Chờ duyệt</span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-800">Đơn giải trình (Quên CC)</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Ngày 15/09/2026</div>
            </div>
            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg">Đã duyệt</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileHistory() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Lịch sử chấm công</h2>
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Tháng 9, 2026</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">20.5 <span className="text-sm text-slate-500 font-semibold">công</span></div>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-emerald-100 flex items-center justify-center">
            <span className="text-xs font-bold text-emerald-700">85%</span>
          </div>
        </div>

        <div className="space-y-4">
          {[18, 17, 16].map((day) => (
            <div key={day} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center">
                  <span className="text-[9px] font-bold text-slate-400">T{day%7+2}</span>
                  <span className="text-sm font-black text-slate-700">{day}</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    07:55 <span className="text-slate-300">-</span> 17:35
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Hành chính</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-emerald-600">+1.0</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Hợp lệ</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileProfile({ user, logout }: any) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Tài khoản</h2>
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-2xl">
            {user.name.charAt(0)}
          </div>
          <div>
            <div className="font-bold text-lg text-slate-800">{user.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
            <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1">
              Mã NV: {user.employeeCode}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors">
            Đổi mật khẩu
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
          <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors">
            Cài đặt thông báo
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
          <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors">
            Quy định công ty
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <button onClick={logout} className="w-full mt-4 p-4 rounded-2xl bg-rose-50 text-rose-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors">
        <LogOut className="w-4 h-4" />
        Đăng xuất
      </button>
    </div>
  );
}
