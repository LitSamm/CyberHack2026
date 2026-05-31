'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { supabaseMaterialsApi, supabaseSuppliersApi } from '@/lib/supabase-api';
import { formatDate } from '@/lib/utils';
import { AnimatedRow } from '@/components/ui/AnimatedList';
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
    try {
      await supabaseMaterialsApi.receive({
        supplier_id: formData.supplier_id,
        material_name: formData.material_name,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        received_date: formData.received_date || new Date().toISOString(),
        notes: formData.notes || undefined,
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
    try {
      await supabaseMaterialsApi.cancelIntake(confirmDelete);
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Material Intake</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Pintu masuk resmi material dari supplier sebelum QC dan PPIC</p>
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
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Cari material atau supplier..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl pl-10 pr-4 py-2.5 focus:border-orange-500 text-sm" />
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
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:text-white dark:hover:bg-slate-700'
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
              <tr className="border-b border-slate-200 dark:border-slate-700">
                {['Material', 'Supplier', 'Quantity', 'Tanggal Terima', 'Status QC', 'Catatan', 'Aksi'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-200 dark:border-slate-800">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-3 px-4"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredMaterials.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Tidak ada material</td></tr>
              ) : filteredMaterials.map((material, i) => (
                <AnimatedRow key={material.id} index={i} className="border-b border-slate-200 dark:border-slate-700/50 table-row-hover">
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-white">{material.material_name}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{material.suppliers?.name || '-'}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">{material.quantity} {material.unit}</td>
                  <td className="py-3 px-4 text-slate-500">{formatDate(material.received_date)}</td>
                  <td className="py-3 px-4"><StatusBadge status={material.qc_status} /></td>
                  <td className="py-3 px-4 text-slate-500 text-xs max-w-xs truncate">{material.notes || '-'}</td>
                  <td className="py-3 px-4">
                    {material.qc_status === 'pending' && (
                      <button onClick={() => setConfirmDelete(material.id)} className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-colors" title="Batalkan Intake">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </AnimatedRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative glass-card w-full max-w-md p-6">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 bg-orange-50 dark:bg-orange-500/20 rounded-xl flex items-center justify-center">
                <PackagePlus className="w-5 h-5 text-orange-500 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Catat Material Baru</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Masukkan barang dari supplier ke antrian QC</p>
              </div>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Supplier</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData((p) => ({ ...p, supplier_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-sm focus:border-orange-500"
                >
                  <option value="">Pilih supplier...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Nama Material</label>
                <input
                  value={formData.material_name}
                  onChange={(e) => setFormData((p) => ({ ...p, material_name: e.target.value }))}
                  required
                  placeholder="Minyak Nilam Grade A..."
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-sm focus:border-orange-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData((p) => ({ ...p, quantity: e.target.value }))}
                    required
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-sm focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Satuan Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-sm focus:border-orange-500"
                  >
                    <option value="kg">kg</option>
                    <option value="liter">liter</option>
                    <option value="gram">gram</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Tanggal Terima</label>
                <input
                  type="date"
                  value={formData.received_date}
                  onChange={(e) => setFormData((p) => ({ ...p, received_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-sm focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Catatan Khusus (Opsional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="Suhu harus dijaga di bawah 25°C..."
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-sm resize-none focus:border-orange-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm transition-colors"
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
