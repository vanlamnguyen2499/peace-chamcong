'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Bell, LogOut, Shield, MapPin, Building, ChevronDown, Check, User, FileCheck } from 'lucide-react';

export default function Navbar() {
  const { user, unreadCount, logout, refreshUser } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (showNotifications) {
      fetchNotifications();
    }
  }, [showNotifications]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-read', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      refreshUser();
    } catch (e) {
      console.error(e);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">Super Admin</span>;
      case 'HR_ADMIN':
        return <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">HR Admin</span>;
      case 'MANAGER':
        return <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">Quản lý</span>;
      default:
        return <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium">Nhân viên</span>;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 h-16">
      <div className="h-full px-4 md:px-6 flex items-center justify-between">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white font-bold text-lg">
              P
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 tracking-tight text-lg">PEACE</span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">GapoWork</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-none hidden sm:block">Chấm Công & Phê Duyệt Thông Minh</p>
            </div>
          </Link>
        </div>

        {/* Right: Notification & User Profile */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title="Thông báo"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full px-1 shadow-sm animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-sm">Thông báo</h3>
                      {unreadCount > 0 && (
                        <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                          {unreadCount} mới
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Đánh dấu đã đọc
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        Không có thông báo nào
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <Link
                          key={n.id}
                          href={n.link || '#'}
                          onClick={() => setShowNotifications(false)}
                          className={`block px-4 py-3 hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-emerald-50/40' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-xs ${!n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                              {n.title}
                            </h4>
                            {!n.isRead && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(n.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(n.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-inner">
                  {user.name.charAt(0)}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight">{user.name}</div>
                  <div className="text-[10px] text-slate-500">{user.position || user.employeeCode}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
              </button>

              {/* User Menu Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-3 bg-slate-50 rounded-xl mb-2">
                    <div className="font-bold text-sm text-slate-900">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {getRoleBadge(user.role)}
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">{user.employeeCode}</span>
                    </div>
                    {user.branch && (
                      <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        <span className="truncate">{user.branch.name}</span>
                      </div>
                    )}
                    {user.department && (
                      <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                        <Building className="w-3 h-3 text-emerald-600" />
                        <span className="truncate">{user.department.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Link
                      href="/history"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      Lịch sử công cá nhân
                    </Link>

                    {(user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN') && (
                      <>
                        <Link
                          href="/admin/digitize"
                          onClick={() => setShowUserMenu(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <FileCheck className="w-4 h-4 text-indigo-600" />
                          ⚡ Số hóa phiếu ký tay (HR)
                        </Link>
                        <Link
                          href="/admin/timesheet"
                          onClick={() => setShowUserMenu(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <Shield className="w-4 h-4 text-purple-600" />
                          Trang quản trị (Admin/HR)
                        </Link>
                      </>
                    )}

                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
