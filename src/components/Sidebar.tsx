'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Clock,
  FileCheck,
  CalendarDays,
  Table,
  Users,
  Building2,
  CalendarRange,
  Settings,
  FileSpreadsheet,
  History,
  Layers,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, pendingApprovalsCount } = useAuth();

  if (!user || pathname === '/login') return null;

  const isAdminOrHR = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN';
  const isManager = user.role === 'MANAGER' || isAdminOrHR;

  const personalNav = [
    { label: 'Chấm Công', href: '/', icon: Clock },
    {
      label: 'Phiếu Yêu Cầu & Duyệt',
      href: '/approvals',
      icon: FileCheck,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    { label: 'Lịch Sử Chấm Công', href: '/history', icon: History },
  ];

  const managementNav = [
    { label: 'Bảng Công Tháng', href: '/admin/timesheet', icon: Table },
    { label: 'Xếp Ca & Phân Lịch', href: '/admin/schedules', icon: CalendarRange },
    { label: 'Quản Lý Nhân Sự', href: '/admin/users', icon: Users },
  ];

  const adminNav = [
    { label: 'Chi Nhánh & GPS', href: '/admin/branches', icon: Building2 },
    { label: 'Ca Làm Việc', href: '/admin/shifts', icon: CalendarDays },
    { label: 'Mẫu Phiếu Phê Duyệt', href: '/approvals/templates', icon: Layers },
    { label: 'Cấu Hình Hệ Thống', href: '/admin/settings', icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 hidden lg:flex flex-col justify-between flex-shrink-0">
      <div className="space-y-6">
        {/* Personal Group */}
        <div>
          <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Cá Nhân
          </div>
          <nav className="space-y-1">
            {personalNav.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Manager & HR Group */}
        {isManager && (
          <div>
            <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Quản Trị & HR
            </div>
            <nav className="space-y-1">
              {managementNav.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* Super Admin Group */}
        {user.role === 'SUPER_ADMIN' && (
          <div>
            <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Cài Đặt Hệ Thống
            </div>
            <nav className="space-y-1">
              {adminNav.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Quota info card at bottom */}
      <div className="p-3 bg-gradient-to-br from-slate-50 to-emerald-50/50 rounded-2xl border border-slate-100">
        <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
          <span>Quỹ Phép Năm</span>
          <span className="text-emerald-600 font-extrabold">{user.annualLeaveQuota - user.annualLeaveUsed}/{user.annualLeaveQuota} ngày</span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, ((user.annualLeaveQuota - user.annualLeaveUsed) / user.annualLeaveQuota) * 100))}%` }}
          />
        </div>
        <div className="text-[10px] text-slate-500 mt-1.5 flex justify-between">
          <span>Đã dùng: {user.annualLeaveUsed} ngày</span>
          <span>Còn lại: {Math.max(0, user.annualLeaveQuota - user.annualLeaveUsed)}</span>
        </div>
      </div>
    </aside>
  );
}
