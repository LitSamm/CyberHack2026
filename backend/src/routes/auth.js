const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  // Fetch role from users table
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, email, role, is_active')
    .eq('id', data.user.id)
    .single();

  if (!profile?.is_active) {
    return res.status(403).json({ error: 'Account is deactivated' });
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: profile,
  });
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) await supabase.auth.admin.signOut(token);
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error) return res.status(401).json({ error: error.message });

  res.json({ access_token: data.session.access_token });
});

module.exports = router;
