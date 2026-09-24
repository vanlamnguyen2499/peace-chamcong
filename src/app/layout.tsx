import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import MobileBottomNav from '@/components/MobileBottomNav';
import LayoutWrapper from '@/components/LayoutWrapper';

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
            <LayoutWrapper>
              {children}
            </LayoutWrapper>
          </div>
          <MobileBottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
