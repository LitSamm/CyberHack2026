import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric', month: 'short', day: 'numeric',
    ...options,
  });
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    queued: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    in_production: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    dispatched: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    prepared: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    shipped: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
    pass: 'bg-green-500/20 text-green-400 border-green-500/30',
    fail: 'bg-red-500/20 text-red-400 border-red-500/30',
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  return map[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Menunggu QC',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    queued: 'Antri',
    in_production: 'Produksi',
    completed: 'Selesai',
    dispatched: 'Dikirim',
    prepared: 'Siap Kirim',
    shipped: 'Dalam Perjalanan',
    delivered: 'Terkirim',
    pass: 'Lulus',
    fail: 'Gagal',
    urgent: 'Urgent',
    normal: 'Normal',
    low: 'Rendah',
  };
  return map[status] || status;
}

export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: 'Admin',
    qc: 'QC Officer',
    ppic: 'PPIC',
    warehouse: 'Warehouse Operator',
  };
  return map[role] || role;
}

export function getRoleDashboard(role: string): string {
  const map: Record<string, string> = {
    admin: '/admin',
    qc: '/qc',
    ppic: '/ppic',
    warehouse: '/warehouse',
  };
  return map[role] || '/';
}
