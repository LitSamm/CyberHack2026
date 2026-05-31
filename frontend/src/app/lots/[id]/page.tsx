'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Box, CalendarDays, FlaskConical, MapPin, Send, ThermometerSnowflake } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { supabaseLotPassportApi } from '@/lib/supabase-api';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function LotPassportPage() {
  const params = useParams<{ id: string }>();
  const [lot, setLot] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setLot(await supabaseLotPassportApi.getById(params.id));
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memuat lot passport');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <DashboardLayout><div className="p-8 text-gray-500">Memuat lot passport...</div></DashboardLayout>;
  }
  if (!lot) {
    return <DashboardLayout><div className="p-8 text-gray-500">Lot tidak ditemukan.</div></DashboardLayout>;
  }

  const rawQc = lot.qc_checks?.filter((check: any) => check.material_id) || [];
  const finishedQc = lot.qc_checks?.filter((check: any) => check.lot_id) || [];
  const slot = lot.warehouse_slots?.find((item: any) => item.is_occupied);

  return (
    <DashboardLayout onRefresh={fetchData}>
      <div className="space-y-6">
        <div>
          <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-orange-500">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-orange-500">Digital Lot Passport</p>
              <h1 className="mt-1 font-mono text-2xl font-bold text-gray-900 dark:text-white">{lot.lot_number}</h1>
            </div>
            <StatusBadge status={lot.status} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PassportCard icon={Box} title="Material Asal">
            <p className="font-medium">{lot.incoming_materials?.material_name}</p>
            <p>{lot.incoming_materials?.suppliers?.name || 'Supplier belum tercatat'}</p>
            <p>{lot.incoming_materials?.quantity} {lot.incoming_materials?.unit}</p>
            <p>Area awal: {lot.incoming_materials?.receiving_area || 'quarantine'}</p>
          </PassportCard>
          <PassportCard icon={CalendarDays} title="Produksi">
            <p>Jadwal: {lot.ppic_schedules?.[0]?.scheduled_date || '-'}</p>
            <p>Prioritas: {lot.ppic_schedules?.[0]?.priority || '-'}</p>
            <p>Dibuat: {formatDateTime(lot.created_at)}</p>
          </PassportCard>
          <PassportCard icon={MapPin} title="Gudang Finished Goods">
            <p>Slot aktif: {slot?.slot_code || '-'}</p>
            <p>Zona: {slot?.temperature_zone || '-'}</p>
            <p>Suhu aktual: {slot?.current_temperature ?? '-'}°C</p>
          </PassportCard>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><FlaskConical className="h-4 w-4 text-orange-500" /> Riwayat QC</h2>
          <TimelineRows rows={[
            ...rawQc.map((check: any) => ({ label: 'Raw-material QC', value: check.result, detail: formatDateTime(check.checked_at) })),
            ...finishedQc.map((check: any) => ({ label: 'Extract / powder release QC', value: check.result, detail: formatDateTime(check.checked_at) })),
          ]} empty="Belum ada riwayat QC" />
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><ThermometerSnowflake className="h-4 w-4 text-cyan-500" /> Cold-Chain Excursions</h2>
            <TimelineRows rows={(lot.cold_chain_excursions || []).map((item: any) => ({
              label: item.warehouse_slots?.slot_code || 'Slot',
              value: `${item.measured_temperature}°C`,
              detail: item.resolved_at ? `Resolved ${formatDateTime(item.resolved_at)}` : 'Aktif',
            }))} empty="Tidak ada excursion suhu" />
          </section>
          <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><Send className="h-4 w-4 text-blue-500" /> Dispatch</h2>
            <TimelineRows rows={(lot.dispatches || []).map((item: any) => ({
              label: `${item.movement_type || 'bulk'} - ${item.customer_name}`,
              value: `${item.quantity || '-'} ${item.unit || ''}`,
              detail: `${item.destination} - ${item.status}`,
            }))} empty="Belum ada dispatch" />
          </section>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Audit Timeline</h2>
          <TimelineRows rows={(lot.audit_logs || []).map((item: any) => ({
            label: item.action,
            value: item.table_name,
            detail: formatDateTime(item.timestamp),
          }))} empty="Audit detail tersedia untuk admin" />
        </section>
      </div>
    </DashboardLayout>
  );
}

function PassportCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><Icon className="h-4 w-4 text-orange-500" /> {title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function TimelineRows({ rows, empty }: { rows: Array<{ label: string; value: string; detail: string }>; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">{empty}</p>;
  return <div className="space-y-2">{rows.map((row, index) => (
    <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/50">
      <div><p className="font-medium text-gray-800 dark:text-gray-200">{row.label}</p><p className="text-xs text-gray-500">{row.detail}</p></div>
      <span className="text-xs font-semibold uppercase text-orange-500">{row.value}</span>
    </div>
  ))}</div>;
}
