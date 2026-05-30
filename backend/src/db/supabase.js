const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  "https://wcopdglthdslvkcrvvzr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjb3BkZ2x0aGRzbHZrY3J2dnpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA0NjU3MywiZXhwIjoyMDk1NjIyNTczfQ.HlHMcpoU3ZPbJd4WeiC_hDSgVki74fY2DFiDyKozBJg",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = supabase;
