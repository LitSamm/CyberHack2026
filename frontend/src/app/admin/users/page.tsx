'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { usersApi } from '@/lib/api';
import { formatDate, getRoleLabel } from '@/lib/utils';
import { UserPlus, Search, Edit2, UserX, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const ROLES = ['admin', 'qc', 'ppic', 'warehouse'];
const ROLE_COLORS: Record<string, string> = {
  admin: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  qc: 'text-green-400 bg-green-400/10 border-green-400/20',
  ppic: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  warehouse: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'qc' });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await usersApi.getAll();
      setUsers(data);
    } catch (err) {
      toast.error('Gagal memuat data user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editUser) {
        await usersApi.update(editUser.id, { name: formData.name, role: formData.role });
        toast.success('User berhasil diperbarui');
      } else {
        await usersApi.create(formData);
        toast.success('User berhasil dibuat');
      }
      setShowForm(false);
      setEditUser(null);
      setFormData({ name: '', email: '', password: '', role: 'qc' });
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return;
    try {
      await usersApi.deactivate(confirmDeactivate);
      toast.success('User dinonaktifkan');
      setConfirmDeactivate(null);
      fetchUsers();
    } catch {
      toast.error('Gagal menonaktifkan user');
    }
  };

  const openEdit = (user: any) => {
    setEditUser(user);
    setFormData({ name: user.name, email: user.email, password: '', role: user.role });
    setShowForm(true);
  };

  return (
    <DashboardLayout allowedRoles={['admin']} onRefresh={fetchUsers}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Manajemen User</h1>
            <p className="text-slate-400 text-sm mt-1">{users.length} total pengguna terdaftar</p>
          </div>
          <button onClick={() => { setEditUser(null); setFormData({ name: '', email: '', password: '', role: 'qc' }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
            <UserPlus className="w-4 h-4" />
            Tambah User
          </button>
        </div>

        {/* Filters */}
        <div className="glass-card p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau email..."
              className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500" />
          </div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500">
            <option value="">Semua Role</option>
            {ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
          </select>
        </div>

        {/* Users Table */}
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/30">
                {['Nama', 'Email', 'Role', 'Status', 'Terdaftar', 'Aksi'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-semibold py-3 px-4 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="py-3 px-4"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.map(user => (
                <tr key={user.id} className="border-b border-slate-800/50 table-row-hover">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{user.name.charAt(0)}</span>
                      </div>
                      <span className="text-white font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{user.email}</td>
                  <td className="py-3 px-4">
                    <span className={cn('badge text-xs', ROLE_COLORS[user.role])}>{getRoleLabel(user.role)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={cn('badge text-xs', user.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30')}>
                      {user.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{formatDate(user.created_at)}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(user)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {user.is_active && (
                        <button onClick={() => setConfirmDeactivate(user.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500">Tidak ada user ditemukan</div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative glass-card w-full max-w-md p-6">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-semibold text-white mb-5">{editUser ? 'Edit User' : 'Tambah User Baru'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Nama Lengkap</label>
                <input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500" />
              </div>
              {!editUser && (
                <>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1.5">Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} required
                      className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1.5">Password</label>
                    <input type="password" value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} required
                      className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Role</label>
                <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500">
                  {ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-600 text-slate-300 hover:bg-slate-700 rounded-lg text-sm transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDeactivate}
        title="Nonaktifkan User"
        message="User ini akan dinonaktifkan dan tidak dapat login. Yakin melanjutkan?"
        confirmText="Nonaktifkan"
        variant="danger"
        onConfirm={handleDeactivate}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </DashboardLayout>
  );
}
