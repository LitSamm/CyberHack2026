'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { auditApi, usersApi } from '@/lib/api';
import { formatDateTime, getRoleLabel } from '@/lib/utils';
import { Download, Filter, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ user_id: '', action: '', table_name: '', from: '', to: '' });
  const [exporting, setExporting] = useState(false);

  const TABLE_LABELS: Record<string, string> = {
    lots: 'Lot', qc_checks: 'QC Check', ppic_schedules: 'Jadwal PPIC',
    incoming_materials: 'Material Masuk', dispatches: 'Pengiriman',
    warehouse_slots: 'Slot Gudang', users: 'User', suppliers: 'Supplier',
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
      const { data } = await auditApi.getAll(params);
      setLogs(data.data);
      setTotal(data.total);
    } catch { toast.error('Gagal memuat audit log'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { usersApi.getAll().then(r => setUsers(r.data)).catch(() => {}); }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await auditApi.exportCsv();
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV berhasil diunduh');
    } catch { toast.error('Gagal mengekspor CSV'); }
    finally { setExporting(false); }
  };

  const getActionBg = (action: string) => {
    if (action === 'INSERT') return 'text-green-400 bg-green-500/10 border-green-500/20';
    if (action === 'DELETE') return 'text-red-400 bg-red-500/10 border-red-500/20';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  };

  return (
    <DashboardLayout allowedRoles={['admin']} onRefresh={fetchLogs}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
            <p className="text-slate-400 text-sm mt-1">{total} total entri log</p>
          </div>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" />
            {exporting ? 'Mengunduh...' : 'Export CSV'}
          </button>
        </div>

        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Filter</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <select value={filters.user_id} onChange={e => setFilters(p => ({ ...p, user_id: e.target.value }))}
              className="px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white col-span-1 focus:border-orange-500">
              <option value="">Semua User</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select value={filters.action} onChange={e => setFilters(p => ({ ...p, action: e.target.value }))}
              className="px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500">
              <option value="">Semua Aksi</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
            <select value={filters.table_name} onChange={e => setFilters(p => ({ ...p, table_name: e.target.value }))}
              className="px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500">
              <option value="">Semua Tabel</option>
              {Object.entries(TABLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))}
              className="px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500" />
            <input type="date" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))}
              className="px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500" />
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/30">
                {['Timestamp', 'User', 'Aksi', 'Tabel', 'Record ID'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-semibold py-3 px-4 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="py-3 px-4"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.map(log => (
                <tr key={log.id} className="border-b border-slate-800/50 table-row-hover">
                  <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                  <td className="py-3 px-4">
                    <div className="text-white text-xs font-medium">{log.users?.name || '-'}</div>
                    <div className="text-slate-500 text-xs">{getRoleLabel(log.users?.role || '')}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge text-xs ${getActionBg(log.action)}`}>{log.action}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300 text-xs">{TABLE_LABELS[log.table_name] || log.table_name}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs font-mono truncate max-w-32">{log.record_id || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && logs.length === 0 && (
            <div className="text-center py-12 text-slate-500">Tidak ada log ditemukan</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
