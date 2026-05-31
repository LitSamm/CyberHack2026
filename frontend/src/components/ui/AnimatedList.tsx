'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useInView } from 'motion/react';
import { cn } from '@/lib/utils';

// ── AnimatedItem — wraps any div-based card/list item ─────────────────────────
interface AnimatedItemProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  className?: string;
  onMouseEnter?: () => void;
  onClick?: () => void;
}

export const AnimatedItem = ({ children, index = 0, delay, className, onMouseEnter, onClick }: AnimatedItemProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2, once: true });
  const d = delay ?? Math.min(index * 0.04, 0.3);
  return (
    <motion.div
      ref={ref}
      data-index={index}
      className={className}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 0 }}
      transition={{ duration: 0.2, delay: d }}
    >
      {children}
    </motion.div>
  );
};

// ── AnimatedRow — wraps <tr> rows in tables ────────────────────────────────────
interface AnimatedRowProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  className?: string;
  onClick?: () => void;
}

export const AnimatedRow = ({ children, index = 0, delay, className, onClick }: AnimatedRowProps) => {
  const ref = useRef<HTMLTableRowElement>(null);
  const inView = useInView(ref, { amount: 0.2, once: true });
  const d = delay ?? Math.min(index * 0.03, 0.25);
  return (
    <motion.tr
      ref={ref}
      data-index={index}
      className={className}
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      transition={{ duration: 0.18, delay: d }}
    >
      {children}
    </motion.tr>
  );
};

// ── AnimatedList — full scrollable animated list (string or ReactNode items) ──
type AnimatedListItem = string | React.ReactNode;

interface AnimatedListProps {
  items?: AnimatedListItem[];
  onItemSelect?: (item: AnimatedListItem, index: number) => void;
  showGradients?: boolean;
  enableArrowNavigation?: boolean;
  className?: string;
  itemClassName?: string;
  displayScrollbar?: boolean;
  initialSelectedIndex?: number;
  renderItem?: (item: AnimatedListItem, index: number, selected: boolean) => React.ReactNode;
}

export default function AnimatedList({
  items = [],
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  className = '',
  itemClassName = '',
  displayScrollbar = true,
  initialSelectedIndex = -1,
  renderItem,
}: AnimatedListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [topOpacity, setTopOpacity] = useState(0);
  const [bottomOpacity, setBottomOpacity] = useState(1);

  const handleMouseEnter = useCallback((index: number) => setSelectedIndex(index), []);
  const handleClick = useCallback((item: AnimatedListItem, index: number) => {
    setSelectedIndex(index);
    onItemSelect?.(item, index);
  }, [onItemSelect]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setTopOpacity(Math.min(scrollTop / 50, 1));
    const bottom = scrollHeight - (scrollTop + clientHeight);
    setBottomOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottom / 50, 1));
  }, []);

  useEffect(() => {
    if (!enableArrowNavigation) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex(p => Math.min(p + 1, items.length - 1));
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex(p => Math.max(p - 1, 0));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        onItemSelect?.(items[selectedIndex], selectedIndex);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, selectedIndex, onItemSelect, enableArrowNavigation]);

  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    if (el) {
      const margin = 50;
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      const { scrollTop, clientHeight } = listRef.current;
      if (top < scrollTop + margin) listRef.current.scrollTo({ top: top - margin, behavior: 'smooth' });
      else if (bottom > scrollTop + clientHeight - margin) listRef.current.scrollTo({ top: bottom - clientHeight + margin, behavior: 'smooth' });
    }
    setKeyboardNav(false);
  }, [selectedIndex, keyboardNav]);

  return (
    <div className={cn('relative', className)}>
      <div
        ref={listRef}
        className={cn('overflow-y-auto max-h-96 p-4', displayScrollbar ? 'animated-list-scrollbar' : 'no-scrollbar')}
        onScroll={handleScroll}
      >
        {items.map((item, index) => (
          <AnimatedItem
            key={index}
            index={index}
            onMouseEnter={() => handleMouseEnter(index)}
            onClick={() => handleClick(item, index)}
          >
            {renderItem ? (
              renderItem(item, index, selectedIndex === index)
            ) : (
              <div className={cn(
                'px-4 py-3 rounded-xl mb-3 cursor-pointer transition-colors',
                'bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700',
                selectedIndex === index ? 'border-orange-500/50 bg-orange-500/5' : 'hover:border-gray-300 dark:hover:border-gray-600',
                itemClassName
              )}>
                <p className="text-sm text-gray-800 dark:text-white/90">{String(item)}</p>
              </div>
            )}
          </AnimatedItem>
        ))}
      </div>
      {showGradients && (
        <>
          <div className="pointer-events-none absolute top-0 inset-x-0 h-12 bg-gradient-to-b from-white dark:from-gray-900 to-transparent transition-opacity" style={{ opacity: topOpacity }} />
          <div className="pointer-events-none absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-white dark:from-gray-900 to-transparent transition-opacity" style={{ opacity: bottomOpacity }} />
        </>
      )}
    </div>
  );
}
