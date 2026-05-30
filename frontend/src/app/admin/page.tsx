'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/utils';
import { supabaseDashboardApi, supabaseLotsApi } from '@/lib/supabase-api';
import {
  BoxIcon, CheckCircleIcon, TimeIcon, BoxCubeIcon,
  GridIcon, ArrowUpIcon, DownloadIcon, DocsIcon, FileIcon, ChevronDownIcon
} from '@/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ExportModal, { ReportType } from '@/components/ui/ExportModal';

interface Stats {
  lots_today: number;
  qc_pass_rate: number;
  pending_schedules: number;
  warehouse_occupancy: number;
  pending_qc_count: number;
}

interface ActivityItem {
  id: string;
  action: string;
  table_name: string;
  timestamp: string;
  users: { name: string; role: string } | null;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [recentLots, setRecentLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Export Modal State
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<ReportType>('qc');
  const [exportTitle, setExportTitle] = useState('');

  const openExportModal = (type: ReportType, title: string) => {
    setExportType(type);
    setExportTitle(title);
    setShowExportModal(true);
    setShowExportMenu(false);
  };

  const fetchData = useCallback(async () => {
    try {
      const [statsData, actData, lotsData] = await Promise.all([
        supabaseDashboardApi.getStats(),
        supabaseDashboardApi.getRecentActivity(),
        supabaseLotsApi.getAll(),
      ]);
      setStats(statsData as Stats);
      setActivity(actData as ActivityItem[]);
      setRecentLots((lotsData as any[]).slice(0, 8));
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const chartData = [
    { name: 'Sen', lots: 4, qc: 3 },
    { name: 'Sel', lots: 7, qc: 6 },
    { name: 'Rab', lots: 5, qc: 5 },
    { name: 'Kam', lots: 9, qc: 8 },
    { name: 'Jum', lots: 6, qc: 5 },
    { name: 'Sab', lots: 3, qc: 3 },
    { name: 'Min', lots: 2, qc: 2 },
  ];

  const getActionLabel = (action: string, table: string) => {
    const actions: Record<string, string> = {
      INSERT: 'Menambahkan', UPDATE: 'Mengubah', DELETE: 'Menghapus',
    };
    const tables: Record<string, string> = {
      lots: 'lot', qc_checks: 'QC check', ppic_schedules: 'jadwal',
      incoming_materials: 'material', dispatches: 'pengiriman', users: 'user',
    };
    return `${actions[action] || action} ${tables[table] || table}`;
  };

  return (
    <DashboardLayout allowedRoles={['admin']} onRefresh={fetchData}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Dashboard Admin</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Overview operasional Sima Arome — auto-refresh 30 detik</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-white/90 rounded-xl text-sm font-medium transition-colors"
              >
                
                Export Data
                
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="p-2 space-y-1">
                    <button onClick={() => openExportModal('qc', 'Export Laporan QC')} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white rounded-lg flex items-center gap-2 transition-colors">
                       Laporan QC (PDF)
                    </button>
                    <button onClick={() => openExportModal('lot_history', 'Export Data Jadwal & Lot')} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white rounded-lg flex items-center gap-2 transition-colors">
                       Jadwal & Lot (CSV/PDF)
                    </button>
                    <button onClick={() => openExportModal('warehouse', 'Export Inventory Gudang')} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white rounded-lg flex items-center gap-2 transition-colors">
                       Inventory Gudang (PDF)
                    </button>
                    <button onClick={() => openExportModal('dispatch', 'Export Riwayat Pengiriman')} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white rounded-lg flex items-center gap-2 transition-colors">
                       Riwayat Pengiriman (CSV)
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 hidden sm:flex">
              <div className="w-2 h-2 bg-green-400 rounded-full pulse-dot" />
              Live
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Lot Dibuat Hari Ini" value={stats?.lots_today ?? 0}
            subtitle="Total lot produksi" icon={BoxIcon} color="orange" loading={loading} />
          <StatCard title="QC Pass Rate" value={`${stats?.qc_pass_rate ?? 0}%`}
            subtitle="Hari ini" icon={CheckCircleIcon} color="green" loading={loading} />
          <StatCard title="Jadwal Aktif" value={stats?.pending_schedules ?? 0}
            subtitle="Queued + In Production" icon={TimeIcon} color="blue" loading={loading} />
          <StatCard title="Kapasitas Gudang" value={`${stats?.warehouse_occupancy ?? 0}%`}
            subtitle="Slot terisi" icon={BoxCubeIcon} color="purple" loading={loading} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="xl:col-span-2 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-5">
            <div className="flex items-center gap-2 mb-5">
              
              <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Produksi & QC 7 Hari Terakhir</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#F1F5F9' }}
                />
                <Bar dataKey="lots" fill="#F97316" radius={[4, 4, 0, 0]} name="Lot Baru" />
                <Bar dataKey="qc" fill="#1D4ED8" radius={[4, 4, 0, 0]} name="QC Selesai" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Activity Feed */}
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              
              <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Aktivitas Terbaru</h2>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-56">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="skeleton w-7 h-7 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3.5 w-full rounded" />
                      <div className="skeleton h-3 w-2/3 rounded" />
                    </div>
                  </div>
                ))
              ) : activity.length === 0 ? (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">Belum ada aktivitas</p>
              ) : activity.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-400 text-xs font-bold">
                      {a.users?.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">
                      <span className="text-gray-800 dark:text-white/90 font-medium">{a.users?.name || 'System'}</span>{' '}
                      {getActionLabel(a.action, a.table_name)}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{formatDateTime(a.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Lots Table */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-4">Lot Terbaru</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  {['Lot Number', 'Material', 'Status', 'Tanggal Produksi', 'Dibuat Oleh'].map(h => (
                    <th key={h} className="text-left text-xs text-gray-400 dark:text-gray-500 font-semibold pb-3 pr-4 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-200 dark:border-gray-800/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="py-3 pr-4"><div className="skeleton h-4 w-full rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : recentLots.map(lot => (
                  <tr key={lot.id} className="border-b border-gray-200 dark:border-gray-800/50 table-row-hover">
                    <td className="py-3 pr-4">
                      <span className="font-mono text-orange-400 font-semibold text-xs">{lot.lot_number}</span>
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{lot.incoming_materials?.material_name || '-'}</td>
                    <td className="py-3 pr-4"><StatusBadge status={lot.status} /></td>
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400 text-xs">{lot.production_date ? new Date(lot.production_date).toLocaleDateString('id-ID') : '-'}</td>
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">{lot.users?.name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && recentLots.length === 0 && (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">Belum ada lot</div>
            )}
          </div>
        </div>
      </div>

      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        reportType={exportType} 
        title={exportTitle} 
      />
    </DashboardLayout>
  );
}
