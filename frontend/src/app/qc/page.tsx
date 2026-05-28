'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { supabaseMaterialsApi, supabaseQcApi, supabaseLotsApi } from '@/lib/supabase-api';
import { createClient } from '@/lib/supabase';
import { formatDate, formatDateTime } from '@/lib/utils';
import { FlaskConical, AlertTriangle, CheckCircle, XCircle, Clock, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function QCDashboard() {
  const [pendingMaterials, setPendingMaterials] = useState<any[]>([]);
  const [todayChecks, setTodayChecks] = useState<any[]>([]);
  const [overdueAlerts, setOverdueAlerts] = useState<any[]>([]);
  const [allLots, setAllLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLot, setSelectedLot] = useState<any>(null);
  const [showQCForm, setShowQCForm] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [formData, setFormData] = useState({
    color_grade: 3, consistency_grade: 3, contamination_flag: false, notes: '', result: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [mats, checks, overdue, lots] = await Promise.all([
        supabaseMaterialsApi.getAll({ status: 'pending' }),
        supabaseQcApi.getAll({ date: today }),
        supabaseQcApi.getPending24h(),
        supabaseLotsApi.getAll({ status: 'queued' }),
      ]);
      setPendingMaterials(mats || []);
      setTodayChecks(checks || []);
      setOverdueAlerts(overdue || []);
      setAllLots(lots || []);
    } catch { toast.error('Gagal memuat data QC'); }
    finally { setLoading(false); }
  }, []);

  const submitQCDirect = async (result: 'pass' | 'fail') => {
    if (!selectedLot?.lot) {
      toast.error('Lot belum dibuat untuk material ini. Buat lot dulu di PPIC.');
      return;
    }
    setSaving(true);
    const sb = createClient();
    try {
      // Insert QC check
      const { error: qcErr } = await sb.from('qc_checks').insert({
        lot_id: selectedLot.lot.id,
        checked_by: selectedLot.lot.created_by,
        color_grade: formData.color_grade,
        consistency_grade: formData.consistency_grade,
        contamination_flag: formData.contamination_flag,
        result,
        notes: formData.notes,
        checked_at: new Date().toISOString(),
      });
      if (qcErr) throw qcErr;
      // Update lot status
      await sb.from('lots').update({ status: result === 'pass' ? 'in_production' : 'rejected' }).eq('id', selectedLot.lot.id);
      // Update material qc_status
      await sb.from('incoming_materials').update({ qc_status: result === 'pass' ? 'approved' : 'rejected' }).eq('id', selectedLot.id);
      toast.success(result === 'pass' ? '✅ Lot disetujui!' : '❌ Lot ditolak');
      setShowQCForm(false);
      setConfirmReject(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal submit QC');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const openQCForm = (material: any) => {
    // Find matching lot
    const lot = allLots.find(l => l.material_id === material.id);
    setSelectedLot({ ...material, lot });
    setFormData({ color_grade: 3, consistency_grade: 3, contamination_flag: false, notes: '', result: '' });
    setShowQCForm(true);
  };

  const passRate = todayChecks.length > 0
    ? Math.round((todayChecks.filter(c => c.result === 'pass').length / todayChecks.length) * 100) : 0;

  const GradeSlider = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div>
      <div className="flex justify-between mb-1.5">
        <label className="text-sm text-slate-300">{label}</label>
        <span className={`text-sm font-bold ${value >= 4 ? 'text-green-400' : value === 3 ? 'text-yellow-400' : 'text-red-400'}`}>
          {value}/5
        </span>
      </div>
      <input type="range" min={1} max={5} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-orange-500" />
      <div className="flex justify-between text-xs text-slate-600 mt-1">
        <span>Buruk</span><span>Sangat Baik</span>
      </div>
    </div>
  );

  return (
    <DashboardLayout allowedRoles={['qc', 'admin']} onRefresh={fetchData}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">QC Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Pemeriksaan kualitas material dan lot</p>
          </div>
        </div>

        {/* Overdue Alert Banner */}
        {overdueAlerts.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-yellow-400 font-semibold text-sm">
                ⚠️ {overdueAlerts.length} Material Menunggu QC {'>'} 24 Jam!
              </div>
              <div className="text-yellow-300/70 text-xs mt-1">
                {overdueAlerts.map(m => m.material_name).join(', ')}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Menunggu QC" value={pendingMaterials.length}
            subtitle="Material belum diperiksa" icon={Clock} color="orange" loading={loading} />
          <StatCard title="Selesai Hari Ini" value={todayChecks.length}
            subtitle="Total pemeriksaan" icon={FlaskConical} color="blue" loading={loading} />
          <StatCard title="Pass Rate Hari Ini" value={`${passRate}%`}
            subtitle={`${todayChecks.filter(c => c.result === 'pass').length} lulus dari ${todayChecks.length}`}
            icon={CheckCircle} color="green" loading={loading} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Pending Queue */}
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              Antrian QC ({pendingMaterials.length})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              )) : pendingMaterials.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Semua material sudah diperiksa</p>
                </div>
              ) : pendingMaterials.map(mat => (
                <div key={mat.id} className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700 hover:border-orange-500/30 transition-colors">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium truncate">{mat.material_name}</div>
                    <div className="text-slate-500 text-xs">{mat.suppliers?.name} • {mat.quantity} {mat.unit}</div>
                    <div className="text-slate-600 text-xs">{formatDate(mat.received_date)}</div>
                  </div>
                  <button onClick={() => openQCForm(mat)}
                    className="ml-3 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg font-medium transition-colors flex-shrink-0">
                    Periksa
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Completed */}
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Selesai Hari Ini ({todayChecks.length})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              )) : todayChecks.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada pemeriksaan hari ini</p>
                </div>
              ) : todayChecks.map(check => (
                <div key={check.id} className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                  <div>
                    <div className="text-white text-sm font-medium font-mono">{check.lots?.lot_number}</div>
                    <div className="text-slate-500 text-xs">
                      Warna: {check.color_grade}/5 • Konsistensi: {check.consistency_grade}/5
                    </div>
                    <div className="text-slate-600 text-xs">{check.users?.name} • {formatDateTime(check.checked_at)}</div>
                  </div>
                  <StatusBadge status={check.result} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* QC Form Modal */}
      {showQCForm && selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowQCForm(false)} />
          <div className="relative glass-card w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowQCForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Form QC Pemeriksaan</h3>
                <p className="text-slate-400 text-sm">{selectedLot.material_name}</p>
              </div>
            </div>

            {!selectedLot.lot && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                ⚠️ Lot belum dibuat. Buat lot di PPIC terlebih dahulu.
              </div>
            )}

            <div className="space-y-5">
              <GradeSlider label="Grade Warna" value={formData.color_grade}
                onChange={v => setFormData(p => ({ ...p, color_grade: v }))} />
              <GradeSlider label="Grade Konsistensi" value={formData.consistency_grade}
                onChange={v => setFormData(p => ({ ...p, consistency_grade: v }))} />

              <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                <label className="text-sm text-slate-300">Kontaminasi Terdeteksi</label>
                <button onClick={() => setFormData(p => ({ ...p, contamination_flag: !p.contamination_flag }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${formData.contamination_flag ? 'bg-red-500' : 'bg-slate-600'}`}>
                  <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-transform ${formData.contamination_flag ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Catatan</label>
                <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  rows={3} placeholder="Catatan tambahan..."
                  className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm resize-none focus:border-orange-500" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setConfirmReject(true)} disabled={saving || !selectedLot.lot}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
                  <XCircle className="w-4 h-4" />
                  Tolak
                </button>
                <button onClick={() => submitQCDirect('pass')} disabled={saving || !selectedLot.lot}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
                  <CheckCircle className="w-4 h-4" />
                  {saving ? 'Memproses...' : 'Setujui'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmReject}
        title="Tolak Lot"
        message={`Yakin menolak lot ${selectedLot?.lot?.lot_number}? Status lot akan berubah menjadi rejected.`}
        confirmText="Tolak Lot"
        variant="danger"
        onConfirm={() => submitQCDirect('fail')}
        onCancel={() => setConfirmReject(false)}
        loading={saving}
      />
    </DashboardLayout>
  );
}
