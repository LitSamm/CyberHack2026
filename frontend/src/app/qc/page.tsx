'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { supabaseMaterialsApi, supabaseQcApi, supabaseSuppliersApi } from '@/lib/supabase-api';
import { createClient } from '@/lib/supabase';
import { formatDate, formatDateTime } from '@/lib/utils';
import { FlaskConical, AlertTriangle, CheckCircle, XCircle, Clock, X, Camera, Download, Play, Square, RotateCcw, PackagePlus } from 'lucide-react';
import ExportModal from '@/components/ui/ExportModal';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function QCDashboard() {
  const { user: authUser } = useAuth();
  const cameraServiceUrl = process.env.NEXT_PUBLIC_CV_SERVICE_URL || 'http://localhost:8000';
  const [pendingMaterials, setPendingMaterials] = useState<any[]>([]);
  const [todayChecks, setTodayChecks] = useState<any[]>([]);
  const [overdueAlerts, setOverdueAlerts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [showQCForm, setShowQCForm] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [formData, setFormData] = useState({
    color_grade: 3, consistency_grade: 3, contamination_flag: false, notes: '', result: '',
  });
  const [saving, setSaving] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [cameraMode, setCameraMode] = useState<'video' | 'webcam'>('video');
  const [cameraStatus, setCameraStatus] = useState<any>({
    session_id: null, mode: null, state: 'idle', count: 0, elapsed_seconds: 0, error: null,
  });
  const [cameraBusy, setCameraBusy] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [selectedCamera, setSelectedCamera] = useState<number>(1);
  const [intakeForm, setIntakeForm] = useState({
    supplier_id: '', material_name: 'Apel Fuji', unit: 'item',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [mats, checks, overdue, supplierData] = await Promise.all([
        supabaseMaterialsApi.getAll({ status: 'pending' }),
        supabaseQcApi.getAll({ date: today }),
        supabaseQcApi.getPending24h(),
        supabaseSuppliersApi.getAll(),
      ]);
      setPendingMaterials(mats || []);
      setTodayChecks(checks || []);
      setOverdueAlerts(overdue || []);
      setSuppliers(supplierData || []);
    } catch { toast.error('Gagal memuat data QC'); }
    finally { setLoading(false); }
  }, []);

  const submitQCDirect = async (result: 'pass' | 'fail') => {
    if (!selectedMaterial?.id) {
      toast.error('Material belum dipilih.');
      return;
    }
    if (!authUser) {
      toast.error('Sesi login habis. Silakan login ulang.');
      return;
    }
    setSaving(true);
    const sb = createClient();
    try {
      const finalResult = result;

      const { data: profile } = await sb.from('users').select('id').eq('id', authUser.id).single();
      const payload: any = {
        material_id: selectedMaterial.id,
        color_grade: formData.color_grade,
        consistency_grade: formData.consistency_grade,
        contamination_flag: formData.contamination_flag,
        result: finalResult,
        notes: formData.notes,
        checked_at: new Date().toISOString(),
      };
      if (profile) payload.checked_by = authUser.id;

      // Insert QC check
      const { error: qcErr } = await sb.from('qc_checks').insert(payload);
      if (qcErr) throw qcErr;
      
      // Update material qc_status
      const { error: updateErr } = await sb.from('incoming_materials').update({ qc_status: finalResult === 'pass' ? 'approved' : 'rejected' }).eq('id', selectedMaterial.id);
      if (updateErr) throw updateErr;
      
      toast.success(finalResult === 'pass' ? 'Material disetujui' : 'Material ditolak');
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

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${cameraServiceUrl}/receiving/status`);
        if (res.ok) setCameraStatus(await res.json());
      } catch {}
    }, 700);
    return () => clearInterval(interval);
  }, [cameraServiceUrl]);

  const openQCForm = (material: any) => {
    setSelectedMaterial(material);
    setFormData({ 
      color_grade: 3, consistency_grade: 3, contamination_flag: false, notes: '', result: '',
    });
    setShowQCForm(true);
  };

  const cameraRequest = async (path: string) => {
    setCameraBusy(true);
    try {
      const res = await fetch(`${cameraServiceUrl}${path}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Camera service gagal memproses request');
      setCameraStatus(data);
      return data;
    } catch (err: any) {
      toast.error(err?.message || 'Camera service tidak tersedia');
      throw err;
    } finally {
      setCameraBusy(false);
    }
  };

  const startCamera = async () => {
    if (!intakeForm.supplier_id || !intakeForm.material_name.trim()) {
      toast.error('Pilih supplier dan isi nama material terlebih dahulu');
      return;
    }
    const endpoint = cameraMode === 'webcam' ? `/receiving/webcam/start?device=${selectedCamera}` : `/receiving/video/start`;
    try {
      await cameraRequest(endpoint);
      setStreamKey(Date.now());
      toast.success(cameraMode === 'video' ? 'Video demo mulai diproses' : 'Webcam live aktif');
    } catch (e) {
      // Error is already shown by cameraRequest
    }
  };

  const stopCamera = async () => {
    try {
      await cameraRequest('/receiving/stop');
    } catch (e) {}
  };

  const resetCamera = async () => {
    try {
      await cameraRequest('/receiving/reset');
      setStreamKey(Date.now());
    } catch (e) {}
  };

  const confirmCameraIntake = async () => {
    if (!cameraStatus.session_id || cameraStatus.count <= 0) {
      toast.error('Belum ada barang terdeteksi');
      return;
    }
    if (cameraStatus.state === 'running') {
      toast.error('Hentikan scanning sebelum menambahkan material');
      return;
    }
    if (!intakeForm.supplier_id || !intakeForm.material_name.trim()) {
      toast.error('Pilih supplier dan isi nama material terlebih dahulu');
      return;
    }
    setCameraBusy(true);
    const sb = createClient();
    try {
      if (!authUser) throw new Error('Sesi login habis. Silakan login ulang.');
      const notes = `AI Camera Receiving | session=${cameraStatus.session_id} | mode=${cameraStatus.mode} | count=${cameraStatus.count}`;
      const { data: profile } = await sb.from('users').select('id').eq('id', authUser.id).single();
      const payload: any = {
        supplier_id: intakeForm.supplier_id || null,
        material_name: intakeForm.material_name.trim(),
        quantity: cameraStatus.count,
        unit: intakeForm.unit,
        received_date: new Date().toISOString(),
        qc_status: 'pending',
        notes,
      };
      if (profile) payload.received_by = authUser.id;

      const { data: material, error } = await sb.from('incoming_materials').insert(payload).select().single();
      if (error) throw error;
      const auditPayload: any = {
        action: 'CAMERA_RECEIVING',
        table_name: 'incoming_materials',
        record_id: material.id,
        new_value: { session_id: cameraStatus.session_id, mode: cameraStatus.mode, count: cameraStatus.count },
      };
      if (profile) auditPayload.user_id = authUser.id;

      const { error: auditErr } = await sb.from('audit_logs').insert(auditPayload);
      if (auditErr) console.warn('Gagal menyimpan audit_logs:', auditErr);
      
      toast.success(`${cameraStatus.count} ${intakeForm.unit} masuk ke antrian QC`);
    } catch (err: any) {
      console.error('confirmCameraIntake error:', err);
      toast.error(err?.message || 'Gagal menambahkan material ke antrian QC');
      return;
    } finally {
      setCameraBusy(false);
    }
    
    // Reset camera and refresh data independently of the insert try/catch
    try {
      await cameraRequest('/receiving/reset');
    } catch (e) {}
    await fetchData();
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
            <p className="text-slate-400 text-sm mt-1">Pemeriksaan kualitas material masuk sebelum PPIC membuat lot</p>
          </div>
          <button 
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-orange-500" />
            Export Laporan QC
          </button>
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

        {/* Camera Receiving Station */}
        <section className="glass-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-700/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Camera className="h-5 w-5 text-orange-400" />
                AI Camera Receiving Station
              </h2>
              <p className="mt-1 text-xs text-slate-400">Hitung material yang melewati conveyor, lalu kirim satu batch ke antrian QC.</p>
            </div>
            <div className="flex w-fit rounded-lg border border-slate-700 bg-slate-900/60 p-1">
              {[
                { value: 'video', label: 'Video Demo' },
                { value: 'webcam', label: 'Webcam Live' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setCameraMode(option.value as 'video' | 'webcam')}
                  disabled={cameraStatus.state === 'running'}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    cameraMode === option.value ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-700 bg-black">
              {cameraStatus.state === 'running' || cameraStatus.state === 'stopped' ? (
                <img
                  key={streamKey}
                  src={`${cameraServiceUrl}/receiving/stream?session=${cameraStatus.session_id || ''}&v=${streamKey}`}
                  alt="Annotated conveyor camera"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Camera className="mb-3 h-12 w-12 text-slate-700" />
                  <div className="text-sm font-medium text-slate-400">Camera station siap digunakan</div>
                  <div className="mt-1 text-xs text-slate-600">Pilih source dan mulai receiving session.</div>
                </div>
              )}
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950/80 px-2.5 py-1.5">
                <span className={`h-2 w-2 rounded-full ${
                  cameraStatus.state === 'running' ? 'animate-pulse bg-red-500' :
                  cameraStatus.state === 'error' ? 'bg-red-500' : 'bg-slate-500'
                }`} />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-200">{cameraStatus.state}</span>
              </div>
              <div className="absolute bottom-3 right-3 rounded-lg border border-orange-500/40 bg-slate-950/85 px-4 py-3 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-orange-300">Detected Items</div>
                <div className="text-4xl font-bold leading-none text-white">{cameraStatus.count || 0}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Supplier</label>
                <select
                  value={intakeForm.supplier_id}
                  onChange={e => setIntakeForm(p => ({ ...p, supplier_id: e.target.value }))}
                  disabled={cameraStatus.state === 'running'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-white focus:border-orange-500"
                >
                  <option value="">Pilih supplier...</option>
                  {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Nama Material</label>
                <input
                  value={intakeForm.material_name}
                  onChange={e => setIntakeForm(p => ({ ...p, material_name: e.target.value }))}
                  disabled={cameraStatus.state === 'running'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-white focus:border-orange-500"
                />
              </div>
              {cameraMode === 'webcam' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Pilih Kamera</label>
                  <select
                    value={selectedCamera}
                    onChange={e => setSelectedCamera(Number(e.target.value))}
                    disabled={cameraStatus.state === 'running'}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-white focus:border-orange-500"
                  >
                    <option value={0}>Kamera 1 (Index 0)</option>
                    <option value={1}>Kamera 2 (Index 1)</option>
                    <option value={2}>Kamera 3 (Index 2)</option>
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Source</div>
                  <div className="mt-1 text-xs font-medium text-slate-200">{cameraMode === 'video' ? 'Video Demo' : 'Webcam Live'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Elapsed</div>
                  <div className="mt-1 text-xs font-medium text-slate-200">{cameraStatus.elapsed_seconds || 0}s</div>
                </div>
              </div>
              {cameraStatus.error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{cameraStatus.error}</div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {cameraStatus.state !== 'running' ? (
                  <button onClick={startCamera} disabled={cameraBusy}
                    className="flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50">
                    <Play className="h-4 w-4" /> Mulai Scan
                  </button>
                ) : (
                  <button onClick={stopCamera} disabled={cameraBusy}
                    className="flex items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50">
                    <Square className="h-4 w-4" /> Selesai
                  </button>
                )}
                <button onClick={resetCamera} disabled={cameraBusy || cameraStatus.state === 'running'}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50">
                  <RotateCcw className="h-4 w-4" /> Reset
                </button>
              </div>
              <button onClick={confirmCameraIntake}
                disabled={cameraBusy || cameraStatus.state === 'running' || !cameraStatus.session_id || cameraStatus.count <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-3 py-3 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-40">
                <PackagePlus className="h-4 w-4" /> Tambahkan ke Antrian QC
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Pending Queue */}
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              Antrian QC ({pendingMaterials.length})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              )) : pendingMaterials.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Semua material sudah diperiksa</p>
                </div>
              ) : pendingMaterials.map(mat => (
                <div key={mat.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700 hover:border-orange-500/30 transition-colors gap-3">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium truncate">{mat.material_name}</div>
                    <div className="text-slate-500 text-xs">{mat.suppliers?.name} • {mat.quantity} {mat.unit}</div>
                    <div className="text-slate-600 text-xs">{formatDate(mat.received_date)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openQCForm(mat)}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg font-medium transition-colors">
                      Periksa
                    </button>
                  </div>
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
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
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
                    <div className="flex items-center gap-2">
                      <div className="text-white text-sm font-medium">
                        {check.incoming_materials?.material_name || check.lots?.lot_number || 'QC Check'}
                      </div>
                    </div>
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

      {/* QC Form Modal (Manual) */}
      {showQCForm && selectedMaterial && (
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
                <p className="text-slate-400 text-sm">{selectedMaterial.material_name}</p>
              </div>
            </div>

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
                <button onClick={() => setConfirmReject(true)} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
                  <XCircle className="w-4 h-4" />
                  Tolak
                </button>
                <button onClick={() => submitQCDirect('pass')} disabled={saving}
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
        title="Tolak Material"
        message={`Yakin menolak material ${selectedMaterial?.material_name}? Material tidak akan tersedia untuk PPIC.`}
        confirmText="Tolak Material"
        variant="danger"
        onConfirm={() => submitQCDirect('fail')}
        onCancel={() => setConfirmReject(false)}
        loading={saving}
      />

      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        reportType="qc" 
        title="Export Laporan QC" 
      />
    </DashboardLayout>
  );
}
