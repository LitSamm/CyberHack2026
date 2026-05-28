'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Bell, X, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardApi, searchApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import Link from 'next/link';
import NotificationBell from '@/components/ui/NotificationBell';

interface SearchResult {
  lots: any[];
  materials: any[];
  dispatches: any[];
  total: number;
}

export default function TopBar({ onRefresh }: { onRefresh?: () => void }) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setSearchLoading(true);
        try {
          const { data } = await searchApi.search(searchQuery);
          setSearchResults(data);
          setShowSearch(true);
        } catch {}
        setSearchLoading(false);
      } else {
        setSearchResults(null);
        setShowSearch(false);
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="h-16 bg-[#0F172A]/80 backdrop-blur border-b border-slate-800 flex items-center px-6 gap-4 sticky top-0 z-30">
      {/* Search */}
      <div ref={searchRef} className="flex-1 max-w-xl relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari lot, material, customer..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setShowSearch(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearch && searchResults && (
          <div className="absolute top-full mt-2 left-0 right-0 glass-card shadow-2xl rounded-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
            {searchResults.total === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">Tidak ada hasil untuk "{searchQuery}"</div>
            ) : (
              <div className="p-2">
                {searchResults.lots.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wide">Lot</div>
                    {searchResults.lots.map(lot => (
                      <Link key={lot.id} href={`/ppic?lot=${lot.id}`}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-700/50 rounded-lg text-sm">
                        <span className="text-orange-400 font-mono font-semibold">{lot.lot_number}</span>
                        <span className="text-slate-400">{lot.status}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {searchResults.materials.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wide">Material</div>
                    {searchResults.materials.map(m => (
                      <Link key={m.id} href={`/qc`}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-700/50 rounded-lg text-sm">
                        <span className="text-white">{m.material_name}</span>
                        <span className="text-slate-400 ml-auto">{m.qc_status}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {searchResults.dispatches.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wide">Pengiriman</div>
                    {searchResults.dispatches.map(d => (
                      <Link key={d.id} href={`/dispatch`}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-700/50 rounded-lg text-sm">
                        <span className="text-white">{d.customer_name}</span>
                        <span className="text-slate-400">{d.destination}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Refresh button */}
        {onRefresh && (
          <button onClick={onRefresh}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Refresh data">
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Notifications */}
        <NotificationBell />

        {/* User avatar */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{user?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-sm text-white font-medium leading-none">{user?.name?.split(' ')[0]}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
