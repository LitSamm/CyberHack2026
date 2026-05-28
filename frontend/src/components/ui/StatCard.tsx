'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: 'orange' | 'blue' | 'green' | 'purple' | 'red';
  loading?: boolean;
}

const COLOR_MAP = {
  orange: {
    icon: 'bg-orange-500/20 text-orange-400',
    border: 'border-orange-500/20',
    value: 'text-orange-400',
  },
  blue: {
    icon: 'bg-blue-500/20 text-blue-400',
    border: 'border-blue-500/20',
    value: 'text-blue-400',
  },
  green: {
    icon: 'bg-green-500/20 text-green-400',
    border: 'border-green-500/20',
    value: 'text-green-400',
  },
  purple: {
    icon: 'bg-purple-500/20 text-purple-400',
    border: 'border-purple-500/20',
    value: 'text-purple-400',
  },
  red: {
    icon: 'bg-red-500/20 text-red-400',
    border: 'border-red-500/20',
    value: 'text-red-400',
  },
};

export default function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'orange', loading }: StatCardProps) {
  const colors = COLOR_MAP[color];

  if (loading) {
    return (
      <div className="glass-card stat-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="skeleton w-10 h-10 rounded-xl" />
          <div className="skeleton w-16 h-5 rounded" />
        </div>
        <div className="skeleton w-20 h-8 rounded mb-2" />
        <div className="skeleton w-32 h-4 rounded" />
      </div>
    );
  }

  return (
    <div className={cn('glass-card stat-card p-5 border', colors.border, 'hover:border-opacity-40 transition-all duration-200')}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colors.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={cn('text-xs px-2 py-1 rounded-full font-medium',
            trend.value >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          )}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div className={cn('text-2xl font-bold mb-1', colors.value)}>{value}</div>
      <div className="text-slate-300 text-sm font-medium">{title}</div>
      {subtitle && <div className="text-slate-500 text-xs mt-1">{subtitle}</div>}
    </div>
  );
}
