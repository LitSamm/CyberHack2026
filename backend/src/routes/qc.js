const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/qc — list all QC checks
router.get('/', authenticate, async (req, res) => {
  const { lot_id, result, date } = req.query;
  let query = supabase
    .from('qc_checks')
    .select('*, lots(lot_number, status), users!checked_by(name)')
    .order('checked_at', { ascending: false });
  if (lot_id) query = query.eq('lot_id', lot_id);
  if (result) query = query.eq('result', result);
  if (date) query = query.gte('checked_at', date).lt('checked_at', date + 'T23:59:59');
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/qc — submit QC check
router.post('/', authenticate, requireRole('admin', 'qc'), auditLog('qc_checks', 'INSERT'), async (req, res) => {
  const { lot_id, material_id, color_grade, consistency_grade, contamination_flag, result, notes } = req.body;
  if ((!lot_id && !material_id) || (lot_id && material_id) || !color_grade || !consistency_grade || result === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Create QC check
  const { data: qcData, error: qcError } = await supabase
    .from('qc_checks')
    .insert({
      lot_id: lot_id || null,
      material_id: material_id || null,
      color_grade,
      consistency_grade,
      contamination_flag: contamination_flag || false,
      result, notes,
      checked_by: req.user.id,
      checked_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (qcError) return res.status(500).json({ error: qcError.message });

  if (material_id) {
    await supabase.from('incoming_materials')
      .update({ qc_status: result === 'pass' ? 'approved' : 'rejected' })
      .eq('id', material_id);
  } else {
    // Powder/extract QC is lot-level. It must not auto-start production.
    const newLotStatus = result === 'pass' ? 'completed' : 'rejected';
    await supabase.from('lots').update({ status: newLotStatus }).eq('id', lot_id);
  }

  res.status(201).json(qcData);
});

// PUT /api/qc/:id
router.put('/:id', authenticate, requireRole('admin', 'qc'), auditLog('qc_checks', 'UPDATE'), async (req, res) => {
  const { notes, result } = req.body;
  const { data, error } = await supabase
    .from('qc_checks')
    .update({ notes, result })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/qc/pending-24h — lots pending QC for more than 24 hours
router.get('/alerts/pending-24h', authenticate, async (req, res) => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('incoming_materials')
    .select('*, suppliers(name)')
    .eq('qc_status', 'pending')
    .lt('received_date', cutoff);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
