import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { createClient } from '@/lib/supabase';

// Helper to log export actions
async function logExport(action: string, rowCount: number) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    
    await sb.from('audit_logs').insert({
      user_id: user.id,
      action: action,
      table_name: 'exports',
      record_id: 'export',
      details: { rowCount, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Failed to log export:', error);
  }
}

// ── 1. QC Report (PDF) ───────────────────────────────────
export async function exportQCReport(dateFrom?: string, dateTo?: string) {
  const sb = createClient();
  let query = sb.from('qc_checks').select('*, lots(lot_number), users!checked_by(name)').order('checked_at', { ascending: false });
  if (dateFrom) query = query.gte('checked_at', dateFrom);
  if (dateTo) query = query.lte('checked_at', dateTo + 'T23:59:59');
  
  const { data, error } = await query;
  if (error) throw error;
  
  const records = data || [];
  
  // Calculate summary
  const total = records.length;
  const passed = records.filter(r => r.result === 'pass').length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
  
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(249, 115, 22); // Orange-500
  doc.text('AromOS', 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('PT Sima Arome - QC Dashboard Report', 14, 30);
  doc.text(`Generated: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeId })}`, 14, 36);

  // Summary Table
  (doc as any).autoTable({
    startY: 45,
    head: [['Total Pengecekan', 'Lulus QC', 'Tingkat Kelulusan (Pass Rate)']],
    body: [[total.toString(), passed.toString(), `${passRate}%`]],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    styles: { halign: 'center' }
  });

  // Details Table
  const tableBody = records.map(r => [
    r.lots?.lot_number || '-',
    r.users?.name || '-',
    r.color_grade,
    r.consistency_grade,
    r.result === 'pass' ? 'LULUS' : 'GAGAL',
    format(new Date(r.checked_at), 'dd/MM/yyyy HH:mm')
  ]);

  (doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['Lot', 'Checker', 'Color Grade', 'Consistency', 'Hasil', 'Waktu']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [249, 115, 22] }, // orange
    alternateRowStyles: { fillColor: [241, 245, 249] }
  });

  // Footer (page numbers)
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  doc.save(`QC-Report-${format(new Date(), 'yyyyMMdd')}.pdf`);
  await logExport('Export QC Report PDF', total);
  return total;
}

// ── 2. Lot History (CSV/PDF) ─────────────────────────────
export async function exportLotHistory(formatType: 'pdf' | 'csv') {
  const sb = createClient();
  const { data, error } = await sb.from('lots')
    .select('*, incoming_materials(material_name), users!created_by(name)')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  const records = data || [];

  if (formatType === 'csv') {
    const csvData = records.map(r => ({
      'Lot Number': r.lot_number,
      'Material': r.incoming_materials?.material_name || '-',
      'Created By': r.users?.name || '-',
      'Status': r.status,
      'Created At': format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')
    }));
    
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Lot-History-${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // PDF
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(249, 115, 22);
    doc.text('AromOS - Lot History Report', 14, 22);
    
    (doc as any).autoTable({
      startY: 35,
      head: [['Lot Number', 'Material', 'Status', 'Dibuat Oleh', 'Tanggal']],
      body: records.map(r => [
        r.lot_number, 
        r.incoming_materials?.material_name || '-', 
        r.status, 
        r.users?.name || '-', 
        format(new Date(r.created_at), 'dd/MM/yyyy')
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] } // blue
    });
    doc.save(`Lot-History-${format(new Date(), 'yyyyMMdd')}.pdf`);
  }

  await logExport(`Export Lot History ${formatType.toUpperCase()}`, records.length);
  return records.length;
}

// ── 3. Dispatch Record (CSV) ─────────────────────────────
export async function exportDispatchRecord() {
  const sb = createClient();
  const { data, error } = await sb.from('dispatches')
    .select('*, lots(lot_number), users!dispatched_by(name)')
    .order('dispatch_date', { ascending: false });
    
  if (error) throw error;
  const records = data || [];

  const csvData = records.map(r => ({
    'ID Pengiriman': r.id,
    'Lot Number': r.lots?.lot_number || '-',
    'Customer': r.customer_name,
    'Tujuan': r.destination,
    'Status': r.status,
    'Tanggal Pengiriman': format(new Date(r.dispatch_date), 'dd/MM/yyyy HH:mm'),
    'Dicatat Oleh': r.users?.name || '-'
  }));
  
  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Dispatch-Record-${format(new Date(), 'yyyyMMdd')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  await logExport('Export Dispatch CSV', records.length);
  return records.length;
}

// ── 4. Warehouse Snapshot (PDF) ──────────────────────────
export async function exportWarehouseSnapshot() {
  const sb = createClient();
  const { data, error } = await sb.from('warehouse_slots')
    .select('*, lots!current_lot_id(lot_number)')
    .order('zone_row', { ascending: true })
    .order('zone_col', { ascending: true });
    
  if (error) throw error;
  const records = data || [];

  const total = records.length;
  const occupied = records.filter(s => s.is_occupied).length;
  const frozen = records.filter(s => s.temperature_zone === 'cold_minus20').length;
  const chill = records.filter(s => s.temperature_zone === 'cold_minus4').length;
  const normal = records.filter(s => s.temperature_zone === 'normal').length;

  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.setTextColor(249, 115, 22);
  doc.text('AromOS - Warehouse Snapshot', 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Kapasitas Gudang Terisi: ${occupied} / ${total} Slot (${Math.round((occupied/total)*100)}%)`, 14, 30);
  
  (doc as any).autoTable({
    startY: 40,
    head: [['Slot', 'Row/Col', 'Zone Suhu', 'Status', 'Lot']],
    body: records.map(r => [
      r.slot_code,
      `${r.zone_row}-${r.zone_col}`,
      r.temperature_zone,
      r.is_occupied ? 'TERISI' : 'KOSONG',
      r.lots?.lot_number || '-'
    ]),
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] }
  });

  doc.save(`Warehouse-Snapshot-${format(new Date(), 'yyyyMMdd')}.pdf`);
  await logExport('Export Warehouse PDF', records.length);
  return records.length;
}
