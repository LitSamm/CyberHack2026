const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticate } = require('../middleware/auth');

// GET /api/search?q=keyword
router.get('/', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  const term = q.trim();
  const [lots, materials, dispatches] = await Promise.all([
    supabase
      .from('lots')
      .select('id, lot_number, status, production_date')
      .ilike('lot_number', `%${term}%`)
      .limit(5),
    supabase
      .from('incoming_materials')
      .select('id, material_name, qc_status, received_date')
      .ilike('material_name', `%${term}%`)
      .limit(5),
    supabase
      .from('dispatches')
      .select('id, customer_name, destination, status, dispatch_date')
      .or(`customer_name.ilike.%${term}%,destination.ilike.%${term}%`)
      .limit(5),
  ]);

  res.json({
    lots: lots.data || [],
    materials: materials.data || [],
    dispatches: dispatches.data || [],
    total: (lots.data?.length || 0) + (materials.data?.length || 0) + (dispatches.data?.length || 0),
  });
});

module.exports = router;
