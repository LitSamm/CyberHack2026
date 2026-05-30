'use client';

import { useState, useEffect, useCallback } from 'react';

import { BoxCubeIcon, InfoIcon, AlertIcon, CloseIcon, CheckCircleIcon, ArrowRightIcon, DownloadIcon } from '@/icons';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/ui/StatCard';
import { supabaseWarehouseApi, supabaseLotsApi } from '@/lib/supabase-api';
import { createClient } from '@/lib/supabase';

import ExportModal from '@/components/ui/ExportModal';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const TEMP_ZONE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  normal: { label: 'Normal (Ambient)', bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500' },
  cold_minus4: { label: 'Cold (-4°C)', bg: 'bg-cyan-400', text: 'text-cyan-400', border: 'border-cyan-400' },
  cold_minus20: { label: 'Frozen (-20°C)', bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-600' },
};

const HAZARD_CONFIG: Record<string, string> = {
  ibc: '🟡',
  ippc: '🟠',
  none: ''
};

// Mock function to determine required temp based on material name (since it's not in schema)
const getRequiredTemp = (materialName: string = '') => {
  const name = materialName.toLowerCase();
  if (name.includes('ekstrak') || name.includes('liquid')) return 'cold_minus4';
  if (name.includes('frozen') || name.includes('beku') || name.includes('kultur')) return 'cold_minus20';
  return 'normal';
};

export default function WarehouseDashboard() {
  const [slots, setSlots] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [availableLots, setAvailableLots] = useState<any[]>([]); // Lots ready to be assigned
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [assignLotId, setAssignLotId] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [mismatches, setMismatches] = useState<any[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [slotsData, statsData, lotsData] = await Promise.all([
        supabaseWarehouseApi.getSlots(),
        supabaseWarehouseApi.getStats(),
        supabaseLotsApi.getAll({ status: 'completed' }), // Unassigned completed lots
      ]);
      
      setSlots(slotsData || []);
      setStats(statsData);
      
      // Filter out lots that are already in the warehouse
      const occupiedLotIds = slotsData?.filter(s => s.is_occupied).map(s => s.current_lot_id) || [];
      const unassignedLots = (lotsData || []).filter(l => !occupiedLotIds.includes(l.id));
      setAvailableLots(unassignedLots);

      // Detect temp mismatches
      const detectedMismatches = (slotsData || []).filter(s => {
        if (!s.is_occupied || !s.lots) return false;
        const reqTemp = getRequiredTemp(s.lots.incoming_materials?.material_name);
        return reqTemp !== s.temperature_zone;
      });
      setMismatches(detectedMismatches);
      
    } catch { 
      toast.error('Gagal memuat data gudang'); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Supabase Realtime Setup
    const sb = createClient();
    const channel = sb.channel('warehouse_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_slots' }, () => {
        console.log('Realtime update detected!');
        fetchData(); // Refetch on any slot change
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [fetchData]);

  const logAudit = async (action: string, recordId: string, oldVal: any, newVal: any) => {
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      await sb.from('audit_logs').insert({
        user_id: user.id,
        action,
        table_name: 'warehouse_slots',
        record_id: recordId,
        old_value: oldVal,
        new_value: newVal
      });
    } catch (e) {
      console.error('Failed to log audit', e);
    }
  };

  const handleAssignLot = async () => {
    if (!selectedSlot || !assignLotId) return;
    setSaving(true);
    const sb = createClient();
    try {
      await sb.from('warehouse_slots').update({
        current_lot_id: assignLotId,
        is_occupied: true,
        last_updated: new Date().toISOString()
      }).eq('id', selectedSlot.id);
      
      await logAudit('Assign Lot to Slot', selectedSlot.id, { occupied: false }, { occupied: true, lot_id: assignLotId });
      
      toast.success(`Lot berhasil ditempatkan di ${selectedSlot.slot_code}`);
      setSelectedSlot(null);
      setAssignLotId('');
      // Realtime will trigger refetch
    } catch { 
      toast.error('Gagal menempatkan lot'); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleRemoveLot = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    const sb = createClient();
    try {
      const lotId = selectedSlot.current_lot_id;
      // Empty the slot
      await sb.from('warehouse_slots').update({
        current_lot_id: null,
        is_occupied: false,
        last_updated: new Date().toISOString()
      }).eq('id', selectedSlot.id);
      
      // Update lot status to dispatched
      await sb.from('lots').update({ status: 'dispatched' }).eq('id', lotId);
      
      await logAudit('Remove Lot from Slot', selectedSlot.id, { occupied: true, lot_id: lotId }, { occupied: false });

      toast.success(`Lot dikeluarkan dari gudang`);
      setSelectedSlot(null);
    } catch { 
      toast.error('Gagal mengeluarkan lot'); 
    } finally { 
      setSaving(false); 
    }
  };

  const getSlotColorClass = (slot: any) => {
    if (mismatches.find(m => m.id === slot.id)) {
      return 'bg-red-500/20 border-red-500 animate-pulse'; // Mismatch alert
    }
    
    if (slot.hazard_type !== 'none') {
      return 'bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30';
    }

    if (!slot.is_occupied) {
      // Available slots styling based on temp zone
      if (slot.temperature_zone === 'normal') return 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20';
      if (slot.temperature_zone === 'cold_minus4') return 'bg-cyan-400/10 border-cyan-400/30 hover:bg-cyan-400/20';
      if (slot.temperature_zone === 'cold_minus20') return 'bg-sky-200/10 border-sky-200/30 hover:bg-sky-200/20';
    } else {
      // Occupied slots styling
      if (slot.temperature_zone === 'normal') return 'bg-blue-500/40 border-blue-500 hover:bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]';
      if (slot.temperature_zone === 'cold_minus4') return 'bg-sky-500/40 border-sky-500 hover:bg-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.3)]';
      if (slot.temperature_zone === 'cold_minus20') return 'bg-blue-800/60 border-blue-400 hover:bg-blue-800/70 shadow-[0_0_15px_rgba(3,105,161,0.5)]';
    }
    
    return 'bg-slate-700/60 border-slate-600 hover:bg-gray-100 dark:hover:bg-gray-800';
  };

  // Group slots by row (A-J)
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const gridByRow: Record<string, any[]> = {};
  rows.forEach(r => {
    gridByRow[r] = slots.filter(s => s.zone_row === r).sort((a, b) => a.zone_col - b.zone_col);
  });

  const selectedLotTempReq = assignLotId ? getRequiredTemp(availableLots.find(l => l.id === assignLotId)?.incoming_materials?.material_name) : null;
  const showTempWarning = selectedLotTempReq && selectedSlot && selectedLotTempReq !== selectedSlot.temperature_zone;

  const coldChainSlots = slots.filter(s => s.temperature_zone !== 'normal');
  const coldChainOccupied = coldChainSlots.filter(s => s.is_occupied).length;

  return (
    <DashboardLayout allowedRoles={['warehouse', 'admin']} onRefresh={fetchData}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 flex items-center gap-2">
              
              Peta Lantai Gudang
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Sistem manajemen penempatan dan Cold-Chain Realtime</p>
          </div>
          <button 
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-white/90 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            
            Export Inventory
          </button>
        </div>

        {/* Mismatch Alert Banner */}
        {mismatches.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl animate-in fade-in slide-in-from-top-4">
            
            <div>
              <div className="text-red-500 font-bold">
                ⚠️ CRITICAL: {mismatches.length} Lot Berada di Zona Suhu yang Salah!
              </div>
              <div className="text-red-400/80 text-sm mt-1">
                Segera pindahkan lot berikut ke zona yang sesuai:
                <ul className="list-disc list-inside mt-1">
                  {mismatches.map(m => (
                    <li key={m.id}>
                      Slot {m.slot_code} ({m.lots?.lot_number}) — Seharusnya: {TEMP_ZONE_CONFIG[getRequiredTemp(m.lots?.incoming_materials?.material_name)]?.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Stats & Legend */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-800/50">
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800 dark:text-white/90">{stats?.total || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Slot</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-400">{stats?.occupied || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Terisi</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{stats?.available || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Tersedia</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-800">
                
                <div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-white/90">Cold-Chain</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{coldChainOccupied} / {coldChainSlots.length} terisi</div>
                </div>
              </div>
            </div>

            {/* Visual Legend */}
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30" /><span className="text-gray-700 dark:text-gray-300">Tersedia (Normal)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-500/40 border border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" /><span className="text-gray-800 dark:text-white/90 font-medium">Terisi (Normal)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-cyan-400/20 border border-cyan-400/30" /><span className="text-gray-700 dark:text-gray-300">Tersedia (-4°C)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-sky-500/40 border border-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]" /><span className="text-gray-800 dark:text-white/90 font-medium">Terisi (-4°C)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-sky-200/10 border border-sky-200/30" /><span className="text-gray-700 dark:text-gray-300">Tersedia (-20°C)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-800/60 border border-blue-400 shadow-[0_0_10px_rgba(3,105,161,0.5)]" /><span className="text-gray-800 dark:text-white/90 font-medium">Terisi (-20°C)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/50 text-center leading-none">🟡</div><span className="text-gray-700 dark:text-gray-300">Hazardous (IBC/IPPC)</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-4 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90 flex items-center gap-2 mb-3">
              
              Lot Siap Masuk ({availableLots.length})
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-32 lg:max-h-[120px]">
              {availableLots.length === 0 ? (
                <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">Semua lot sudah dialokasikan</div>
              ) : (
                availableLots.map(lot => {
                  const req = getRequiredTemp(lot.incoming_materials?.material_name);
                  return (
                    <div key={lot.id} className="text-xs p-2 bg-gray-100 dark:bg-gray-800/60 rounded border border-gray-200 dark:border-gray-800 flex justify-between items-center">
                      <div>
                        <span className="font-mono font-bold text-gray-800 dark:text-white/90">{lot.lot_number}</span>
                        <div className="text-gray-400 dark:text-gray-500 truncate max-w-[120px]">{lot.incoming_materials?.material_name}</div>
                      </div>
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] border", TEMP_ZONE_CONFIG[req].bg.replace('bg-', 'bg-').concat('/20'), TEMP_ZONE_CONFIG[req].text, TEMP_ZONE_CONFIG[req].border.replace('border-', 'border-').concat('/30'))}>
                        {TEMP_ZONE_CONFIG[req].label.split(' ')[0]}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 10x8 Interactive Grid Map */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-6 overflow-x-auto">
          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="min-w-[800px]">
              {/* Column Headers */}
              <div className="grid grid-cols-8 gap-2 mb-2 ml-8">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(c => (
                  <div key={c} className="text-center text-gray-400 dark:text-gray-500 text-sm font-bold">{c}</div>
                ))}
              </div>
              
              {/* Rows */}
              <div className="space-y-2">
                {rows.map(r => (
                  <div key={r} className="flex items-center gap-2">
                    {/* Row Header */}
                    <div className="w-6 text-center text-gray-400 dark:text-gray-500 font-bold text-sm">{r}</div>
                    
                    {/* Slots in Row */}
                    <div className="grid grid-cols-8 gap-2 flex-1">
                      {(gridByRow[r] || []).map(slot => (
                        <button key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            'group relative aspect-[4/3] rounded-lg border transition-all duration-200 overflow-hidden flex flex-col items-center justify-center',
                            getSlotColorClass(slot),
                            selectedSlot?.id === slot.id && 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                          )}
                        >
                          {/* Slot Code (Top Left) */}
                          <div className="absolute top-1 left-1.5 text-[10px] font-mono font-bold text-gray-800 dark:text-white/90/70 group-hover:text-gray-800 dark:text-white/90">
                            {slot.slot_code}
                          </div>
                          
                          {/* Hazard Icon (Top Right) */}
                          {slot.hazard_type !== 'none' && (
                            <div className="absolute top-1 right-1.5 text-[10px]" title={`Hazard: ${slot.hazard_type.toUpperCase()}`}>
                              {HAZARD_CONFIG[slot.hazard_type]}
                            </div>
                          )}

                          {/* Content (Center) */}
                          {slot.is_occupied ? (
                            <div className="flex flex-col items-center justify-center mt-2">
                              
                              <div className="text-xs font-mono font-bold text-gray-800 dark:text-white/90">{slot.lots?.lot_number}</div>
                            </div>
                          ) : (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                              <span className="text-xs font-medium text-gray-800 dark:text-white/90/80">+ Assign</span>
                            </div>
                          )}
                          
                          {/* Zone Indicator (Bottom) */}
                          <div className={cn(
                            "absolute bottom-0 inset-x-0 h-1 opacity-50",
                            slot.temperature_zone === 'cold_minus4' ? 'bg-cyan-400' :
                            slot.temperature_zone === 'cold_minus20' ? 'bg-blue-600' : 'bg-transparent'
                          )} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interaction Modals */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSelectedSlot(null); setAssignLotId(''); }} />
          <div className="relative rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <button onClick={() => { setSelectedSlot(null); setAssignLotId(''); }} className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-white/90">
              
            </button>
            
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800/50">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", TEMP_ZONE_CONFIG[selectedSlot.temperature_zone]?.bg.replace('bg-', 'bg-').concat('/20'), TEMP_ZONE_CONFIG[selectedSlot.temperature_zone]?.border.replace('border-', 'border-').concat('/50'))}>
                <span className={cn("font-mono font-bold text-xl", TEMP_ZONE_CONFIG[selectedSlot.temperature_zone]?.text)}>
                  {selectedSlot.slot_code}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Detail Slot Gudang</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
                  
                  {TEMP_ZONE_CONFIG[selectedSlot.temperature_zone]?.label}
                </p>
              </div>
            </div>

            {selectedSlot.is_occupied ? (
              /* Occupied Slot View */
              <div className="space-y-4">
                <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lot Number</div>
                  <div className="text-xl font-mono font-bold text-gray-800 dark:text-white/90 mb-3">{selectedSlot.lots?.lot_number}</div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400 dark:text-gray-500 mb-0.5">Material</div>
                      <div className="text-gray-800 dark:text-white/90 truncate">{selectedSlot.lots?.incoming_materials?.material_name}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 dark:text-gray-500 mb-0.5">QC Status</div>
                      <div className="text-green-400 flex items-center gap-1"> Approved</div>
                    </div>
                  </div>
                </div>

                {mismatches.find(m => m.id === selectedSlot.id) && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                    
                    <div className="text-sm text-red-400">
                      <strong>Mismatch Suhu!</strong> Material ini memerlukan {TEMP_ZONE_CONFIG[getRequiredTemp(selectedSlot.lots?.incoming_materials?.material_name)]?.label}.
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={handleRemoveLot} disabled={saving}
                    className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg font-medium transition-colors disabled:opacity-50">
                    Keluarkan
                  </button>
                  <button onClick={() => toast('Fitur Pindah Lot sedang dikembangkan')} disabled={saving}
                    className="flex-1 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg font-medium transition-colors disabled:opacity-50">
                    Pindah Slot
                  </button>
                </div>
              </div>
            ) : (
              /* Empty Slot View (Assignment) */
              <div className="space-y-4">
                <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assign Lot ke Slot Ini</label>
                  {availableLots.length === 0 ? (
                    <div className="text-sm text-gray-400 dark:text-gray-500 italic py-2">Tidak ada lot yang siap dimasukkan ke gudang.</div>
                  ) : (
                    <select 
                      value={assignLotId} 
                      onChange={(e) => setAssignLotId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-slate-600 rounded-lg text-gray-800 dark:text-white/90 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                    >
                      <option value="">-- Pilih Lot --</option>
                      {availableLots.map(lot => (
                        <option key={lot.id} value={lot.id}>
                          {lot.lot_number} - {lot.incoming_materials?.material_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {showTempWarning && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2 animate-in slide-in-from-top-2">
                    
                    <div className="text-sm text-yellow-400">
                      <strong>Peringatan Suhu:</strong> Lot ini idealnya disimpan di <strong>{TEMP_ZONE_CONFIG[selectedLotTempReq]?.label}</strong>. Slot ini adalah {TEMP_ZONE_CONFIG[selectedSlot.temperature_zone]?.label}.
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleAssignLot} 
                  disabled={!assignLotId || saving}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-gray-800 dark:text-white/90 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Konfirmasi Penempatan
                  
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        reportType="warehouse" 
        title="Export Inventory Gudang" 
      />
    </DashboardLayout>
  );
}
