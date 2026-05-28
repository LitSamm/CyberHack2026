const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/dispatch
router.get('/', authenticate, async (req, res) => {
  const { status, lot_id } = req.query;
  let query = supabase
    .from('dispatches')
    .select('*, lots(lot_number, status), users!dispatched_by(name)')
    .order('dispatch_date', { ascending: false });
  if (status) query = query.eq('status', status);
  if (lot_id) query = query.eq('lot_id', lot_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/dispatch
router.post('/', authenticate, requireRole('admin', 'warehouse', 'ppic'), auditLog('dispatches', 'INSERT'), async (req, res) => {
  const { lot_id, customer_name, destination, dispatch_date, notes } = req.body;
  if (!lot_id || !customer_name || !destination) {
    return res.status(400).json({ error: 'lot_id, customer_name, destination are required' });
  }

  const { data, error } = await supabase
    .from('dispatches')
    .insert({
      lot_id, customer_name, destination,
      dispatch_date: dispatch_date || new Date().toISOString(),
      dispatched_by: req.user.id,
      status: 'prepared',
      notes,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Update lot status to dispatched
  await supabase.from('lots').update({ status: 'dispatched' }).eq('id', lot_id);

  // Release warehouse slot if any
  await supabase
    .from('warehouse_slots')
    .update({ current_lot_id: null, is_occupied: false })
    .eq('current_lot_id', lot_id);

  res.status(201).json(data);
});

// PUT /api/dispatch/:id — update dispatch status
router.put('/:id', authenticate, auditLog('dispatches', 'UPDATE'), async (req, res) => {
  const { status, notes } = req.body;
  const validStatuses = ['prepared', 'shipped', 'delivered'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }
  const { data, error } = await supabase
    .from('dispatches')
    .update({ status, notes })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
