'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Send, CheckCircle2, Bot, Shield, Bell } from 'lucide-react';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<{ [key: string]: string }>({
    COMPANY_NAME: 'PEACE HOLDINGS & TECHNOLOGY JSC',
    GLOBAL_GRACE_PERIOD_LATE: '15',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((d) => {
        if (d.settings) {
          setSettings((prev) => ({ ...prev, ...d.settings }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Save settings first
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      // Test message
      const token = settings.TELEGRAM_BOT_TOKEN;
      const chatId = settings.TELEGRAM_CHAT_ID;

      if (!token || !chatId) {
        setTestResult('Vui lòng điền đủ Bot Token và Chat ID trước khi test.');
        return;
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🤖 <b>[PEACE GAPOWORK]</b>\n✅ Kết nối Telegram Bot thành công! Bạn sẽ nhận được thông báo khi có phiếu mới cần duyệt.',
          parse_mode: 'HTML',
        }),
      });

      if (res.ok) {
        setTestResult('Gửi tin nhắn thử nghiệm thành công! Vui lòng kiểm tra Telegram của bạn.');
      } else {
        const d = await res.json();
        setTestResult(`Lỗi kết nối Telegram: ${d.description || 'Sai Bot Token hoặc Chat ID'}`);
      }
    } catch (err: any) {
      setTestResult(`Lỗi: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600" />
          Cấu Hình Hệ Thống & Tích Hợp Telegram
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Quản lý thông tin doanh nghiệp, dung sai chấm công và kết nối bot thông báo tự động
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          Đã lưu cấu hình hệ thống thành công!
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
        {/* Company Settings */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-500" />
            1. Thông Tin Doanh Nghiệp
          </h2>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tên công ty / tổ chức</label>
            <input
              type="text"
              value={settings.COMPANY_NAME || ''}
              onChange={(e) => setSettings({ ...settings, COMPANY_NAME: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
            />
          </div>
        </div>

        {/* Attendance Settings */}
        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-500" />
            2. Quy Định Chấm Công Chung
          </h2>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Dung sai cho phép đi muộn mặc định (phút)
            </label>
            <input
              type="number"
              value={settings.GLOBAL_GRACE_PERIOD_LATE || '15'}
              onChange={(e) => setSettings({ ...settings, GLOBAL_GRACE_PERIOD_LATE: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Telegram Bot Integration */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-600" />
              3. Tích Hợp Telegram Bot Thông Báo
            </h2>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            Tự động gửi thông báo đến Group hoặc Chat cá nhân của Quản lý / Giám đốc ngay khi nhân viên tạo phiếu mới cần duyệt hoặc khi hoàn tất duyệt phiếu.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Telegram Bot Token</label>
              <input
                type="text"
                placeholder="VD: 123456789:ABCdefGhIJKlmNoPQRstUVwxyZ..."
                value={settings.TELEGRAM_BOT_TOKEN || ''}
                onChange={(e) => setSettings({ ...settings, TELEGRAM_BOT_TOKEN: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Telegram Chat ID (Group hoặc Cá nhân)</label>
              <input
                type="text"
                placeholder="VD: -1001234567890 hoặc 987654321"
                value={settings.TELEGRAM_CHAT_ID || ''}
                onChange={(e) => setSettings({ ...settings, TELEGRAM_CHAT_ID: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testing || !settings.TELEGRAM_BOT_TOKEN}
              className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {testing ? 'Đang gửi test...' : 'Gửi tin nhắn Test thử'}
            </button>

            {testResult && (
              <div className="p-3 bg-slate-50 border border-slate-200 text-xs font-medium rounded-xl text-slate-700">
                {testResult}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu Tất Cả Cấu Hình'}
          </button>
        </div>
      </form>
    </div>
  );
}
