const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/users
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/users — create user (also creates Supabase Auth entry)
router.post('/', authenticate, requireRole('admin'), auditLog('users', 'INSERT'), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, role are required' });
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) return res.status(400).json({ error: authError.message });

  // Create user profile
  const { data, error } = await supabase
    .from('users')
    .insert({ id: authData.user.id, name, email, role, is_active: true })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json(data);
});

// PUT /api/users/:id
router.put('/:id', authenticate, requireRole('admin'), auditLog('users', 'UPDATE'), async (req, res) => {
  const { name, role, is_active } = req.body;

  // Capture old value for audit
  const { data: old } = await supabase.from('users').select('*').eq('id', req.params.id).single();
  req.auditData = { oldValue: old };

  const { data, error } = await supabase
    .from('users')
    .update({ name, role, is_active })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/users/:id — deactivate (soft delete)
router.delete('/:id', authenticate, requireRole('admin'), auditLog('users', 'DELETE'), async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'User deactivated', user: data });
});

// DELETE /api/users/:id/hard — permanent delete
router.delete('/:id/hard', authenticate, requireRole('admin'), auditLog('users', 'DELETE'), async (req, res) => {
  const { error: dbError } = await supabase
    .from('users')
    .delete()
    .eq('id', req.params.id);
  if (dbError) return res.status(500).json({ error: dbError.message });

  const { error: authError } = await supabase.auth.admin.deleteUser(req.params.id);
  if (authError) return res.status(500).json({ error: authError.message });

  res.json({ message: 'User permanently deleted' });
});

module.exports = router;
