'use client';

import { useState, useEffect, useCallback } from 'react';

import { Pencil, UserX, UserPlus, Search, X, UserCheck, Trash2 } from 'lucide-react';
import { AnimatedRow } from '@/components/ui/AnimatedList';

import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { usersApi } from '@/lib/api';
import { formatDate, getRoleLabel } from '@/lib/utils';

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
  const [confirmActivate, setConfirmActivate] = useState<string | null>(null);
  const [confirmHardDelete, setConfirmHardDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'qc' });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await usersApi.getAll();
      setUsers(data);
    } catch {
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

  const handleHardDelete = async () => {
    if (!confirmHardDelete) return;
    try {
      await usersApi.hardDelete(confirmHardDelete);
      toast.success('User dihapus permanen');
      setConfirmHardDelete(null);
      fetchUsers();
    } catch {
      toast.error('Gagal menghapus user');
    }
  };

  const handleActivate = async () => {
    if (!confirmActivate) return;
    try {
      await usersApi.update(confirmActivate, { is_active: true });
      toast.success('User diaktifkan kembali');
      setConfirmActivate(null);
      fetchUsers();
    } catch {
      toast.error('Gagal mengaktifkan user');
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
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Manajemen User</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{users.length} total pengguna terdaftar</p>
          </div>
          <button onClick={() => { setEditUser(null); setFormData({ name: '', email: '', password: '', role: 'qc' }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
            <UserPlus size={16} />
            Tambah User
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau email..."
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-800 dark:text-white/90 placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500" />
          </div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-800 dark:text-white/90 focus:border-orange-500">
            <option value="">Semua Role</option>
            {ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
          </select>
        </div>

        {/* Users Table */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/30">
                {['Nama', 'Email', 'Role', 'Status', 'Terdaftar', 'Aksi'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-400 dark:text-gray-500 font-semibold py-3 px-4 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-200 dark:border-gray-800/50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="py-3 px-4"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.map((user, i) => (
                <AnimatedRow key={user.id} index={i} className="border-b border-gray-200 dark:border-gray-800/50 table-row-hover">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-800 dark:text-white/90 text-xs font-bold">{user.name.charAt(0)}</span>
                      </div>
                      <span className="text-gray-800 dark:text-white/90 font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="py-3 px-4">
                    <span className={cn('badge text-xs', ROLE_COLORS[user.role])}>{getRoleLabel(user.role)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={cn('badge text-xs', user.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-500/20 text-gray-500 dark:text-gray-400 border-slate-500/30')}>
                      {user.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 dark:text-gray-500 text-xs">{formatDate(user.created_at)}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(user)} title="Edit user"
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white/90 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setConfirmHardDelete(user.id)} title="Hapus permanen"
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                      {user.is_active ? (
                        <button onClick={() => setConfirmDeactivate(user.id)} title="Nonaktifkan user"
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                          <UserX size={14} />
                        </button>
                      ) : (
                        <button onClick={() => setConfirmActivate(user.id)} title="Aktifkan kembali"
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors">
                          <UserCheck size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </AnimatedRow>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">Tidak ada user ditemukan</div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm w-full max-w-md p-6">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-white/90">
              <X size={18} />
            </button>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-5">{editUser ? 'Edit User' : 'Tambah User Baru'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Nama Lengkap</label>
                <input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500" />
              </div>
              {!editUser && (
                <>
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} required
                      className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                    <input type="password" value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} required
                      className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
                <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500">
                  {ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm transition-colors">
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

      <ConfirmModal
        isOpen={!!confirmHardDelete}
        title="Hapus User Permanen"
        message="User ini akan dihapus secara permanen dan tidak dapat dikembalikan. Yakin melanjutkan?"
        confirmText="Hapus Permanen"
        variant="danger"
        onConfirm={handleHardDelete}
        onCancel={() => setConfirmHardDelete(null)}
      />

      <ConfirmModal
        isOpen={!!confirmActivate}
        title="Aktifkan User"
        message="User ini akan diaktifkan kembali dan dapat login. Yakin melanjutkan?"
        confirmText="Aktifkan"
        variant="info"
        onConfirm={handleActivate}
        onCancel={() => setConfirmActivate(null)}
      />
    </DashboardLayout>
  );
}
