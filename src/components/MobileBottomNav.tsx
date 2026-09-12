'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Clock, FileCheck, Table, History, User } from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, pendingApprovalsCount } = useAuth();

  if (!user || pathname === '/login') return null;

  const isManager = user.role !== 'EMPLOYEE';

  const navItems = [
    { label: 'Chấm Công', href: '/', icon: Clock },
    {
      label: 'Phiếu Duyệt',
      href: '/approvals',
      icon: FileCheck,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    ...(isManager
      ? [{ label: 'Bảng Công', href: '/admin/timesheet', icon: Table }]
      : [{ label: 'Lịch Sử', href: '/history', icon: History }]),
    { label: 'Cá Nhân', href: '/history', icon: User },
  ];

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {navItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
              active ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${active ? 'text-emerald-600' : 'text-slate-500'}`} />
              {item.badge && (
                <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow-sm animate-pulse">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
