'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  onRefresh?: () => void;
}

export default function DashboardLayout({ children, allowedRoles, onRefresh }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to their own dashboard
        const dashMap: Record<string, string> = {
          admin: '/admin', qc: '/qc', ppic: '/ppic', warehouse: '/warehouse',
        };
        router.push(dashMap[user.role] || '/');
      }
    }
  }, [user, loading, allowedRoles, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0F1C]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500 animate-pulse flex items-center justify-center">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <div className="text-slate-400 text-sm">Memuat...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-[#0A0F1C]">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <TopBar onRefresh={onRefresh} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
