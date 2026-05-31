'use client';

import { cn } from '@/lib/utils';
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ElementType;
  trend?: { value: number; label: string };
  color?: 'orange' | 'blue' | 'green' | 'purple' | 'red';
  loading?: boolean;
}

export default function StatCard({ title, value, subtitle, trend, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="w-16 h-5 rounded-full bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="w-20 h-8 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
        <div className="w-32 h-4 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 hover:shadow-theme-sm transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        {/* Ikon dihapus sesuai permintaan agar desain lebih bersih */}
        {trend && (
          <div className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
            trend.value >= 0 ? 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500' : 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500'
          )}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div>
        <h4 className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h4>
        <h3 className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">{value}</h3>
      </div>
      {subtitle && <div className="text-gray-400 dark:text-gray-500 text-xs mt-2">{subtitle}</div>}
    </div>
  );
}
