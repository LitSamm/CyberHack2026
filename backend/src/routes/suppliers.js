const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/suppliers
router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/suppliers
router.post('/', authenticate, requireRole('admin', 'ppic'), auditLog('suppliers', 'INSERT'), async (req, res) => {
  const { name, contact, material_type, address } = req.body;
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ name, contact, material_type, address })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/suppliers/:id
router.put('/:id', authenticate, requireRole('admin', 'ppic'), auditLog('suppliers', 'UPDATE'), async (req, res) => {
  const { name, contact, material_type, address } = req.body;
  const { data: old } = await supabase.from('suppliers').select('*').eq('id', req.params.id).single();
  req.auditData = { oldValue: old };
  const { data, error } = await supabase
    .from('suppliers')
    .update({ name, contact, material_type, address })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
