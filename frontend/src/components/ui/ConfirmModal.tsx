'use client';

import { useState } from 'react';

import { CloseIcon, AlertIcon } from '@/icons';

import { cn } from '@/lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen, title, message, confirmText = 'Konfirmasi', cancelText = 'Batal',
  variant = 'danger', onConfirm, onCancel, loading,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: { icon: 'text-red-400 bg-red-500/10', btn: 'bg-red-500 hover:bg-red-600' },
    warning: { icon: 'text-yellow-400 bg-yellow-500/10', btn: 'bg-yellow-500 hover:bg-yellow-600' },
    info: { icon: 'text-blue-400 bg-blue-500/10', btn: 'bg-blue-500 hover:bg-blue-600' },
  };
  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm w-full max-w-md p-6 shadow-2xl">
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-white/90">
          <CloseIcon />
        </button>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-4', styles.icon)}>
          <AlertIcon />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-2">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm transition-colors">
            {cancelText}
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={cn('flex-1 py-2.5 rounded-lg text-gray-800 dark:text-white/90 font-medium text-sm transition-colors disabled:opacity-50', styles.btn)}>
            {loading ? 'Memproses...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
