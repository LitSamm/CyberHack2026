'use client';

import { useState, useEffect, useCallback } from 'react';

import { PaperPlaneIcon, PlusIcon, CloseIcon, BoxIcon } from '@/icons';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { supabaseDispatchApi, supabaseLotsApi } from '@/lib/supabase-api';
import { formatDate, formatDateTime } from '@/lib/utils';

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
      const [dispatchData, lotsData] = await Promise.all([
        supabaseDispatchApi.getAll(filterStatus ? { status: filterStatus } : undefined),
        supabaseLotsApi.getAll({ status: 'completed' }),
      ]);
      setDispatches(dispatchData || []);
      setLots(lotsData || []);
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
      await supabaseDispatchApi.create({
        ...formData,
        dispatch_date: formData.dispatch_date || new Date().toISOString(),
      });
      toast.success('Pengiriman berhasil dibuat');
      setShowForm(false);
      setFormData({ lot_id: '', customer_name: '', destination: '', dispatch_date: '', notes: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membuat pengiriman');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (dispatch: any) => {
    const nextStatus = STATUS_NEXT[dispatch.status];
    if (!nextStatus) return;
    try {
      await supabaseDispatchApi.update(dispatch.id, { status: nextStatus });
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
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Pengiriman (Dispatch)</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Kelola pengiriman produk ke customer</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-gray-800 dark:text-white/90 rounded-lg text-sm font-medium transition-colors">
            
            Buat Pengiriman
          </button>
        </div>

        {/* Mini Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-800 dark:text-white/90' },
            { label: 'Siap Kirim', value: stats.prepared, color: 'text-orange-400' },
            { label: 'Dalam Perjalanan', value: stats.shipped, color: 'text-blue-400' },
            { label: 'Terkirim', value: stats.delivered, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-4 text-center">
              <div className={cn('text-2xl font-bold mb-1', s.color)}>{s.value}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-4 flex gap-3">
          <div className="flex gap-2 flex-wrap">
            {['', ...DISPATCH_STATUSES].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  filterStatus === s
                    ? 'bg-orange-500 text-gray-800 dark:text-white/90'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-white/90 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}>
                {s === '' ? 'Semua' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Dispatch Table */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/30">
                {['Lot', 'Customer', 'Tujuan', 'Tanggal', 'Status', 'Dikirim Oleh', 'Aksi'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-400 dark:text-gray-500 font-semibold py-3 px-4 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-200 dark:border-gray-800/50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-3 px-4"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : dispatches.map(d => (
                <tr key={d.id} className="border-b border-gray-200 dark:border-gray-800/50 table-row-hover">
                  <td className="py-3 px-4">
                    <span className="font-mono text-orange-400 text-xs font-semibold">{d.lots?.lot_number}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-800 dark:text-white/90 font-medium text-sm">{d.customer_name}</td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{d.destination}</td>
                  <td className="py-3 px-4 text-gray-400 dark:text-gray-500 text-xs">{formatDate(d.dispatch_date)}</td>
                  <td className="py-3 px-4"><StatusBadge status={d.status} /></td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs">{d.users?.name || '-'}</td>
                  <td className="py-3 px-4">
                    {STATUS_NEXT[d.status] && (
                      <button onClick={() => handleUpdateStatus(d)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs rounded-lg transition-colors">
                        
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
              
              <p className="text-gray-400 dark:text-gray-500">Belum ada pengiriman</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Dispatch Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm w-full max-w-md p-6">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-white/90">
              
            </button>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-5">Buat Pengiriman Baru</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Pilih Lot (Status: Selesai)</label>
                <select value={formData.lot_id} onChange={e => setFormData(p => ({ ...p, lot_id: e.target.value }))} required
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500">
                  <option value="">Pilih lot...</option>
                  {lots.map(lot => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_number} — {lot.incoming_materials?.material_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Nama Customer</label>
                <input value={formData.customer_name} onChange={e => setFormData(p => ({ ...p, customer_name: e.target.value }))} required
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Tujuan Pengiriman</label>
                <input value={formData.destination} onChange={e => setFormData(p => ({ ...p, destination: e.target.value }))} required
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Tanggal Pengiriman</label>
                <input type="date" value={formData.dispatch_date} onChange={e => setFormData(p => ({ ...p, dispatch_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Catatan</label>
                <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm resize-none focus:border-orange-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm transition-colors">Batal</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-gray-800 dark:text-white/90 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
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
