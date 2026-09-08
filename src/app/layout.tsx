import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import MobileBottomNav from '@/components/MobileBottomNav';

export const metadata: Metadata = {
  title: 'PEACE GapoWork - Hệ thống Chấm công & Phê duyệt Doanh nghiệp',
  description: 'Nền tảng chấm công GPS Selfie và quy trình phê duyệt đa cấp chuẩn doanh nghiệp',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#00BA74',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col">
        <AuthProvider>
          <Navbar />
          <div className="flex-1 flex w-full">
            <Sidebar />
            <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </div>
          <MobileBottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
