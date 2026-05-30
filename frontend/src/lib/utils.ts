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
    pending: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
    approved: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500',
    rejected: 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500',
    queued: 'bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-500',
    in_production: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-500',
    completed: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500',
    dispatched: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-500',
    prepared: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
    shipped: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-500',
    delivered: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500',
    pass: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500',
    fail: 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500',
    urgent: 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500',
    normal: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-500',
    low: 'bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-500',
  };
  return map[status] || 'bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-500';
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
