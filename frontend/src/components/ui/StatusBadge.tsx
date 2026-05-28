'use client';

import { cn, getStatusColor, getStatusLabel } from '@/lib/utils';

interface BadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: BadgeProps) {
  return (
    <span className={cn('badge text-xs', getStatusColor(status), className)}>
      {getStatusLabel(status)}
    </span>
  );
}
