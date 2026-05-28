'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Clock, PackageCheck, ThermometerSnowflake, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabaseNotificationsApi } from '@/lib/supabase-api';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import Link from 'next/link';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const { user } = useAuth();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await supabaseNotificationsApi.getAll();
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (user) {
      const supabase = createClient();
      const channel = supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const newNotif = payload.new;
            setNotifications((prev) => [newNotif, ...prev]);
            toast.custom((t) => (
              <div className={cn("bg-slate-800 border border-slate-700 p-4 flex gap-3 rounded-xl shadow-lg", t.visible ? "animate-enter" : "animate-leave")}>
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{newNotif.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{newNotif.message}</p>
                </div>
              </div>
            ));
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    else document.removeEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    try {
      await supabaseNotificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      toast.error('Gagal menandai dibaca');
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      try {
        await supabaseNotificationsApi.markAsRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch (err) {}
    }
    setIsOpen(false);

    // Route based on type
    switch (notif.type) {
      case 'qc_overdue': router.push('/qc'); break;
      case 'lot_urgent': router.push('/ppic'); break;
      case 'cold_mismatch': router.push('/warehouse'); break;
      case 'dispatch_ready': router.push('/dispatch'); break;
      default: router.push('/notifications');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'qc_overdue': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'lot_urgent': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'cold_mismatch': return <ThermometerSnowflake className="w-4 h-4 text-cyan-400" />;
      case 'dispatch_ready': return <PackageCheck className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors relative"
      >
        <Bell className="w-5 h-5 text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-slate-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl overflow-hidden z-50 flex flex-col max-h-[85vh]">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur shrink-0">
            <h3 className="font-semibold text-white">Notifikasi</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tandai dibaca
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Belum ada notifikasi
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {notifications.slice(0, 5).map(notif => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-slate-800/50 transition-colors flex items-start gap-3 relative",
                      !notif.is_read ? "bg-slate-800/20" : ""
                    )}
                  >
                    {!notif.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
                    )}
                    <div className={cn("p-2 rounded-lg bg-slate-800", !notif.is_read ? "bg-slate-700" : "")}>
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium text-white truncate", !notif.is_read ? "font-semibold" : "")}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-2">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: localeId })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-800 bg-slate-900 shrink-0">
            <Link 
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block w-full text-center text-sm text-slate-400 hover:text-white transition-colors py-2"
            >
              Lihat semua notifikasi
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
