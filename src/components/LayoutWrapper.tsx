'use client';
import React from 'react';
import { usePathname } from 'next/navigation';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobileApp = pathname?.startsWith('/m');

  if (isMobileApp) {
    return <main className="flex-1 w-full min-h-screen bg-slate-50">{children}</main>;
  }

  return (
    <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto w-full">
      {children}
    </main>
  );
}
