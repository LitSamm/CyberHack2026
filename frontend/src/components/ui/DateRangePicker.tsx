'use client';

import { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateRange { from: string; to: string; }

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  placeholder?: string;
}

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const DAYS   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function parseLocal(str: string) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(str: string) {
  if (!str) return '';
  const d = parseLocal(str);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function getDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let i = 1; i <= total; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function DateRangePicker({ value, onChange, className, placeholder = 'Pilih rentang tanggal' }: Props) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hovered, setHovered] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<'from' | 'to' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const rightMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const rightYear  = viewMonth === 11 ? viewYear + 1 : viewYear;

  const handleDayClick = (dateStr: string) => {
    if (!value.from || (value.from && value.to)) {
      onChange({ from: dateStr, to: '' });
      setSelecting('to');
    } else {
      if (dateStr < value.from) {
        onChange({ from: dateStr, to: value.from });
      } else {
        onChange({ from: value.from, to: dateStr });
      }
      setSelecting(null);
      setOpen(false);
    }
  };

  const inRange = (dateStr: string) => {
    const from = value.from;
    const to = value.to || hovered || '';
    if (!from) return false;
    const [a, b] = from < to ? [from, to] : [to, from];
    return dateStr > a && dateStr < b;
  };

  const isStart = (dateStr: string) => dateStr === value.from;
  const isEnd   = (dateStr: string) => dateStr === value.to;
  const isEdge  = (dateStr: string) => isStart(dateStr) || isEnd(dateStr);

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: '', to: '' });
    setSelecting(null);
  };

  const displayText = value.from
    ? value.to
      ? `${formatDisplay(value.from)} → ${formatDisplay(value.to)}`
      : `${formatDisplay(value.from)} → ...`
    : placeholder;

  const renderMonth = (year: number, month: number) => {
    const cells = getDays(year, month);
    return (
      <div className="min-w-[220px]">
        <div className="text-center text-sm font-semibold text-gray-800 dark:text-white mb-3">
          {MONTHS[month]} {year}
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const edge = isEdge(dateStr);
            const between = inRange(dateStr);
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleDayClick(dateStr)}
                onMouseEnter={() => value.from && !value.to && setHovered(dateStr)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  'h-8 w-full text-xs rounded-md transition-colors',
                  edge
                    ? 'bg-orange-500 text-white font-semibold'
                    : between
                    ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded-none'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open && !value.from) setSelecting('from'); }}
        className={cn(
          'flex items-center gap-2 px-3 py-2 w-full',
          'bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg',
          'text-sm text-left transition-colors',
          value.from ? 'text-gray-800 dark:text-white/90' : 'text-gray-400 dark:text-gray-500',
          open ? 'border-orange-500 ring-1 ring-orange-500' : 'hover:border-gray-300 dark:hover:border-gray-700'
        )}
      >
        <CalendarDays size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
        <span className="flex-1 truncate">{displayText}</span>
        {(value.from || value.to) && (
          <X size={13} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0" onClick={clear} />
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 z-[110] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl p-4 left-0">
          {/* hint */}
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-3 text-center">
            {!value.from || (value.from && value.to) ? 'Klik tanggal mulai' : 'Klik tanggal akhir'}
          </div>

          <div className="flex gap-6 items-start">
            {/* nav left */}
            <button type="button" onClick={prevMonth} className="mt-0.5 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500">
              <ChevronLeft size={16} />
            </button>

            {renderMonth(viewYear, viewMonth)}
            {renderMonth(rightYear, rightMonth)}

            {/* nav right */}
            <button type="button" onClick={nextMonth} className="mt-0.5 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* footer */}
          {(value.from || value.to) && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {value.from && value.to
                  ? `${formatDisplay(value.from)} → ${formatDisplay(value.to)}`
                  : `Mulai: ${formatDisplay(value.from)}`}
              </span>
              <button type="button" onClick={clear} className="text-xs text-red-400 hover:text-red-500 transition-colors">
                Reset
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
