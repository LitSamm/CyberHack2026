'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleDashboard } from '@/lib/utils';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace(getRoleDashboard(user.role));
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0F1C]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center animate-pulse">
          <span className="text-white text-xl font-bold">A</span>
        </div>
        <p className="text-slate-400 text-sm">Memuat AromOS...</p>
      </div>
    </div>
  );
}
