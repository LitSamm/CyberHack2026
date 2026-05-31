'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { supabaseNotificationsApi } from '@/lib/supabase-api';
import { Bell, Clock, PackageCheck, ThermometerSnowflake, AlertTriangle, Info, Trash2, CheckCircle2 } from 'lucide-react';
import { AnimatedItem } from '@/components/ui/AnimatedList';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, qc, warehouse, ppic
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supabaseNotificationsApi.getAll();
      setNotifications(data || []);
    } catch {
      toast.error('Gagal memuat notifikasi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markAllRead = async () => {
    try {
      await supabaseNotificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('Semua ditandai dibaca');
    } catch {}
  };

  const deleteAll = async () => {
    setDeleting(true);
    try {
      await supabaseNotificationsApi.deleteAll();
      setNotifications([]);
      toast.success('Notifikasi berhasil dihapus');
      setShowConfirm(false);
    } catch {}
    setDeleting(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'qc_overdue': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'lot_urgent': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'cold_mismatch': return <ThermometerSnowflake className="w-5 h-5 text-cyan-400" />;
      case 'dispatch_ready': return <PackageCheck className="w-5 h-5 text-green-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const filteredNotifs = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'qc') return n.type === 'qc_overdue';
    if (filter === 'warehouse') return n.type === 'cold_mismatch' || n.type === 'dispatch_ready';
    if (filter === 'ppic') return n.type === 'lot_urgent';
    return true; // all
  });

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="w-6 h-6 text-orange-500" />
              Semua Notifikasi
            </h1>
            <p className="text-gray-500 dark:text-slate-400 mt-1">Kelola dan pantau semua peringatan sistem</p>
          </div>
          <div className="flex gap-2">
            <button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-white/90 rounded-lg text-sm font-medium transition-colors">
              <CheckCircle2 className="w-4 h-4 text-orange-500" />
              Tandai Semua Dibaca
            </button>
            <button onClick={() => setShowConfirm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-500/40 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-white/90 rounded-lg text-sm font-medium transition-colors">
              <Trash2 className="w-4 h-4" />
              Hapus Semua
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'unread', label: 'Belum Dibaca' },
            { id: 'qc', label: 'QC' },
            { id: 'warehouse', label: 'Gudang' },
            { id: 'ppic', label: 'Produksi' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm transition-colors whitespace-nowrap",
                filter === f.id 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="glass-card rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            </div>
          ) : filteredNotifs.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-slate-500">
              <Bell className="w-12 h-12 mb-4 opacity-20" />
              <p>Tidak ada notifikasi yang ditemukan.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800/50">
              {filteredNotifs.map((notif, i) => (
                <AnimatedItem key={notif.id} index={i}>
                <div className={cn("p-4 flex gap-4 transition-colors relative group hover:bg-gray-50 dark:hover:bg-slate-800/30", !notif.is_read ? "bg-gray-50/80 dark:bg-slate-800/20" : "")}>
                  {!notif.is_read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
                  )}
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-1", !notif.is_read ? "bg-gray-200 dark:bg-slate-700" : "bg-gray-100 dark:bg-slate-800")}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className={cn("text-base text-gray-900 dark:text-white", !notif.is_read ? "font-semibold" : "font-medium")}>
                        {notif.title}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-slate-500 bg-gray-100 dark:bg-slate-900 px-2 py-1 rounded-md border border-gray-200 dark:border-slate-800">
                        {format(new Date(notif.created_at), 'dd MMM yyyy, HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{notif.message}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: localeId })}
                    </p>
                  </div>
                </div>
                </AnimatedItem>
              ))}
            </div>
          )}
        </div>
      </div>
      <ConfirmModal
        isOpen={showConfirm}
        title="Hapus Semua Notifikasi"
        message="Hapus semua notifikasi? Ini tidak bisa dibatalkan."
        confirmText="Hapus Semua"
        variant="danger"
        onConfirm={deleteAll}
        onCancel={() => setShowConfirm(false)}
        loading={deleting}
      />
    </DashboardLayout>
  );
}
