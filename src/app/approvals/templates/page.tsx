'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Plus, FileText, CheckCircle2, ShieldCheck, Trash2 } from 'lucide-react';

export default function ApprovalTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form builder state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<any[]>([
    { name: 'reason', label: 'Lý do', type: 'textarea', required: true },
  ]);
  const [steps, setSteps] = useState<any[]>([
    { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt' },
  ]);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/approvals/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const addField = () => {
    setFields([
      ...fields,
      { name: `field_${fields.length + 1}`, label: `Trường ${fields.length + 1}`, type: 'text', required: true },
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, key: string, value: any) => {
    const updated = [...fields];
    updated[index][key] = value;
    setFields(updated);
  };

  const addStep = () => {
    setSteps([
      ...steps,
      { stepOrder: steps.length + 1, approverRole: 'HR_ADMIN', label: `Cấp duyệt ${steps.length + 1}` },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    setSaving(true);
    try {
      const res = await fetch('/api/approvals/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code: code.toUpperCase().trim(),
          description,
          schemaFields: fields,
          defaultSteps: steps,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setName('');
        setCode('');
        setDescription('');
        await fetchTemplates();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600" />
            Mẫu Đơn Duyệt & Thiết Kế Form (Form Builder)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý các mẫu đơn chuẩn và tạo thêm mẫu đơn tùy biến với các trường dữ liệu động
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" /> Thiết Kế Mẫu Đơn Mới
        </button>
      </div>

      {/* Grid of templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => (
          <div key={tpl.id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                  {tpl.code}
                </span>
                <h3 className="font-extrabold text-slate-900 text-base mt-1">{tpl.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{tpl.description}</p>
              </div>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {tpl.schemaFields?.length || 0} trường dữ liệu
              </span>
            </div>

            {/* Steps Chain */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <div className="font-bold text-slate-700 mb-1">Luồng phê duyệt:</div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1 flex-wrap">
                {tpl.defaultSteps?.map((s: any, idx: number) => (
                  <span key={idx} className="bg-white px-2 py-0.5 rounded border border-slate-200 font-medium">
                    {idx > 0 && '➔ '}
                    {s.label || s.approverRole || `Cấp ${s.stepOrder}`}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal Form Builder */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Thiết Kế Mẫu Đơn Tùy Biến</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên mẫu đơn *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Đơn Đề Xuất Công Tác"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã mẫu đơn *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="VD: BUSINESS_TRIP"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả ngắn</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả mục đích sử dụng đơn..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Dynamic Field Builder */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">Các trường dữ liệu trong form:</span>
                  <button
                    type="button"
                    onClick={addField}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm trường
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {fields.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <input
                        type="text"
                        value={f.name}
                        onChange={(e) => updateField(idx, 'name', e.target.value)}
                        placeholder="Tên biến (VD: reason)"
                        className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => updateField(idx, 'label', e.target.value)}
                        placeholder="Nhãn hiển thị"
                        className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <select
                        value={f.type}
                        onChange={(e) => updateField(idx, 'type', e.target.value)}
                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="text">Văn bản</option>
                        <option value="number">Số</option>
                        <option value="date">Ngày</option>
                        <option value="time">Giờ</option>
                        <option value="textarea">Đoạn dài</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeField(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Step Builder */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">Các cấp duyệt:</span>
                  <button
                    type="button"
                    onClick={addStep}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm cấp
                  </button>
                </div>

                <div className="space-y-2">
                  {steps.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                      <span className="font-bold text-slate-500 w-16">Cấp {idx + 1}:</span>
                      <input
                        type="text"
                        value={s.label}
                        onChange={(e) => {
                          const upd = [...steps];
                          upd[idx].label = e.target.value;
                          setSteps(upd);
                        }}
                        className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <select
                        value={s.approverRole}
                        onChange={(e) => {
                          const upd = [...steps];
                          upd[idx].approverRole = e.target.value;
                          setSteps(upd);
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="MANAGER">Quản lý trực tiếp</option>
                        <option value="HR_ADMIN">HR Admin</option>
                        <option value="SUPER_ADMIN">Ban Giám Đốc</option>
                      </select>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  {saving ? 'Đang tạo...' : 'Lưu Mẫu Đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
