'use client';

import { useState } from 'react';

import { CloseIcon, DownloadIcon, DocsIcon, FileIcon, TimeIcon } from '@/icons';

import { cn } from '@/lib/utils';
import { exportQCReport, exportLotHistory, exportDispatchRecord, exportWarehouseSnapshot } from '@/lib/exportUtils';
import toast from 'react-hot-toast';

export type ReportType = 'qc' | 'lot_history' | 'dispatch' | 'warehouse';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  title: string;
}

export default function ExportModal({ isOpen, onClose, reportType, title }: ExportModalProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [loading, setLoading] = useState(false);

  // Disable format toggle if the report type has a fixed format
  const fixedFormat = reportType === 'qc' || reportType === 'warehouse' ? 'pdf' 
                    : reportType === 'dispatch' ? 'csv' 
                    : null;
                    
  const activeFormat = fixedFormat || format;

  const handleExport = async () => {
    setLoading(true);
    const toastId = toast.loading('Sedang menggenerate laporan...');
    
    try {
      let rowCount = 0;
      
      switch (reportType) {
        case 'qc':
          rowCount = await exportQCReport(dateFrom || undefined, dateTo || undefined);
          break;
        case 'lot_history':
          rowCount = await exportLotHistory(activeFormat);
          break;
        case 'dispatch':
          rowCount = await exportDispatchRecord();
          break;
        case 'warehouse':
          rowCount = await exportWarehouseSnapshot();
          break;
      }
      
      toast.success(`Berhasil! ${rowCount} baris diekspor.`, { id: toastId });
      onClose();
    } catch (err: any) {
      toast.error(`Gagal export: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-100 dark:bg-gray-800/50">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 flex items-center gap-2">
            <DownloadIcon />
            {title}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-white/90 transition-colors">
            <CloseIcon />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Format Selector */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Format Laporan</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                disabled={fixedFormat === 'csv' || loading}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors",
                  activeFormat === 'pdf' 
                    ? "bg-red-500/10 border-red-500/50 text-red-500" 
                    : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                  fixedFormat === 'csv' && "opacity-50 cursor-not-allowed"
                )}
              >
                <DocsIcon /> PDF
              </button>
              <button
                onClick={() => setFormat('csv')}
                disabled={fixedFormat === 'pdf' || loading}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors",
                  activeFormat === 'csv' 
                    ? "bg-green-500/10 border-green-500/50 text-green-500" 
                    : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                  fixedFormat === 'pdf' && "opacity-50 cursor-not-allowed"
                )}
              >
                <FileIcon /> CSV (Excel)
              </button>
            </div>
            {fixedFormat && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                * Laporan ini hanya mendukung format {fixedFormat.toUpperCase()}
              </p>
            )}
          </div>

          {/* Date Range Filter (only for QC for now, others fetch all by default) */}
          {reportType === 'qc' && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Rentang Waktu Pengecekan</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Dari Tanggal</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-white/90 rounded-lg p-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Sampai Tanggal</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-white/90 rounded-lg p-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/30 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-800 dark:text-white/90 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <TimeIcon /> : <DownloadIcon />}
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
