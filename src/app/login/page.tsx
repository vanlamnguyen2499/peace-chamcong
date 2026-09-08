'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { refreshUser } = useAuth();

  const handleLogin = async (e: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const loginEmail = customEmail || email;
    const loginPass = customPass || password;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đăng nhập thất bại');
      }

      await refreshUser();
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Lỗi đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { name: 'Nguyễn Văn Admin', role: 'Super Admin', email: 'admin@peace.vn', pass: 'admin123', bg: 'from-purple-500 to-indigo-600' },
    { name: 'Trần Thị Thu Hà (HR)', role: 'HR Admin', email: 'hr@peace.vn', pass: 'admin123', bg: 'from-blue-500 to-cyan-600' },
    { name: 'Lê Hoàng Manager', role: 'Quản Lý Tech', email: 'manager@peace.vn', pass: 'admin123', bg: 'from-amber-500 to-orange-600' },
    { name: 'Nguyễn Văn Lâm', role: 'Nhân Viên Tech', email: 'lam@peace.vn', pass: 'user123', bg: 'from-emerald-500 to-teal-600' },
  ];

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 sm:p-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/25 text-white font-extrabold text-2xl mb-3">
            P
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">PEACE GapoWork</h1>
          <p className="text-xs text-slate-500 mt-1">Đăng nhập vào Hệ thống Chấm công & Phê duyệt</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email công việc</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@peace.vn"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Đăng nhập hệ thống
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Switch Demo Accounts */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Tài khoản Demo thử nghiệm nhanh:</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword(acc.pass);
                  handleLogin(null as any, acc.email, acc.pass);
                }}
                className="p-2.5 rounded-xl border border-slate-200/80 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/50 text-left transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-5 h-5 rounded-md bg-gradient-to-tr ${acc.bg} text-white font-bold text-[10px] flex items-center justify-center`}>
                    {acc.name.charAt(0)}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{acc.role}</span>
                </div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 truncate">{acc.name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{acc.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
