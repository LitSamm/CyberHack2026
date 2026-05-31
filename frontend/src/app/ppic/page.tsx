'use client';

import { useState, useEffect, useCallback } from 'react';

import { Plus, X, Calendar, Info, Trash2, Download, ArrowRight } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { supabasePpicApi, supabaseMaterialsApi } from '@/lib/supabase-api';
import { formatDate } from '@/lib/utils';

import ExportModal from '@/components/ui/ExportModal';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const COLUMNS = [
  { id: 'queued', label: 'Antri', color: 'border-slate-500' },
  { id: 'in_production', label: 'Produksi', color: 'border-blue-500' },
  { id: 'awaiting_finished_qc', label: 'Menunggu QC Produk Jadi', color: 'border-yellow-500' },
  { id: 'completed', label: 'Released QC', color: 'border-green-500' },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-slate-500/20 text-gray-500 dark:text-gray-400 border-slate-500/30',
};

export default function PPICDashboard() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    material_id: '', scheduled_date: '', priority: 'normal', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sched, mats] = await Promise.all([
        supabasePpicApi.getSchedules(),
        supabaseMaterialsApi.getAll({ status: 'approved' }),
      ]);
      setSchedules(sched || []);
      setMaterials(mats || []);
    } catch { toast.error('Gagal memuat data PPIC'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getColumnSchedules = (status: string) =>
    schedules.filter(s => s.status === status);

  const handleDragStart = (event: React.DragEvent, id: string) => {
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
    setDragging(id);
  };
  const handleDragEnd = () => setDragging(null);

  const moveSchedule = async (scheduleId: string, targetStatus: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule || schedule.status === targetStatus) { setDragging(null); return; }
    if (!['queued', 'in_production'].includes(schedule.status)) {
      toast.error('Lot ini sudah keluar dari kontrol PPIC');
      setDragging(null);
      return;
    }
    if (targetStatus === 'completed') {
      toast.error('Release lot selesai hanya dapat dilakukan oleh QC produk jadi');
      setDragging(null);
      return;
    }
    try {
      await supabasePpicApi.moveSchedule(scheduleId, targetStatus);
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, status: targetStatus } : s));
      toast.success(`Lot dipindah ke ${COLUMNS.find(c => c.id === targetStatus)?.label}`);
    } catch (err: any) { toast.error(err?.message || 'Gagal update status'); }
    setDragging(null);
  };

  const handleDrop = async (event: React.DragEvent, targetStatus: string) => {
    event.preventDefault();
    const scheduleId = event.dataTransfer.getData('text/plain') || dragging;
    if (!scheduleId) return;
    await moveSchedule(scheduleId, targetStatus);
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await supabasePpicApi.createSchedule({
        material_id: formData.material_id,
        scheduled_date: formData.scheduled_date,
        priority: formData.priority,
        notes: formData.notes,
      });
      toast.success('Lot produksi berhasil dibuat dan dijadwalkan');
      setShowForm(false);
      setFormData({ material_id: '', scheduled_date: '', priority: 'normal', notes: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membuat jadwal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await supabasePpicApi.cancelSchedule(confirmDelete);
      toast.success('Jadwal dihapus');
      setConfirmDelete(null);
      fetchData();
    } catch (err: any) { toast.error(err?.message || 'Gagal menghapus jadwal'); }
  };

  return (
    <DashboardLayout allowedRoles={['ppic', 'admin']} onRefresh={fetchData}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">PPIC & Produksi</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manajemen jadwal dan lot produksi</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-white/90 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              Export Jadwal
            </button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
              Buat Jadwal
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colSchedules = getColumnSchedules(col.id);
            return (
              <div key={col.id}
                onDragOver={e => e.preventDefault()}
                onDrop={event => handleDrop(event, col.id)}
                className={cn('rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-4 min-h-64 border-t-2', col.color)}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 dark:text-white/90 text-sm">{col.label}</h3>
                  <span className="text-xs bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                    {colSchedules.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {loading && col.id === 'queued' ? (
                    Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)
                  ) : colSchedules.map(s => {
                    const canMove = ['queued', 'in_production'].includes(s.status);
                    const canDelete = s.status === 'queued';
                    return (
                    <div key={s.id}
                      draggable={canMove}
                      onDragStart={event => handleDragStart(event, s.id)}
                      onDragEnd={handleDragEnd}
                      className={cn('kanban-card bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-800 rounded-xl p-3 cursor-grab active:cursor-grabbing select-none',
                        dragging === s.id ? 'opacity-50 ring-2 ring-orange-500' : '',
                        !canMove && 'cursor-default'
                      )}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Link href={`/lots/${s.lot_id}`} className="font-mono text-orange-400 hover:text-orange-500 text-xs font-semibold">
                          {s.lots?.lot_number || 'SA-???'}
                        </Link>
                        <div className="flex items-center gap-1">
                        {s.status === 'queued' && (
                          <button onClick={() => moveSchedule(s.id, 'in_production')}
                            className="text-slate-500 hover:text-blue-400 transition-colors flex-shrink-0" title="Mulai produksi">
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        {s.status === 'in_production' && (
                          <button onClick={() => moveSchedule(s.id, 'awaiting_finished_qc')}
                            className="text-slate-500 hover:text-yellow-400 transition-colors flex-shrink-0" title="Kirim ke QC produk jadi">
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setConfirmDelete(s.id)}
                            className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        </div>
                      </div>
                      <div className="text-gray-700 dark:text-gray-300 text-xs mb-2 truncate">
                        {s.lots?.incoming_materials?.material_name || 'Material tidak diketahui'}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={cn('badge text-xs', PRIORITY_COLORS[s.priority])}>
                          <Info className="w-3 h-3" />
                          {s.priority === 'urgent' ? 'Urgent' : s.priority === 'normal' ? 'Normal' : 'Rendah'}
                        </span>
                        <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500 text-xs">
                          <Calendar className="w-3 h-3" />
                          {s.scheduled_date ? formatDate(s.scheduled_date) : '-'}
                        </div>
                      </div>
                      {s.notes && (
                        <div className="mt-2 text-gray-400 dark:text-gray-500 text-xs italic truncate">{s.notes}</div>
                      )}
                    </div>
                  )})}

                  {!loading && colSchedules.length === 0 && (
                    <div className="text-center py-6 text-slate-600 text-xs border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
                      Tidak ada lot
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Schedule List Table */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-4">Semua Jadwal</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  {['Lot Number', 'Material', 'Jadwal', 'Prioritas', 'Status', 'Catatan'].map(h => (
                    <th key={h} className="text-left text-xs text-gray-400 dark:text-gray-500 font-semibold pb-3 pr-4 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedules.map(s => (
                  <tr key={s.id} className="border-b border-gray-200 dark:border-gray-800/50 table-row-hover">
                    <td className="py-3 pr-4">
                      <Link href={`/lots/${s.lot_id}`} className="font-mono text-orange-400 hover:text-orange-500 font-semibold text-xs">{s.lots?.lot_number}</Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 text-xs">{s.lots?.incoming_materials?.material_name || '-'}</td>
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400 text-xs">{s.scheduled_date ? formatDate(s.scheduled_date) : '-'}</td>
                    <td className="py-3 pr-4">
                      <span className={cn('badge text-xs', PRIORITY_COLORS[s.priority])}>{s.priority}</span>
                    </td>
                    <td className="py-3 pr-4"><StatusBadge status={s.status} /></td>
                    <td className="py-3 pr-4 text-gray-400 dark:text-gray-500 text-xs">{s.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && schedules.length === 0 && (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">Belum ada jadwal</div>
            )}
          </div>
        </div>
      </div>

      {/* Create Schedule Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm w-full max-w-md p-6">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-white/90">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-5">Buat Jadwal Produksi</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs mb-4">Sistem akan otomatis membuat lot dengan nomor SA-YYYYMMDD-XXX</p>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Material (sudah approve QC)</label>
                <select value={formData.material_id} onChange={e => setFormData(p => ({ ...p, material_id: e.target.value }))} required
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500">
                  <option value="">Pilih material...</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.material_name} — {m.suppliers?.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Tanggal Jadwal</label>
                <input type="date" value={formData.scheduled_date} onChange={e => setFormData(p => ({ ...p, scheduled_date: e.target.value }))} required
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Prioritas</label>
                <select value={formData.priority} onChange={e => setFormData(p => ({ ...p, priority: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500">
                  <option value="urgent">🔴 Urgent</option>
                  <option value="normal">🔵 Normal</option>
                  <option value="low">⚪ Rendah</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Catatan Batch</label>
                <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm resize-none focus:border-orange-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm transition-colors">Batal</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {saving ? 'Membuat...' : 'Buat Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={!!confirmDelete} title="Hapus Jadwal"
        message="Jadwal queued dan draft lot terkait akan dihapus permanen." confirmText="Hapus"
        variant="danger" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />

      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        reportType="lot_history" 
        title="Export Data Jadwal & Lot" 
      />
    </DashboardLayout>
  );
}
