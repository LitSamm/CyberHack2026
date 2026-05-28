const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/warehouse/slots
router.get('/slots', authenticate, async (req, res) => {
  const { zone, is_occupied, temperature_zone } = req.query;
  let query = supabase
    .from('warehouse_slots')
    .select('*, lots!current_lot_id(lot_number, status)')
    .order('slot_code');
  if (zone) query = query.eq('zone', zone);
  if (is_occupied !== undefined) query = query.eq('is_occupied', is_occupied === 'true');
  if (temperature_zone) query = query.eq('temperature_zone', temperature_zone);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/warehouse/slots/:id — assign or release a lot
router.put('/slots/:id', authenticate, requireRole('admin', 'warehouse'), auditLog('warehouse_slots', 'UPDATE'), async (req, res) => {
  const { current_lot_id, hazard_type } = req.body;
  const { data: old } = await supabase.from('warehouse_slots').select('*').eq('id', req.params.id).single();
  req.auditData = { oldValue: old };

  const is_occupied = current_lot_id !== null && current_lot_id !== undefined;
  const { data, error } = await supabase
    .from('warehouse_slots')
    .update({ current_lot_id: current_lot_id || null, is_occupied, hazard_type })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // If releasing a slot, clear the previous lot's slot reference if needed
  if (!is_occupied && old.current_lot_id) {
    // Just log the release
  }

  res.json(data);
});

// GET /api/warehouse/stats
router.get('/stats', authenticate, async (req, res) => {
  const { data, error } = await supabase.from('warehouse_slots').select('is_occupied, temperature_zone');
  if (error) return res.status(500).json({ error: error.message });
  const total = data.length;
  const occupied = data.filter(s => s.is_occupied).length;
  const byZone = data.reduce((acc, s) => {
    acc[s.temperature_zone] = acc[s.temperature_zone] || { total: 0, occupied: 0 };
    acc[s.temperature_zone].total++;
    if (s.is_occupied) acc[s.temperature_zone].occupied++;
    return acc;
  }, {});
  res.json({ total, occupied, available: total - occupied, occupancy_pct: Math.round((occupied / total) * 100), byZone });
});

module.exports = router;
