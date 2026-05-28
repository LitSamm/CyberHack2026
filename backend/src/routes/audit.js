const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/audit-logs
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const { user_id, table_name, action, from, to, limit = 100, offset = 0 } = req.query;
  let query = supabase
    .from('audit_logs')
    .select('*, users!user_id(name, email, role)', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (user_id) query = query.eq('user_id', user_id);
  if (table_name) query = query.eq('table_name', table_name);
  if (action) query = query.eq('action', action);
  if (from) query = query.gte('timestamp', from);
  if (to) query = query.lte('timestamp', to);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, total: count, offset: parseInt(offset), limit: parseInt(limit) });
});

// GET /api/audit-logs/export?format=csv
router.get('/export', authenticate, requireRole('admin'), async (req, res) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('timestamp, users!user_id(name, email), action, table_name, record_id, old_value, new_value')
    .order('timestamp', { ascending: false })
    .limit(5000);
  if (error) return res.status(500).json({ error: error.message });

  const csv = [
    'Timestamp,User,Email,Action,Table,Record ID,Old Value,New Value',
    ...data.map(row => [
      row.timestamp,
      row.users?.name || '',
      row.users?.email || '',
      row.action,
      row.table_name,
      row.record_id || '',
      JSON.stringify(row.old_value || ''),
      JSON.stringify(row.new_value || ''),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(csv);
});

module.exports = router;
