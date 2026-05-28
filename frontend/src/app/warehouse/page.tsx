'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/ui/StatCard';
import { supabaseWarehouseApi, supabaseLotsApi } from '@/lib/supabase-api';
import { createClient } from '@/lib/supabase';
import { Warehouse, Thermometer, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const TEMP_ZONE_CONFIG: Record<string, { color: string; label: string; border: string; bg: string; text: string }> = {
  ambient: { color: 'bg-green-500', label: 'Ambient', border: 'border-green-500/40', bg: 'bg-green-500/10', text: 'text-green-400' },
  cold: { color: 'bg-blue-500', label: 'Cold (-4°C)', border: 'border-blue-500/40', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  frozen: { color: 'bg-red-500', label: 'Frozen (-20°C)', border: 'border-red-500/40', bg: 'bg-red-500/10', text: 'text-red-400' },
};

const HAZARD_CONFIG: Record<string, string> = {
  IBC: '🟡',
  IPPC: '🟡',
};

export default function WarehouseDashboard() {
  const [slots, setSlots] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [assignLotId, setAssignLotId] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterZone, setFilterZone] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [slotsData, statsData, lotsData] = await Promise.all([
        supabaseWarehouseApi.getSlots(),
        supabaseWarehouseApi.getStats(),
        supabaseLotsApi.getAll({ status: 'completed' }),
      ]);
      setSlots(slotsData || []);
      setStats(statsData);
      setLots(lotsData || []);
    } catch { toast.error('Gagal memuat data gudang'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSlotClick = (slot: any) => {
    setSelectedSlot(slot);
    setAssignLotId(slot.current_lot_id || '');
  };

  const handleAssign = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    const sb = createClient();
    try {
      await sb.from('warehouse_slots').update({
        current_lot_id: assignLotId || null,
        is_occupied: !!assignLotId,
      }).eq('id', selectedSlot.id);
      toast.success(assignLotId ? 'Lot berhasil ditempatkan' : 'Slot berhasil dikosongkan');
      setSelectedSlot(null);
      fetchData();
    } catch { toast.error('Gagal update slot'); }
    finally { setSaving(false); }
  };

  const getSlotStyle = (slot: any) => {
    if (slot.hazard_type) return 'bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30';
    if (!slot.is_occupied) return 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20';
    if (slot.temperature_zone === 'cold') return 'bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30';
    if (slot.temperature_zone === 'frozen') return 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30';
    return 'bg-slate-700/60 border-slate-600 hover:bg-slate-700';
  };

  const filteredSlots = filterZone ? slots.filter(s => s.zone === filterZone) : slots;

  // Group by zone for display
  const zones = ['A', 'B', 'C'];
  const slotsByZone: Record<string, any[]> = {};
  zones.forEach(z => { slotsByZone[z] = slots.filter(s => s.zone === z); });

  return (
    <DashboardLayout allowedRoles={['warehouse', 'admin']} onRefresh={fetchData}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Gudang</h1>
          <p className="text-slate-400 text-sm mt-1">Peta lantai gudang dan status cold-chain</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Slot" value={stats?.total ?? 0} icon={Warehouse} color="blue" loading={loading} />
          <StatCard title="Terisi" value={stats?.occupied ?? 0} icon={Warehouse} color="orange" loading={loading} />
          <StatCard title="Tersedia" value={stats?.available ?? 0} icon={Warehouse} color="green" loading={loading} />
          <StatCard title="Kapasitas" value={`${stats?.occupancy_pct ?? 0}%`} icon={Thermometer} color="purple" loading={loading} />
        </div>

        {/* Legend */}
        <div className="glass-card p-4">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30" /><span className="text-slate-300">🟢 Tersedia (Ambient)</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-slate-700/60 border border-slate-600" /><span className="text-slate-300">⚫ Terisi (Normal)</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/50" /><span className="text-slate-300">🔵 Terisi (Cold -4°C)</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/50" /><span className="text-slate-300">🔴 Terisi (Frozen -20°C)</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/50" /><span className="text-slate-300">🟡 Hazardous (IBC/IPPC)</span></div>
          </div>
        </div>

        {/* Floor Map by Zone */}
        {zones.map(zone => {
          const zoneSlots = slotsByZone[zone] || [];
          const tempZone = zone === 'A' ? 'ambient' : zone === 'B' ? 'cold' : 'frozen';
          const cfg = TEMP_ZONE_CONFIG[tempZone];
          return (
            <div key={zone} className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn('w-3 h-3 rounded-full', cfg.color)} />
                <h2 className="text-base font-semibold text-white">
                  Zona {zone} — {cfg.label}
                </h2>
                <span className={cn('badge text-xs', cfg.border, cfg.bg, cfg.text)}>
                  {zoneSlots.filter(s => s.is_occupied).length}/{zoneSlots.length} terisi
                </span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {zoneSlots.map(slot => (
                  <button key={slot.id}
                    onClick={() => handleSlotClick(slot)}
                    className={cn(
                      'warehouse-slot aspect-square rounded-lg border text-center p-1 flex flex-col items-center justify-center',
                      getSlotStyle(slot)
                    )}
                    title={slot.is_occupied ? `${slot.slot_code}: ${slot.lots?.lot_number || 'Lot'}` : `${slot.slot_code}: Tersedia`}
                  >
                    <div className="text-xs font-mono font-bold text-white leading-none">{slot.slot_code}</div>
                    {slot.hazard_type && <div className="text-xs">{HAZARD_CONFIG[slot.hazard_type] || '⚠️'}</div>}
                    {slot.is_occupied && !slot.hazard_type && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white/60 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slot Detail Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedSlot(null)} />
          <div className="relative glass-card w-full max-w-md p-6">
            <button onClick={() => setSelectedSlot(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <span className="text-orange-400 font-mono font-bold text-lg">{selectedSlot.slot_code}</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Slot {selectedSlot.slot_code}</h3>
                <p className="text-slate-400 text-sm">Zona {selectedSlot.zone} — {TEMP_ZONE_CONFIG[selectedSlot.temperature_zone]?.label}</p>
              </div>
            </div>

            <div className="space-y-3 mb-5 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Status</span>
                <span className={selectedSlot.is_occupied ? 'text-orange-400 font-medium' : 'text-green-400 font-medium'}>
                  {selectedSlot.is_occupied ? 'Terisi' : 'Tersedia'}
                </span>
              </div>
              {selectedSlot.is_occupied && (
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Lot Saat Ini</span>
                  <span className="text-white font-mono font-semibold">{selectedSlot.lots?.lot_number || '-'}</span>
                </div>
              )}
              {selectedSlot.hazard_type && (
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Tipe Hazard</span>
                  <span className="text-yellow-400">{selectedSlot.hazard_type}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Zona Suhu</span>
                <span className={TEMP_ZONE_CONFIG[selectedSlot.temperature_zone]?.text}>
                  {TEMP_ZONE_CONFIG[selectedSlot.temperature_zone]?.label}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-slate-300">
                {selectedSlot.is_occupied ? 'Ganti Lot / Kosongkan Slot' : 'Tempatkan Lot'}
              </label>
              <select value={assignLotId} onChange={e => setAssignLotId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:border-orange-500">
                <option value="">— Kosongkan Slot —</option>
                {lots.map(lot => (
                  <option key={lot.id} value={lot.id}>{lot.lot_number} — {lot.incoming_materials?.material_name}</option>
                ))}
              </select>

              {selectedSlot.temperature_zone === 'frozen' && assignLotId && (
                <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Slot ini adalah zona beku (-20°C). Pastikan lot sesuai cold-chain requirement.
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setSelectedSlot(null)}
                  className="flex-1 py-2.5 border border-slate-600 text-slate-300 hover:bg-slate-700 rounded-lg text-sm transition-colors">
                  Batal
                </button>
                <button onClick={handleAssign} disabled={saving}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
