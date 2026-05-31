'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { supabaseMaterialsApi, supabaseSuppliersApi } from '@/lib/supabase-api';
import { createClient } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { PackagePlus, Plus, Search, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const QC_FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'pending', label: 'Pending QC' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function MaterialIntakePage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    supplier_id: '',
    material_name: '',
    quantity: '',
    unit: 'kg',
    received_date: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [matData, supplierData] = await Promise.all([
        supabaseMaterialsApi.getAll(filterStatus ? { status: filterStatus } : undefined),
        supabaseSuppliersApi.getAll(),
      ]);
      setMaterials(matData || []);
      setSuppliers(supplierData || []);
    } catch {
      toast.error('Gagal memuat material masuk');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMaterials = materials.filter((material) => {
    const query = search.toLowerCase();
    return (
      material.material_name?.toLowerCase().includes(query) ||
      material.suppliers?.name?.toLowerCase().includes(query)
    );
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const sb = createClient();
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error('Tidak terautentikasi');

      const { error } = await sb.from('incoming_materials').insert({
        supplier_id: formData.supplier_id,
        material_name: formData.material_name,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        received_date: formData.received_date || new Date().toISOString(),
        received_by: user.id,
        qc_status: 'pending',
        notes: formData.notes || null,
      });
      if (error) throw error;

      await sb.from('audit_logs').insert({
        user_id: user.id,
        action: 'INSERT',
        table_name: 'incoming_materials',
        new_value: {
          material_name: formData.material_name,
          quantity: Number(formData.quantity),
          unit: formData.unit,
        },
      });

      toast.success('Material masuk dicatat dan dikirim ke antrian QC');
      setShowForm(false);
      setFormData({ supplier_id: '', material_name: '', quantity: '', unit: 'kg', received_date: '', notes: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mencatat material');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const sb = createClient();
    try {
      await sb.from('incoming_materials').delete().eq('id', confirmDelete);
      toast.success('Penerimaan material dibatalkan');
      setConfirmDelete(null);
      fetchData();
    } catch {
      toast.error('Gagal membatalkan penerimaan material');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout allowedRoles={['admin', 'warehouse', 'ppic']} onRefresh={fetchData}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Material Intake</h1>
            <p className="text-slate-400 text-sm mt-1">Pintu masuk resmi material dari supplier sebelum QC dan PPIC</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Catat Material
          </button>
        </div>

        <div className="glass-card p-4 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari material atau supplier..."
              className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-orange-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {QC_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterStatus(filter.value)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  filterStatus === filter.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/30">
                {['Material', 'Supplier', 'Quantity', 'Tanggal Terima', 'Status QC', 'Catatan', 'Aksi'].map((heading) => (
                  <th key={heading} className="text-left text-xs text-slate-500 font-semibold py-3 px-4 uppercase tracking-wide">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-3 px-4"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredMaterials.map((material) => (
                <tr key={material.id} className="border-b border-slate-800/50 table-row-hover">
                  <td className="py-3 px-4 text-white font-medium">{material.material_name}</td>
                  <td className="py-3 px-4 text-slate-400">{material.suppliers?.name || '-'}</td>
                  <td className="py-3 px-4 text-slate-300">{material.quantity} {material.unit}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{formatDate(material.received_date)}</td>
                  <td className="py-3 px-4"><StatusBadge status={material.qc_status} /></td>
                  <td className="py-3 px-4 text-slate-500 text-xs max-w-xs truncate">{material.notes || '-'}</td>
                  <td className="py-3 px-4">
                    {material.qc_status === 'pending' && (
                      <button onClick={() => setConfirmDelete(material.id)} className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-colors" title="Batalkan Intake">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filteredMaterials.length === 0 && (
            <div className="text-center py-12">
              <PackagePlus className="w-10 h-10 mx-auto text-slate-700 mb-2" />
              <p className="text-slate-500">Belum ada material masuk</p>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative glass-card w-full max-w-md p-6">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-semibold text-white mb-5">Catat Material Masuk</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Supplier</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData((p) => ({ ...p, supplier_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500"
                >
                  <option value="">Pilih supplier...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Nama Material</label>
                <input
                  value={formData.material_name}
                  onChange={(e) => setFormData((p) => ({ ...p, material_name: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.quantity}
                    onChange={(e) => setFormData((p) => ({ ...p, quantity: e.target.value }))}
                    required
                    className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500"
                  >
                    <option value="kg">kg</option>
                    <option value="liter">liter</option>
                    <option value="gram">gram</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Tanggal Terima</label>
                <input
                  type="date"
                  value={formData.received_date}
                  onChange={(e) => setFormData((p) => ({ ...p, received_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Catatan</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm resize-none focus:border-orange-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-600 text-slate-300 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Batalkan Intake"
        message="Yakin ingin membatalkan dan menghapus data penerimaan material ini?"
        confirmText="Batalkan"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />
    </DashboardLayout>
  );
}
