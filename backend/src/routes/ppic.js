const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/ppic/schedules
router.get('/schedules', authenticate, async (req, res) => {
  const { status, priority, date } = req.query;
  let query = supabase
    .from('ppic_schedules')
    .select('*, lots(lot_number, status, incoming_materials(material_name)), users!assigned_to(name)')
    .order('scheduled_date', { ascending: true });
  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (date) query = query.eq('scheduled_date', date);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/ppic/schedules
router.post('/schedules', authenticate, requireRole('admin', 'ppic'), auditLog('ppic_schedules', 'INSERT'), async (req, res) => {
  const { lot_id, scheduled_date, priority, assigned_to, notes } = req.body;
  const { data, error } = await supabase
    .from('ppic_schedules')
    .insert({
      lot_id, scheduled_date,
      priority: priority || 'normal',
      status: 'queued',
      assigned_to: assigned_to || req.user.id,
      notes,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/ppic/schedules/:id — update status (drag on kanban)
router.put('/schedules/:id', authenticate, requireRole('admin', 'ppic'), auditLog('ppic_schedules', 'UPDATE'), async (req, res) => {
  const { status, priority, scheduled_date, notes, assigned_to } = req.body;
  const { data: old } = await supabase.from('ppic_schedules').select('*').eq('id', req.params.id).single();
  req.auditData = { oldValue: old };

  // Sync lot status with schedule status
  if (status && old?.lot_id) {
    const lotStatusMap = {
      queued: 'queued',
      in_production: 'in_production',
      completed: 'completed',
      dispatched: 'dispatched',
    };
    if (lotStatusMap[status]) {
      await supabase.from('lots').update({ status: lotStatusMap[status] }).eq('id', old.lot_id);
    }
  }

  const { data, error } = await supabase
    .from('ppic_schedules')
    .update({ status, priority, scheduled_date, notes, assigned_to })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/ppic/schedules/:id
router.delete('/schedules/:id', authenticate, requireRole('admin', 'ppic'), auditLog('ppic_schedules', 'DELETE'), async (req, res) => {
  const { error } = await supabase.from('ppic_schedules').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Schedule deleted' });
});

module.exports = router;
