'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  Plus,
  Search,
  Building,
  MapPin,
  Shield,
  Edit2,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
} from 'lucide-react';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    employeeCode: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'EMPLOYEE',
    position: '',
    branchId: '',
    departmentId: '',
    managerId: '',
    annualLeaveQuota: 12,
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    fetch('/api/admin/branches')
      .then((res) => res.json())
      .then((d) => setBranches(d.branches || []))
      .catch(() => {});

    fetch('/api/admin/departments')
      .then((res) => res.json())
      .then((d) => setDepartments(d.departments || []))
      .catch(() => {});
  }, []);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      employeeCode: `NV00${users.length + 1}`,
      name: '',
      email: '',
      password: 'user123',
      phone: '',
      role: 'EMPLOYEE',
      position: '',
      branchId: branches[0]?.id || '',
      departmentId: departments[0]?.id || '',
      managerId: '',
      annualLeaveQuota: 12,
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (u: any) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      phone: u.phone || '',
      role: u.role,
      position: u.position || '',
      branchId: u.branch?.id || '',
      departmentId: u.department?.id || '',
      managerId: u.manager?.id || '',
      annualLeaveQuota: u.annualLeaveQuota,
      password: '',
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);

    try {
      let res;
      if (editingUser) {
        res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi lưu thông tin nhân sự');

      setShowModal(false);
      await fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'Lỗi xử lý');
    } finally {
      setModalLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.employeeCode.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Super Admin</span>;
      case 'HR_ADMIN':
        return <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">HR Admin</span>;
      case 'MANAGER':
        return <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Quản lý</span>;
      default:
        return <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Nhân viên</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Quản Lý Hồ Sơ Nhân Sự
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Danh sách nhân viên, phân quyền vai trò, gán chi nhánh và quỹ phép năm</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Thêm Nhân Viên
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm theo tên nhân viên, mã NV, email..."
          className="flex-1 bg-transparent text-xs focus:outline-none text-slate-800"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Đang tải danh sách nhân sự...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="p-3.5">Mã NV</th>
                  <th className="p-3.5">Họ và Tên</th>
                  <th className="p-3.5">Vai trò</th>
                  <th className="p-3.5">Phòng ban</th>
                  <th className="p-3.5">Chi nhánh</th>
                  <th className="p-3.5 text-center">Quỹ Phép</th>
                  <th className="p-3.5 text-center">Trạng thái</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">{u.employeeCode}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-[10px] text-slate-400">{u.email}</div>
                    </td>
                    <td className="p-3.5">{getRoleBadge(u.role)}</td>
                    <td className="p-3.5 text-slate-600">{u.department?.name || '-'}</td>
                    <td className="p-3.5 text-slate-600">{u.branch?.name || '-'}</td>
                    <td className="p-3.5 text-center font-bold text-emerald-700">
                      {u.annualLeaveQuota - u.annualLeaveUsed}/{u.annualLeaveQuota}
                    </td>
                    <td className="p-3.5 text-center">
                      {u.isActive ? (
                        <span className="text-emerald-600 font-semibold flex items-center justify-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Hoạt động
                        </span>
                      ) : (
                        <span className="text-rose-500 font-semibold flex items-center justify-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Đã khóa
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add / Edit User */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingUser ? `Chỉnh Sửa Nhân Viên: ${editingUser.name}` : 'Thêm Nhân Viên Mới'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-3.5">
              {!editingUser && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mã NV *</label>
                    <input
                      type="text"
                      required
                      value={formData.employeeCode}
                      onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu ban đầu *</label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Họ và Tên *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email công việc *</label>
                  <input
                    type="email"
                    required={!editingUser}
                    disabled={Boolean(editingUser)}
                    value={editingUser ? editingUser.email : formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chức danh</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="VD: Kỹ sư phần mềm"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vai trò hệ thống</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="EMPLOYEE">Nhân viên (Employee)</option>
                    <option value="MANAGER">Quản lý (Manager)</option>
                    <option value="HR_ADMIN">HR Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quỹ phép năm (ngày)</label>
                  <input
                    type="number"
                    value={formData.annualLeaveQuota}
                    onChange={(e) => setFormData({ ...formData, annualLeaveQuota: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phòng ban</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chi nhánh làm việc</label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Chọn chi nhánh --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quản lý trực tiếp</label>
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Không có (Ban Giám Đốc) --</option>
                  {users.filter((u) => u.id !== editingUser?.id).map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.employeeCode} - {u.role})</option>
                  ))}
                </select>
              </div>

              {editingUser && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đặt lại mật khẩu mới (nếu muốn)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Để trống nếu không đổi..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {modalLoading ? 'Đang lưu...' : 'Lưu Thông Tin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
