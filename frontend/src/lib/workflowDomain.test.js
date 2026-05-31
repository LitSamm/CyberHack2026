/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildOperationsPipeline,
  getSevenDayProductionQcChart,
  getLotStatusAfterWarehouseRelease,
  getDispatchEffects,
} = require('./workflowDomain.js');

test('buildOperationsPipeline counts end-to-end operational stages', () => {
  const materials = [
    { id: 'm1', qc_status: 'pending' },
    { id: 'm2', qc_status: 'approved' },
    { id: 'm3', qc_status: 'approved' },
    { id: 'm4', qc_status: 'rejected' },
  ];
  const lots = [
    { id: 'l1', material_id: 'm2', status: 'queued' },
    { id: 'l2', material_id: 'm5', status: 'in_production' },
    { id: 'l3', material_id: 'm5', status: 'completed' },
    { id: 'l4', material_id: 'm6', status: 'dispatched' },
  ];
  const slots = [{ current_lot_id: 'l3', is_occupied: true }];
  const dispatches = [{ lot_id: 'l4', status: 'shipped' }];

  assert.deepEqual(buildOperationsPipeline({ materials, lots, slots, dispatches }), [
    { id: 'pending_qc', label: 'Pending QC', count: 1, tone: 'yellow' },
    { id: 'awaiting_schedule', label: 'Approved, Belum Dijadwalkan', count: 1, tone: 'green' },
    { id: 'queued', label: 'Antri Produksi', count: 1, tone: 'slate' },
    { id: 'in_production', label: 'Sedang Produksi', count: 1, tone: 'blue' },
    { id: 'awaiting_finished_qc', label: 'Menunggu QC Produk Jadi', count: 0, tone: 'yellow' },
    { id: 'completed_unstored', label: 'Selesai, Belum Masuk Gudang', count: 0, tone: 'orange' },
    { id: 'stored', label: 'Tersimpan di Gudang', count: 1, tone: 'purple' },
    { id: 'dispatching', label: 'Proses Pengiriman', count: 1, tone: 'cyan' },
  ]);
});

test('buildOperationsPipeline exposes finished-product QC as its own release gate', () => {
  const lots = [
    { id: 'l1', material_id: 'm1', status: 'awaiting_finished_qc' },
    { id: 'l2', material_id: 'm2', status: 'completed' },
  ];

  const pipeline = buildOperationsPipeline({ lots });

  assert.equal(pipeline.find(stage => stage.id === 'awaiting_finished_qc').count, 1);
  assert.equal(pipeline.find(stage => stage.id === 'completed_unstored').count, 1);
});

test('getSevenDayProductionQcChart derives rolling daily counts from real records', () => {
  const now = new Date('2026-05-30T10:00:00.000Z');
  const lots = [
    { created_at: '2026-05-30T01:00:00.000Z' },
    { created_at: '2026-05-30T08:00:00.000Z' },
    { created_at: '2026-05-28T08:00:00.000Z' },
  ];
  const qcChecks = [
    { checked_at: '2026-05-30T02:00:00.000Z' },
    { checked_at: '2026-05-29T02:00:00.000Z' },
  ];

  const chart = getSevenDayProductionQcChart({ lots, qcChecks, now });

  assert.equal(chart.length, 7);
  assert.deepEqual(chart.slice(-3), [
    { date: '2026-05-28', name: 'Kam', lots: 1, qc: 0 },
    { date: '2026-05-29', name: 'Jum', lots: 0, qc: 1 },
    { date: '2026-05-30', name: 'Sab', lots: 2, qc: 1 },
  ]);
});

test('warehouse release keeps lot completed instead of marking it dispatched', () => {
  assert.equal(getLotStatusAfterWarehouseRelease('completed'), 'completed');
  assert.equal(getLotStatusAfterWarehouseRelease('in_production'), 'in_production');
});

test('sample dispatch does not release a lot while shipped bulk dispatch does', () => {
  assert.deepEqual(getDispatchEffects('sample', 'prepared'), {
    releaseSlot: false,
    lotStatus: null,
  });
  assert.deepEqual(getDispatchEffects('sample', 'shipped'), {
    releaseSlot: false,
    lotStatus: null,
  });
  assert.deepEqual(getDispatchEffects('bulk', 'prepared'), {
    releaseSlot: false,
    lotStatus: null,
  });
  assert.deepEqual(getDispatchEffects('bulk', 'shipped'), {
    releaseSlot: true,
    lotStatus: 'dispatched',
  });
});
