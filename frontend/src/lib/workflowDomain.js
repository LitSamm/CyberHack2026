const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function toDateKey(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildOperationsPipeline({ materials = [], lots = [], slots = [], dispatches = [] }) {
  const scheduledMaterialIds = new Set(lots.map((lot) => lot.material_id).filter(Boolean));
  const storedLotIds = new Set(
    slots
      .filter((slot) => slot.is_occupied && slot.current_lot_id)
      .map((slot) => slot.current_lot_id)
  );
  const activeDispatchLotIds = new Set(
    dispatches
      .filter((dispatch) => dispatch.status !== 'delivered' && dispatch.lot_id)
      .map((dispatch) => dispatch.lot_id)
  );

  const pendingQc = materials.filter((material) => material.qc_status === 'pending').length;
  const awaitingSchedule = materials.filter(
    (material) => material.qc_status === 'approved' && !scheduledMaterialIds.has(material.id)
  ).length;
  const queued = lots.filter((lot) => lot.status === 'queued').length;
  const inProduction = lots.filter((lot) => lot.status === 'in_production').length;
  const awaitingFinishedQc = lots.filter((lot) => lot.status === 'awaiting_finished_qc').length;
  const completedUnstored = lots.filter(
    (lot) => lot.status === 'completed' && !storedLotIds.has(lot.id) && !activeDispatchLotIds.has(lot.id)
  ).length;
  const stored = lots.filter((lot) => lot.status === 'completed' && storedLotIds.has(lot.id)).length;
  const dispatching = dispatches.filter((dispatch) => dispatch.status !== 'delivered').length;

  return [
    { id: 'pending_qc', label: 'Pending QC', count: pendingQc, tone: 'yellow' },
    { id: 'awaiting_schedule', label: 'Approved, Belum Dijadwalkan', count: awaitingSchedule, tone: 'green' },
    { id: 'queued', label: 'Antri Produksi', count: queued, tone: 'slate' },
    { id: 'in_production', label: 'Sedang Produksi', count: inProduction, tone: 'blue' },
    { id: 'awaiting_finished_qc', label: 'Menunggu QC Produk Jadi', count: awaitingFinishedQc, tone: 'yellow' },
    { id: 'completed_unstored', label: 'Selesai, Belum Masuk Gudang', count: completedUnstored, tone: 'orange' },
    { id: 'stored', label: 'Tersimpan di Gudang', count: stored, tone: 'purple' },
    { id: 'dispatching', label: 'Proses Pengiriman', count: dispatching, tone: 'cyan' },
  ];
}

function getSevenDayProductionQcChart({ lots = [], qcChecks = [], now = new Date() }) {
  const start = addDays(now, -6);
  const buckets = new Map();

  for (let offset = 0; offset < 7; offset += 1) {
    const day = addDays(start, offset);
    const date = day.toISOString().slice(0, 10);
    buckets.set(date, {
      date,
      name: DAY_LABELS[day.getUTCDay()],
      lots: 0,
      qc: 0,
    });
  }

  for (const lot of lots) {
    const key = toDateKey(lot.created_at);
    if (buckets.has(key)) buckets.get(key).lots += 1;
  }

  for (const check of qcChecks) {
    const key = toDateKey(check.checked_at);
    if (buckets.has(key)) buckets.get(key).qc += 1;
  }

  return Array.from(buckets.values());
}

function getLotStatusAfterWarehouseRelease(currentStatus) {
  return currentStatus;
}

function getDispatchEffects(movementType, status) {
  if (movementType === 'bulk' && status === 'shipped') {
    return { releaseSlot: true, lotStatus: 'dispatched' };
  }
  return { releaseSlot: false, lotStatus: null };
}

module.exports = {
  buildOperationsPipeline,
  getSevenDayProductionQcChart,
  getLotStatusAfterWarehouseRelease,
  getDispatchEffects,
};
