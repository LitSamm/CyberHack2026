const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// Auto-generate lot number: SA-YYYYMMDD-XXX
async function generateLotNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `SA-${dateStr}-`;
  const { data } = await supabase
    .from('lots')
    .select('lot_number')
    .like('lot_number', `${prefix}%`)
    .order('lot_number', { ascending: false })
    .limit(1);
  const lastSeq = data && data.length > 0
    ? parseInt(data[0].lot_number.split('-')[2]) : 0;
  const seq = String(lastSeq + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

// GET /api/lots
router.get('/', authenticate, async (req, res) => {
  const { status, date } = req.query;
  let query = supabase
    .from('lots')
    .select('*, incoming_materials(material_name, quantity, unit), users!created_by(name)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (date) query = query.eq('production_date', date);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/lots/:id
router.get('/:id', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('lots')
    .select(`
      *,
      incoming_materials(*, suppliers(name)),
      qc_checks(*, users!checked_by(name)),
      ppic_schedules(*),
      warehouse_slots(*),
      dispatches(*)
    `)
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Lot not found' });
  res.json(data);
});

// POST /api/lots
router.post('/', authenticate, requireRole('admin', 'ppic'), auditLog('lots', 'INSERT'), async (req, res) => {
  const { material_id, production_date, notes } = req.body;
  const lot_number = await generateLotNumber();
  const { data, error } = await supabase
    .from('lots')
    .insert({
      lot_number,
      material_id,
      production_date: production_date || new Date().toISOString(),
      status: 'queued',
      created_by: req.user.id,
      notes,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/lots/:id
router.put('/:id', authenticate, auditLog('lots', 'UPDATE'), async (req, res) => {
  const { status, notes, production_date } = req.body;
  const { data: old } = await supabase.from('lots').select('*').eq('id', req.params.id).single();
  req.auditData = { oldValue: old };
  const { data, error } = await supabase
    .from('lots')
    .update({ status, notes, production_date })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
