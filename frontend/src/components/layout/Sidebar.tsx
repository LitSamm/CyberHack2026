'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn, getRoleLabel } from '@/lib/utils';
import {
  LayoutDashboard, FlaskConical, Calendar, Warehouse,
  Truck, FileText, Users, Leaf, LogOut, ChevronRight,
  Settings,
} from 'lucide-react';

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard Admin', roles: ['admin'] },
  { href: '/admin/users', icon: <Users className="w-5 h-5" />, label: 'Manajemen User', roles: ['admin'] },
  { href: '/admin/audit', icon: <FileText className="w-5 h-5" />, label: 'Audit Trail', roles: ['admin'] },
  { href: '/qc', icon: <FlaskConical className="w-5 h-5" />, label: 'QC Dashboard', roles: ['qc', 'admin'] },
  { href: '/ppic', icon: <Calendar className="w-5 h-5" />, label: 'PPIC & Produksi', roles: ['ppic', 'admin'] },
  { href: '/warehouse', icon: <Warehouse className="w-5 h-5" />, label: 'Gudang', roles: ['warehouse', 'admin'] },
  { href: '/dispatch', icon: <Truck className="w-5 h-5" />, label: 'Pengiriman', roles: ['warehouse', 'ppic', 'admin'] },
];

const ROLE_COLORS: Record<string, string> = {
  admin: 'text-purple-400 bg-purple-400/10',
  qc: 'text-green-400 bg-green-400/10',
  ppic: 'text-blue-400 bg-blue-400/10',
  warehouse: 'text-yellow-400 bg-yellow-400/10',
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter(item => user && item.roles.includes(user.role));

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0F172A] border-r border-slate-800 flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-none">AromOS</div>
            <div className="text-orange-400 text-xs mt-0.5">Sima Arome</div>
          </div>
        </div>
      </div>

      {/* User profile */}
      <div className="px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">{user?.name}</div>
            <div className={cn('text-xs px-2 py-0.5 rounded-full inline-block mt-0.5', ROLE_COLORS[user?.role || ''])}>
              {getRoleLabel(user?.role || '')}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'nav-item flex items-center gap-3 px-3 py-2.5 text-sm transition-all',
                isActive
                  ? 'active bg-orange-500/15 text-orange-400 font-medium border-l-[3px] border-orange-500 pl-2.5 rounded-r-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-1">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
