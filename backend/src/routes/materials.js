const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/materials
router.get('/', authenticate, async (req, res) => {
  const { status, supplier_id } = req.query;
  let query = supabase
    .from('incoming_materials')
    .select('*, suppliers(name, material_type)')
    .order('received_date', { ascending: false });
  if (status) query = query.eq('qc_status', status);
  if (supplier_id) query = query.eq('supplier_id', supplier_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/materials/:id
router.get('/:id', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('incoming_materials')
    .select('*, suppliers(*)')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Material not found' });
  res.json(data);
});

// POST /api/materials
router.post('/', authenticate, requireRole('admin', 'ppic', 'warehouse'), auditLog('incoming_materials', 'INSERT'), async (req, res) => {
  const { supplier_id, material_name, quantity, unit, received_date, notes } = req.body;
  const { data, error } = await supabase
    .from('incoming_materials')
    .insert({
      supplier_id, material_name, quantity, unit,
      received_date: received_date || new Date().toISOString(),
      received_by: req.user.id,
      qc_status: 'pending',
      notes,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/materials/:id
router.put('/:id', authenticate, auditLog('incoming_materials', 'UPDATE'), async (req, res) => {
  const { qc_status, notes, quantity } = req.body;
  const { data: old } = await supabase.from('incoming_materials').select('*').eq('id', req.params.id).single();
  req.auditData = { oldValue: old };
  const { data, error } = await supabase
    .from('incoming_materials')
    .update({ qc_status, notes, quantity })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
