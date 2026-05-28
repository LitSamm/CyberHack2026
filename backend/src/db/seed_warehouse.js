require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function seedWarehouse() {
  console.log('🏭 Starting Warehouse 10x8 Floor Map Seed...');
  try {
    // 1. Get 15 random lots that are ready for warehouse (completed QC)
    const { data: lots, error: lotsErr } = await supabase
      .from('lots')
      .select('id, lot_number')
      .eq('status', 'in_production') // Or 'completed' depending on the flow, 'in_production' usually goes to warehouse
      .limit(15);
      
    if (lotsErr) throw lotsErr;
    console.log(`✅ Found ${lots.length} lots for assignment.`);

    let lotIndex = 0;
    const slotsToInsert = [];

    // 2. Generate 80 slots (Rows A-J, Cols 1-8)
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const cols = [1, 2, 3, 4, 5, 6, 7, 8];

    for (const r of rows) {
      for (const c of cols) {
        const slotCode = `${r}${c}`;
        let tempZone = 'normal';
        let hazard = 'none';

        // Temperature zones based on rows
        if (['G', 'H'].includes(r)) tempZone = 'cold_minus4';
        if (['I', 'J'].includes(r)) tempZone = 'cold_minus20';

        // Hazards
        if (['B3', 'B4', 'C3', 'C4'].includes(slotCode)) hazard = 'ibc';

        // Assign lot if available
        let assignedLotId = null;
        let isOccupied = false;
        
        // Randomly decide if we put a lot here (only 15 total)
        if (lotIndex < lots.length && Math.random() > 0.7) {
          assignedLotId = lots[lotIndex].id;
          isOccupied = true;
          lotIndex++;
        }

        slotsToInsert.push({
          slot_code: slotCode,
          zone_row: r,
          zone_col: c,
          temperature_zone: tempZone,
          hazard_type: hazard,
          is_occupied: isOccupied,
          current_lot_id: assignedLotId,
          last_updated: new Date().toISOString()
        });
      }
    }
    
    // Assign any remaining lots
    while (lotIndex < lots.length) {
      const emptySlot = slotsToInsert.find(s => !s.is_occupied);
      if (emptySlot) {
        emptySlot.is_occupied = true;
        emptySlot.current_lot_id = lots[lotIndex].id;
      }
      lotIndex++;
    }

    // 3. Insert into Supabase
    const { error: insertErr } = await supabase
      .from('warehouse_slots')
      .insert(slotsToInsert);

    if (insertErr) throw insertErr;
    console.log(`✅ Successfully inserted ${slotsToInsert.length} slots into warehouse_slots.`);
    console.log('✨ Seed complete!');
    
  } catch (err) {
    console.error('❌ Error during seeding:', err.message || err);
  }
}

seedWarehouse();
