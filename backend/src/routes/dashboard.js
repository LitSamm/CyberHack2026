const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard/stats
router.get('/stats', authenticate, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const [lotsToday, qcChecks, pendingSchedules, warehouseSlots, pendingQC] = await Promise.all([
    supabase.from('lots').select('id', { count: 'exact' }).gte('created_at', today),
    supabase.from('qc_checks').select('result').gte('checked_at', today),
    supabase.from('ppic_schedules').select('id', { count: 'exact' }).in('status', ['queued', 'in_production']),
    supabase.from('warehouse_slots').select('is_occupied'),
    supabase.from('incoming_materials').select('id', { count: 'exact' }).eq('qc_status', 'pending'),
  ]);

  const totalLotsToday = lotsToday.count || 0;
  const checks = qcChecks.data || [];
  const passRate = checks.length > 0
    ? Math.round((checks.filter(c => c.result === 'pass').length / checks.length) * 100)
    : 0;
  const slots = warehouseSlots.data || [];
  const occupancyPct = slots.length > 0
    ? Math.round((slots.filter(s => s.is_occupied).length / slots.length) * 100)
    : 0;

  res.json({
    lots_today: totalLotsToday,
    qc_pass_rate: passRate,
    pending_schedules: pendingSchedules.count || 0,
    warehouse_occupancy: occupancyPct,
    pending_qc_count: pendingQC.count || 0,
  });
});

// GET /api/dashboard/recent-activity
router.get('/recent-activity', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, users!user_id(name, role)')
    .order('timestamp', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/dashboard/notifications
router.get('/notifications', authenticate, async (req, res) => {
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [pendingQC, overdueSchedules] = await Promise.all([
    supabase
      .from('incoming_materials')
      .select('id, material_name, received_date')
      .eq('qc_status', 'pending')
      .lt('received_date', cutoff24h),
    supabase
      .from('ppic_schedules')
      .select('id, lots(lot_number), scheduled_date, priority')
      .in('status', ['queued', 'in_production'])
      .lt('scheduled_date', new Date().toISOString().slice(0, 10)),
  ]);

  const notifications = [
    ...(pendingQC.data || []).map(m => ({
      type: 'warning',
      message: `Material "${m.material_name}" pending QC > 24 jam`,
      id: m.id,
      table: 'incoming_materials',
    })),
    ...(overdueSchedules.data || []).map(s => ({
      type: 'error',
      message: `Lot ${s.lots?.lot_number} overdue — jadwal ${s.scheduled_date}`,
      id: s.id,
      table: 'ppic_schedules',
    })),
  ];

  res.json({ count: notifications.length, notifications });
});

module.exports = router;
