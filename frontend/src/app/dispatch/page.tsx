'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { dispatchApi, lotsApi } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Truck, Plus, X, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const DISPATCH_STATUSES = ['prepared', 'shipped', 'delivered'];
const STATUS_LABELS: Record<string, string> = {
  prepared: 'Siap Kirim',
  shipped: 'Dalam Perjalanan',
  delivered: 'Terkirim',
};
const STATUS_NEXT: Record<string, string> = {
  prepared: 'shipped',
  shipped: 'delivered',
};

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [formData, setFormData] = useState({
    lot_id: '', customer_name: '', destination: '', dispatch_date: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dispRes, lotsRes] = await Promise.all([
        dispatchApi.getAll(filterStatus ? { status: filterStatus } : undefined),
        lotsApi.getAll({ status: 'completed' }),
      ]);
      setDispatches(dispRes.data);
      setLots(lotsRes.data);
    } catch { toast.error('Gagal memuat data pengiriman'); }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await dispatchApi.create({
        ...formData,
        dispatch_date: formData.dispatch_date || new Date().toISOString(),
      });
      toast.success('✅ Pengiriman berhasil dibuat');
      setShowForm(false);
      setFormData({ lot_id: '', customer_name: '', destination: '', dispatch_date: '', notes: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal membuat pengiriman');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (dispatch: any) => {
    const nextStatus = STATUS_NEXT[dispatch.status];
    if (!nextStatus) return;
    try {
      await dispatchApi.update(dispatch.id, { status: nextStatus });
      toast.success(`Status diperbarui: ${STATUS_LABELS[nextStatus]}`);
      fetchData();
    } catch { toast.error('Gagal update status'); }
  };

  const stats = {
    total: dispatches.length,
    prepared: dispatches.filter(d => d.status === 'prepared').length,
    shipped: dispatches.filter(d => d.status === 'shipped').length,
    delivered: dispatches.filter(d => d.status === 'delivered').length,
  };

  return (
    <DashboardLayout allowedRoles={['warehouse', 'ppic', 'admin']} onRefresh={fetchData}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Pengiriman (Dispatch)</h1>
            <p className="text-slate-400 text-sm mt-1">Kelola pengiriman produk ke customer</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Buat Pengiriman
          </button>
        </div>

        {/* Mini Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Siap Kirim', value: stats.prepared, color: 'text-orange-400' },
            { label: 'Dalam Perjalanan', value: stats.shipped, color: 'text-blue-400' },
            { label: 'Terkirim', value: stats.delivered, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="glass-card p-4 text-center">
              <div className={cn('text-2xl font-bold mb-1', s.color)}>{s.value}</div>
              <div className="text-slate-400 text-xs">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="glass-card p-4 flex gap-3">
          <div className="flex gap-2 flex-wrap">
            {['', ...DISPATCH_STATUSES].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  filterStatus === s
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                )}>
                {s === '' ? 'Semua' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Dispatch Table */}
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/30">
                {['Lot', 'Customer', 'Tujuan', 'Tanggal', 'Status', 'Dikirim Oleh', 'Aksi'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-semibold py-3 px-4 uppercase tracking-wide">{h}</th>
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
              ) : dispatches.map(d => (
                <tr key={d.id} className="border-b border-slate-800/50 table-row-hover">
                  <td className="py-3 px-4">
                    <span className="font-mono text-orange-400 text-xs font-semibold">{d.lots?.lot_number}</span>
                  </td>
                  <td className="py-3 px-4 text-white font-medium text-sm">{d.customer_name}</td>
                  <td className="py-3 px-4 text-slate-400 text-sm">{d.destination}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{formatDate(d.dispatch_date)}</td>
                  <td className="py-3 px-4"><StatusBadge status={d.status} /></td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{d.users?.name || '-'}</td>
                  <td className="py-3 px-4">
                    {STATUS_NEXT[d.status] && (
                      <button onClick={() => handleUpdateStatus(d)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs rounded-lg transition-colors">
                        <Truck className="w-3 h-3" />
                        {STATUS_LABELS[STATUS_NEXT[d.status]]}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && dispatches.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-10 h-10 mx-auto text-slate-700 mb-2" />
              <p className="text-slate-500">Belum ada pengiriman</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Dispatch Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative glass-card w-full max-w-md p-6">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-semibold text-white mb-5">Buat Pengiriman Baru</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Pilih Lot (Status: Selesai)</label>
                <select value={formData.lot_id} onChange={e => setFormData(p => ({ ...p, lot_id: e.target.value }))} required
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500">
                  <option value="">Pilih lot...</option>
                  {lots.map(lot => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_number} — {lot.incoming_materials?.material_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Nama Customer</label>
                <input value={formData.customer_name} onChange={e => setFormData(p => ({ ...p, customer_name: e.target.value }))} required
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Tujuan Pengiriman</label>
                <input value={formData.destination} onChange={e => setFormData(p => ({ ...p, destination: e.target.value }))} required
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Tanggal Pengiriman</label>
                <input type="date" value={formData.dispatch_date} onChange={e => setFormData(p => ({ ...p, dispatch_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Catatan</label>
                <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm resize-none focus:border-orange-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-600 text-slate-300 hover:bg-slate-700 rounded-lg text-sm transition-colors">Batal</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {saving ? 'Memproses...' : 'Buat Pengiriman'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
