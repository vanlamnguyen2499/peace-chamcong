'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Plus, MapPin, Edit2, CheckCircle2, Navigation } from 'lucide-react';

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    latitude: 21.028511,
    longitude: 105.854167,
    radiusMeters: 300,
    wifiBssids: '',
  });
  const [modalLoading, setModalLoading] = useState(false);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/branches');
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenCreate = () => {
    setEditingBranch(null);
    setFormData({
      name: '',
      code: `BR_${branches.length + 1}`,
      address: '',
      latitude: 21.028511,
      longitude: 105.854167,
      radiusMeters: 300,
      wifiBssids: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (b: any) => {
    setEditingBranch(b);
    setFormData({
      name: b.name,
      code: b.code,
      address: b.address,
      latitude: b.latitude,
      longitude: b.longitude,
      radiusMeters: b.radiusMeters,
      wifiBssids: b.wifiBssids || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      let res;
      if (editingBranch) {
        res = await fetch(`/api/admin/branches/${editingBranch.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        res = await fetch('/api/admin/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }

      if (res.ok) {
        setShowModal(false);
        await fetchBranches();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setModalLoading(false);
    }
  };

  const getCurrentGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-600" />
            Chi Nhánh & Vùng Phủ Sóng GPS
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Cấu hình tọa độ GPS kinh độ, vĩ độ và bán kính Geofencing cho phép chấm công</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" /> Thêm Chi Nhánh
        </button>
      </div>

      {/* Grid of branches */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map((b) => (
          <div key={b.id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {b.code}
                </span>
                <h3 className="font-extrabold text-slate-900 text-base mt-1">{b.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{b.address || 'Chưa cập nhật địa chỉ'}</span>
                </p>
              </div>
              <button
                onClick={() => handleOpenEdit(b)}
                className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1.5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Tọa độ GPS:</span>
                <strong className="font-mono text-slate-800">{b.latitude.toFixed(6)}, {b.longitude.toFixed(6)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bán kính cho phép:</span>
                <strong className="text-emerald-700 font-bold">{b.radiusMeters} mét</strong>
              </div>
              {b.wifiBssids && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Wi-Fi hợp lệ:</span>
                  <span className="font-mono text-[11px] text-slate-700 truncate max-w-[180px]">{b.wifiBssids}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingBranch ? 'Cập Nhật Chi Nhánh' : 'Thêm Chi Nhánh Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên chi nhánh *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="VD: Hà Nội - Trụ sở chính"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã chi nhánh *</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="VD: HN_HQ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ chi tiết</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Số nhà, đường, quận, thành phố..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vĩ độ (Latitude)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kinh độ (Longitude)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={getCurrentGps}
                className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-600" /> Lấy tọa độ GPS hiện tại của tôi
              </button>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bán kính Geofence (mét) *</label>
                <input
                  type="number"
                  required
                  value={formData.radiusMeters}
                  onChange={(e) => setFormData({ ...formData, radiusMeters: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-bold text-slate-600 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
