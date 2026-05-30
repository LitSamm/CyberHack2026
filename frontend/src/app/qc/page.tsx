'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { supabaseMaterialsApi, supabaseQcApi, supabaseLotsApi } from '@/lib/supabase-api';
import { createClient } from '@/lib/supabase';
import { formatDate, formatDateTime } from '@/lib/utils';
import { TimeIcon, BoxIcon, CheckCircleIcon, CloseIcon, DownloadIcon, BoltIcon, InfoIcon, DocsIcon, VideoIcon } from '@/icons';
import ExportModal from '@/components/ui/ExportModal';
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
    ai_used: false, ai_color_grade: null as number | null, ai_consistency_grade: null as number | null, 
    ai_contamination_flag: null as boolean | null, ai_confidence: null as number | null, ai_recommendation: null as string | null
  });
  const [saving, setSaving] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // AI Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
      // Get current logged-in user
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Tidak dapat mengautentikasi user saat ini");

      // Determine final result from human
      const finalResult = result;

      // Insert QC check
      const { data: qcData, error: qcErr } = await sb.from('qc_checks').insert({
        lot_id: selectedLot.lot.id,
        checked_by: user.id, // Fixed: use current user, not lot creator
        color_grade: formData.color_grade,
        consistency_grade: formData.consistency_grade,
        contamination_flag: formData.contamination_flag,
        result: finalResult,
        notes: formData.notes,
        checked_at: new Date().toISOString(),
        ai_color_grade: formData.ai_color_grade,
        ai_consistency_grade: formData.ai_consistency_grade,
        ai_contamination_flag: formData.ai_contamination_flag,
        ai_confidence: formData.ai_confidence,
        ai_recommendation: formData.ai_recommendation,
        ai_used: formData.ai_used
      }).select().single();
      if (qcErr) throw qcErr;

      // Update lot status
      await sb.from('lots').update({ status: finalResult === 'pass' ? 'in_production' : 'rejected' }).eq('id', selectedLot.lot.id);
      
      // Update material qc_status
      await sb.from('incoming_materials').update({ qc_status: finalResult === 'pass' ? 'approved' : 'rejected' }).eq('id', selectedLot.id);
      
      // If AI was used, create an audit log to track AI vs Human decision
      if (formData.ai_used) {
        const actionDesc = formData.ai_recommendation === 'approve' && finalResult === 'fail' 
          ? 'AI OVERRIDDEN (Rejected despite AI Approve)' 
          : formData.ai_recommendation === 'reject' && finalResult === 'pass'
          ? 'AI OVERRIDDEN (Approved despite AI Reject)'
          : 'AI FOLLOWED';
          
        await sb.from('audit_logs').insert({
          user_id: user.id,
          action: `QC AI Scan - ${actionDesc}`,
          table_name: 'qc_checks',
          record_id: qcData.id,
          old_value: { ai_rec: formData.ai_recommendation, confidence: formData.ai_confidence },
          new_value: { final_decision: finalResult }
        });
      }

      toast.success(finalResult === 'pass' ? '✅ Lot disetujui!' : '❌ Lot ditolak');
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
    const lot = allLots.find(l => l.material_id === material.id);
    setSelectedLot({ ...material, lot });
    setFormData({ 
      color_grade: 3, consistency_grade: 3, contamination_flag: false, notes: '', result: '',
      ai_used: false, ai_color_grade: null, ai_consistency_grade: null, 
      ai_contamination_flag: null, ai_confidence: null, ai_recommendation: null
    });
    setShowQCForm(true);
  };

  const openAiModal = (material: any) => {
    const lot = allLots.find(l => l.material_id === material.id);
    setSelectedLot({ ...material, lot });
    setAiFile(null);
    setAiPreviewUrl(null);
    setAiResults(null);
    setShowAiModal(true);
  };

  const handleAiFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAiFile(file);
      setAiPreviewUrl(URL.createObjectURL(file));
      setAiResults(null);
    }
  };

  const analyzeImage = async () => {
    if (!aiFile) {
      toast.error('Pilih atau ambil foto terlebih dahulu');
      return;
    }
    setAiAnalyzing(true);
    try {
      const form = new FormData();
      form.append('file', aiFile);

      const res = await fetch('/api/cv-analyze', {
        method: 'POST',
        body: form
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menganalisis gambar');

      setAiResults(data);
      toast.success('Analisis AI selesai');
    } catch (err: any) {
      toast.error(err.message || 'Error saat komunikasi dengan server AI');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const applyAiToForm = () => {
    if (!aiResults) return;
    
    setFormData({
      color_grade: aiResults.color_grade,
      consistency_grade: aiResults.consistency_grade,
      contamination_flag: aiResults.contamination_detected,
      notes: aiResults.defects?.length > 0 ? `AI Note: ${aiResults.defects.join(', ')}` : 'AI merekomendasikan: ' + aiResults.recommendation,
      result: '',
      ai_used: true,
      ai_color_grade: aiResults.color_grade,
      ai_consistency_grade: aiResults.consistency_grade,
      ai_contamination_flag: aiResults.contamination_detected,
      ai_confidence: aiResults.confidence,
      ai_recommendation: aiResults.recommendation
    });
    
    setShowAiModal(false);
    setShowQCForm(true);
    toast.success('Data AI diterapkan ke form. Silakan review.');
  };

  const passRate = todayChecks.length > 0
    ? Math.round((todayChecks.filter(c => c.result === 'pass').length / todayChecks.length) * 100) : 0;

  const GradeSlider = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div>
      <div className="flex justify-between mb-1.5">
        <label className="text-sm text-gray-700 dark:text-gray-300">{label}</label>
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
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">QC Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Pemeriksaan kualitas material dan lot</p>
          </div>
          <button 
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-white/90 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            
            Export Laporan QC
          </button>
        </div>

        {/* Overdue Alert Banner */}
        {overdueAlerts.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            
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
            subtitle="Material belum diperiksa" icon={TimeIcon} color="orange" loading={loading} />
          <StatCard title="Selesai Hari Ini" value={todayChecks.length}
            subtitle="Total pemeriksaan" icon={BoxIcon} color="blue" loading={loading} />
          <StatCard title="Pass Rate Hari Ini" value={`${passRate}%`}
            subtitle={`${todayChecks.filter(c => c.result === 'pass').length} lulus dari ${todayChecks.length}`} icon={CheckCircleIcon} color="green" loading={loading} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Pending Queue */}
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-5">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">IoT Sensor Data (Prediksi)</h4>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-4 flex items-center gap-2">
              
              Antrian QC ({pendingMaterials.length})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              )) : pendingMaterials.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  
                  <p>Semua material sudah diperiksa</p>
                </div>
              ) : pendingMaterials.map(mat => (
                <div key={mat.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-100 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-orange-500/30 transition-colors gap-3">
                  <div className="min-w-0">
                    <div className="text-gray-800 dark:text-white/90 text-sm font-medium truncate">{mat.material_name}</div>
                    <div className="text-gray-400 dark:text-gray-500 text-xs">{mat.suppliers?.name} • {mat.quantity} {mat.unit}</div>
                    <div className="text-slate-600 text-xs">{formatDate(mat.received_date)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openAiModal(mat)}
                      className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5">
                      
                      Scan AI
                    </button>
                    <button onClick={() => openQCForm(mat)}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-gray-800 dark:text-white/90 text-xs rounded-lg font-medium transition-colors">
                      Periksa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Completed */}
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-4 flex items-center gap-2">
              
              Selesai Hari Ini ({todayChecks.length})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              )) : todayChecks.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  
                  <p>Belum ada pemeriksaan hari ini</p>
                </div>
              ) : todayChecks.map(check => (
                <div key={check.id} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-gray-800 dark:text-white/90 text-sm font-medium font-mono">{check.lots?.lot_number}</div>
                      {check.ai_used && <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded uppercase">AI</span>}
                    </div>
                    <div className="text-gray-400 dark:text-gray-500 text-xs">
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

      {/* QC Form Modal (Manual) */}
      {showQCForm && selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowQCForm(false)} />
          <div className="relative rounded-2xl border border-gray-200 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowQCForm(false)} className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-white/90">
              
            </button>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Form QC Pemeriksaan</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{selectedLot.material_name}</p>
              </div>
            </div>

            {!selectedLot.lot && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                ⚠️ Lot belum dibuat. Buat lot di PPIC terlebih dahulu.
              </div>
            )}

            {formData.ai_used && (
              <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg flex gap-2 items-start">
                
                <div className="text-sm text-indigo-300">
                  Data form telah diisi otomatis berdasarkan hasil AI dengan confidence <strong>{formData.ai_confidence}%</strong>. Anda bisa mengubahnya jika tidak sesuai.
                </div>
              </div>
            )}

            <div className="space-y-5">
              <GradeSlider label="Grade Warna" value={formData.color_grade}
                onChange={v => setFormData(p => ({ ...p, color_grade: v }))} />
              <GradeSlider label="Grade Konsistensi" value={formData.consistency_grade}
                onChange={v => setFormData(p => ({ ...p, consistency_grade: v }))} />

              <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-800">
                <label className="text-sm text-gray-700 dark:text-gray-300">Kontaminasi Terdeteksi</label>
                <button onClick={() => setFormData(p => ({ ...p, contamination_flag: !p.contamination_flag }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${formData.contamination_flag ? 'bg-red-500' : 'bg-slate-600'}`}>
                  <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-transform ${formData.contamination_flag ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Catatan</label>
                <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  rows={3} placeholder="Catatan tambahan..."
                  className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-white/90 text-sm resize-none focus:border-orange-500" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setConfirmReject(true)} disabled={saving || !selectedLot.lot}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
                  
                  Tolak
                </button>
                <button onClick={() => submitQCDirect('pass')} disabled={saving || !selectedLot.lot}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 text-gray-800 dark:text-white/90 rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
                  
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

      {/* AI Scan Modal */}
      {showAiModal && selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAiModal(false)} />
          <div className="relative rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-sm w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 lg:p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">Hasil Pemeriksaan QC</h2>
              <button onClick={() => setShowAiModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                
              </button>
            </div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Gunakan model Computer Vision untuk mendeteksi kualitas.</p>
            </div>

            <div className="space-y-4">
              {/* Image Input Section */}
              {!aiPreviewUrl ? (
                <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                  <div className="flex gap-4 mb-4">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-orange-400 transition-colors">
                      
                    </button>
                    <button onClick={() => cameraInputRef.current?.click()} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-orange-400 transition-colors">
                      
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">Pilih foto atau ambil gambar dari kamera</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Mendukung format JPG, PNG</p>
                  
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAiFileSelect} />
                  <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleAiFileSelect} />
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-black/50">
                  <img src={aiPreviewUrl} alt="Preview" className="w-full max-h-64 object-contain" />
                  {!aiAnalyzing && !aiResults && (
                    <button onClick={() => { setAiFile(null); setAiPreviewUrl(null); }} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg hover:bg-red-500/50 text-gray-800 dark:text-white/90 transition-colors">
                      
                    </button>
                  )}
                </div>
              )}

              {/* Action Button */}
              {!aiResults && aiPreviewUrl && (
                <button onClick={analyzeImage} disabled={aiAnalyzing}
                  className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-gray-800 dark:text-white/90 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {aiAnalyzing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      AI sedang menganalisis...
                    </>
                  ) : (
                    <>
                      
                      Mulai Analisis
                    </>
                  )}
                </button>
              )}

              {/* Results Card */}
              {aiResults && (
                <div className="bg-gray-100 dark:bg-gray-800/80 border border-indigo-500/30 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
                    <h4 className="font-medium text-gray-800 dark:text-white/90 flex items-center gap-2">
                      
                      Hasil Deteksi
                    </h4>
                    <span className="text-xs font-semibold px-2 py-1 bg-slate-700 rounded-md text-gray-700 dark:text-gray-300">
                      {aiResults.confidence}% Akurat
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Color Grade</div>
                      <div className="text-lg font-bold text-gray-800 dark:text-white/90">{aiResults.color_grade}<span className="text-gray-400 dark:text-gray-500 text-sm">/5</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Consistency</div>
                      <div className="text-lg font-bold text-gray-800 dark:text-white/90">{aiResults.consistency_grade}<span className="text-gray-400 dark:text-gray-500 text-sm">/5</span></div>
                    </div>
                  </div>

                  {aiResults.contamination_detected && (
                    <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-2 rounded-lg text-sm">
                      
                      Kontaminasi Terdeteksi!
                    </div>
                  )}

                  {aiResults.defects?.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Defects Found:</div>
                      <ul className="list-disc list-inside text-xs text-yellow-300">
                        {aiResults.defects.map((d: string, i: number) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Rekomendasi AI:</div>
                    <StatusBadge status={
                      aiResults.recommendation === 'approve' ? 'completed' : 
                      aiResults.recommendation === 'reject' ? 'rejected' : 'queued'
                    } customLabel={aiResults.recommendation.toUpperCase()} />
                  </div>

                  <button onClick={applyAiToForm}
                    className="w-full mt-2 py-3 bg-orange-500 hover:bg-orange-600 text-gray-800 dark:text-white/90 rounded-lg text-sm font-medium transition-colors">
                    Terapkan ke Form QC
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        reportType="qc" 
        title="Export Laporan QC" 
      />
    </DashboardLayout>
  );
}
