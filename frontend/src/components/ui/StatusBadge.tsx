'use client';

import { cn, getStatusColor, getStatusLabel } from '@/lib/utils';

interface BadgeProps {
  status: string;
  className?: string;
  customLabel?: string;
}

export default function StatusBadge({ status, className, customLabel }: BadgeProps) {
  return (
    <span className={cn('badge text-xs', getStatusColor(status), className)}>
      {customLabel || getStatusLabel(status)}
    </span>
  );
}
