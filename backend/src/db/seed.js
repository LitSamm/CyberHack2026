const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); // load from root
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const USERS_DATA = [
  // Admins
  { name: 'Budi Santoso', email: 'budi.admin@simaarome.id', role: 'admin', password: 'Admin@123' },
  { name: 'Dewi Rahayu', email: 'dewi.admin@simaarome.id', role: 'admin', password: 'Admin@123' },
  { name: 'Agus Wijaya', email: 'agus.admin@simaarome.id', role: 'admin', password: 'Admin@123' },
  // QC Officers
  { name: 'Siti Maryam', email: 'siti.qc@simaarome.id', role: 'qc', password: 'Qc@12345' },
  { name: 'Hendra Kusuma', email: 'hendra.qc@simaarome.id', role: 'qc', password: 'Qc@12345' },
  { name: 'Rina Wulandari', email: 'rina.qc@simaarome.id', role: 'qc', password: 'Qc@12345' },
  // PPIC
  { name: 'Fajar Nugroho', email: 'fajar.ppic@simaarome.id', role: 'ppic', password: 'Ppic@123' },
  { name: 'Laila Fitriani', email: 'laila.ppic@simaarome.id', role: 'ppic', password: 'Ppic@123' },
  { name: 'Wahyu Prabowo', email: 'wahyu.ppic@simaarome.id', role: 'ppic', password: 'Ppic@123' },
  // Warehouse Operators
  { name: 'Teguh Santoso', email: 'teguh.wh@simaarome.id', role: 'warehouse', password: 'Wh@12345' },
  { name: 'Yanti Kusumawati', email: 'yanti.wh@simaarome.id', role: 'warehouse', password: 'Wh@12345' },
  { name: 'Dedi Permana', email: 'dedi.wh@simaarome.id', role: 'warehouse', password: 'Wh@12345' },
];

const SUPPLIERS_DATA = [
  { name: 'PT Alam Segar Nusantara', contact: '+62-21-5551234', material_type: 'Essential Oil', address: 'Jl. Raya Bogor No. 45, Jakarta' },
  { name: 'CV Herbal Mandiri', contact: '+62-274-5552345', material_type: 'Botanical Extract', address: 'Jl. Malioboro No. 12, Yogyakarta' },
  { name: 'PT Nilam Aceh Makmur', contact: '+62-651-5553456', material_type: 'Nilam Oil', address: 'Jl. Merdeka No. 8, Banda Aceh' },
  { name: 'UD Cengkeh Maluku', contact: '+62-911-5554567', material_type: 'Clove Extract', address: 'Jl. Pelabuhan No. 3, Ambon' },
  { name: 'PT Jahe Merah Indonesia', contact: '+62-31-5555678', material_type: 'Ginger Extract', address: 'Jl. Pemuda No. 67, Surabaya' },
  { name: 'CV Sereh Wangi Sejahtera', contact: '+62-22-5556789', material_type: 'Lemongrass Oil', address: 'Jl. Asia Afrika No. 21, Bandung' },
  { name: 'PT Kayu Manis Sulawesi', contact: '+62-411-5557890', material_type: 'Cinnamon Extract', address: 'Jl. Sam Ratulangi No. 15, Makassar' },
  { name: 'UD Melati Jawa Tengah', contact: '+62-24-5558901', material_type: 'Jasmine Extract', address: 'Jl. Pandanaran No. 9, Semarang' },
  { name: 'PT Pandan Wangi Nusantara', contact: '+62-61-5559012', material_type: 'Pandan Extract', address: 'Jl. Gatot Subroto No. 33, Medan' },
  { name: 'CV Akar Wangi Jawa Barat', contact: '+62-22-5550123', material_type: 'Vetiver Oil', address: 'Jl. Buah Batu No. 77, Bandung' },
];

const MATERIAL_NAMES = [
  'Minyak Nilam Grade A', 'Ekstrak Jahe Segar', 'Minyak Cengkeh Premium',
  'Ekstrak Sereh Wangi', 'Minyak Kayu Manis', 'Ekstrak Melati Murni',
  'Minyak Akar Wangi', 'Ekstrak Pandan Alami', 'Minyak Eucalyptus',
  'Ekstrak Temulawak', 'Minyak Lavender Lokal', 'Ekstrak Kunyit Putih',
  'Minyak Kenanga', 'Ekstrak Rosella', 'Minyak Mawar',
  'Ekstrak Kaempferia', 'Minyak Ylang-ylang', 'Ekstrak Daun Sirih',
  'Minyak Pala Maluku', 'Ekstrak Sambiloto',
];

const QC_STATUSES = ['pending', 'approved', 'approved', 'approved', 'rejected'];
const LOT_STATUSES = ['queued', 'in_production', 'completed', 'dispatched'];
const PRIORITIES = ['urgent', 'normal', 'normal', 'low'];
const HAZARD_TYPES = ['none', 'none', 'none', 'ibc', 'ippc'];
const ZONES = ['A', 'B', 'C'];
const DISPATCH_STATUSES = ['prepared', 'shipped', 'delivered'];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function seedAll() {
  console.log('🌱 Starting AromOS seed...\n');

  // 1. Create auth users + profiles
  console.log('👥 Creating users...');
  const userIds = {};
  const { data: authUsersData, error: listUsersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listUsersError) throw listUsersError;
  const authUsersByEmail = new Map(authUsersData.users.map(user => [user.email, user]));
  for (const u of USERS_DATA) {
    const { data: existing } = await supabase.from('users').select('id').eq('email', u.email).single();
    if (existing) {
      userIds[u.email] = existing.id;
      console.log(`  ↳ Skipping existing user: ${u.email}`);
      continue;
    }
    let authUser = authUsersByEmail.get(u.email);
    if (!authUser) {
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: u.email, password: u.password, email_confirm: true,
      });
      if (authErr) throw authErr;
      authUser = authData.user;
    }
    const { data: profile, error: profErr } = await supabase.from('users').upsert({
      id: authUser.id, name: u.name, email: u.email, role: u.role, is_active: true,
    }, { onConflict: 'id' }).select().single();
    if (profErr) throw profErr;
    userIds[u.email] = profile.id;
    console.log(`  ✅ ${u.name} (${u.role}) profile ready`);
  }

  // 2. Suppliers
  console.log('\n🏭 Creating suppliers...');
  const { data: suppliers, error: suppErr } = await supabase
    .from('suppliers').upsert(SUPPLIERS_DATA, { onConflict: 'name' }).select();
  if (suppErr) console.error('  ❌ Suppliers error:', suppErr.message);
  else console.log(`  ✅ ${suppliers.length} suppliers created`);

  // 3. Incoming materials
  console.log('\n📦 Creating incoming materials...');
  const adminId = userIds['budi.admin@simaarome.id'] || Object.values(userIds)[0];
  const materialInserts = MATERIAL_NAMES.map((name, i) => ({
    supplier_id: suppliers[i % suppliers.length].id,
    material_name: name,
    quantity: randomInt(50, 500),
    unit: randomItem(['kg', 'liter', 'gram']),
    received_date: daysAgo(randomInt(0, 30)),
    received_by: adminId,
    qc_status: randomItem(QC_STATUSES),
    notes: i % 4 === 0 ? 'Perlu penanganan khusus - produk sensitif suhu' : null,
  }));
  const { data: existingMaterials, error: existingMaterialsError } = await supabase
    .from('incoming_materials').select('*').limit(MATERIAL_NAMES.length);
  if (existingMaterialsError) throw existingMaterialsError;
  let materials = existingMaterials;
  if (materials.length === 0) {
    const { data, error } = await supabase.from('incoming_materials').insert(materialInserts).select();
    if (error) throw error;
    materials = data;
    console.log(`  ✅ ${materials.length} materials created`);
  } else {
    console.log(`  ↳ Reusing ${materials.length} existing materials`);
  }

  // 4. Lots
  console.log('\n🏷️  Creating lots...');
  const ppicId = userIds['fajar.ppic@simaarome.id'] || Object.values(userIds)[0];
  const approvedMaterials = materials.filter(m => m.qc_status === 'approved');
  const lotInserts = Array.from({ length: 15 }, (_, i) => {
    const dateStr = new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
    return {
      lot_number: `SA-${dateStr}-${String(i + 1).padStart(3, '0')}`,
      material_id: approvedMaterials[i % approvedMaterials.length]?.id || materials[0].id,
      production_date: daysAgo(randomInt(0, 14)),
      status: randomItem(LOT_STATUSES),
      created_by: ppicId,
    };
  });
  const seededLotNumbers = lotInserts.map(lot => lot.lot_number);
  let lots = [];
  const { data: insertedLots, error: lotErr } = await supabase.from('lots').upsert(lotInserts, { onConflict: 'lot_number', ignoreDuplicates: true }).select();
  if (lotErr) {
    console.error('  ❌ Lots upsert error:', lotErr.message);
    // If upsert fails, fetch only the deterministic demo lots so the script can continue.
    const { data: existingLots } = await supabase.from('lots').select('*').in('lot_number', seededLotNumbers);
    lots = existingLots || [];
  } else {
    console.log(`  ✅ ${insertedLots?.length || 0} lots processed`);
    lots = insertedLots || [];
    if (lots.length === 0) {
      const { data: existingLots } = await supabase.from('lots').select('*').in('lot_number', seededLotNumbers);
      lots = existingLots || [];
    }
  }

  // 5. QC Checks
  console.log('\n🔬 Creating QC checks...');
  const qcUserId = userIds['siti.qc@simaarome.id'] || Object.values(userIds)[0];
  const qcInserts = lots.slice(0, 12).map(lot => ({
    lot_id: lot.id,
    checked_by: qcUserId,
    color_grade: randomInt(2, 5),
    consistency_grade: randomInt(2, 5),
    contamination_flag: Math.random() < 0.1,
    result: lot.status !== 'queued' ? 'pass' : 'fail',
    notes: 'Pemeriksaan standar sesuai SOP QC-001',
    checked_at: daysAgo(randomInt(0, 7)),
  }));
  const { data: existingQcChecks, error: existingQcError } = await supabase.from('qc_checks').select('lot_id').not('lot_id', 'is', null);
  if (existingQcError) throw existingQcError;
  const checkedLotIds = new Set(existingQcChecks.map(check => check.lot_id));
  const newQcChecks = qcInserts.filter(check => !checkedLotIds.has(check.lot_id));
  if (newQcChecks.length > 0) {
    const { error } = await supabase.from('qc_checks').insert(newQcChecks);
    if (error) throw error;
  }
  console.log(`  ✅ ${newQcChecks.length} QC checks created, ${qcInserts.length - newQcChecks.length} reused`);

  // 6. PPIC Schedules
  console.log('\n📅 Creating PPIC schedules...');
  const ppicInserts = lots.map(lot => ({
    lot_id: lot.id,
    scheduled_date: daysFromNow(randomInt(-5, 10)),
    priority: randomItem(PRIORITIES),
    status: lot.status === 'queued' ? 'queued' : lot.status === 'in_production' ? 'in_production' : 'completed',
    assigned_to: ppicId,
    notes: `Produksi batch ${lot.lot_number}`,
  }));
  const { data: existingSchedules, error: existingSchedulesError } = await supabase.from('ppic_schedules').select('lot_id');
  if (existingSchedulesError) throw existingSchedulesError;
  const scheduledLotIds = new Set(existingSchedules.map(schedule => schedule.lot_id));
  const newSchedules = ppicInserts.filter(schedule => !scheduledLotIds.has(schedule.lot_id));
  if (newSchedules.length > 0) {
    const { error } = await supabase.from('ppic_schedules').insert(newSchedules);
    if (error) throw error;
  }
  console.log(`  ✅ ${newSchedules.length} schedules created, ${ppicInserts.length - newSchedules.length} reused`);

  // 7. Warehouse Slots (10x3 = 30 slots across 3 zones)
  console.log('\n🏪 Creating warehouse slots...');
  const slotInserts = [];
  const slotZoneMap = { A: 'normal', B: 'cold_minus4', C: 'cold_minus20' };
  for (const zone of ZONES) {
    for (let row = 1; row <= 10; row++) {
      slotInserts.push({
        slot_code: `${zone}${String(row).padStart(2, '0')}`,
        zone_row: zone,
        zone_col: row,
        temperature_zone: slotZoneMap[zone],
        is_occupied: false,
        current_lot_id: null,
        hazard_type: zone === 'C' ? randomItem(HAZARD_TYPES) : 'none',
      });
    }
  }
  // Assign some lots to slots
  const completedLots = lots.filter(l => l.status === 'completed' || l.status === 'in_production');
  slotInserts.forEach((slot, i) => {
    if (i < completedLots.length && Math.random() > 0.4) {
      slot.current_lot_id = completedLots[i].id;
      slot.is_occupied = true;
    }
  });
  const { data: existingSlots, error: existingSlotsError } = await supabase.from('warehouse_slots').select('id');
  if (existingSlotsError) throw existingSlotsError;
  if (existingSlots.length === 0) {
    const { data: wSlots, error: wsErr } = await supabase.from('warehouse_slots').insert(slotInserts).select();
    if (wsErr) throw wsErr;
    console.log(`  ✅ ${wSlots.length} warehouse slots created`);
  } else {
    console.log(`  ↳ Reusing ${existingSlots.length} existing warehouse slots`);
  }

  // 8. Dispatches (10 records)
  console.log('\n🚚 Creating dispatches...');
  const warehouseId = userIds['teguh.wh@simaarome.id'] || Object.values(userIds)[0];
  const dispatchedLots = lots.filter(l => l.status === 'dispatched').slice(0, 10);
  const CUSTOMERS = [
    'PT Aroma Nusantara', 'CV Wangi Sejahtera', 'PT Kosmetik Indonesia',
    'UD Parfum Lokal', 'PT Farmasi Herbal', 'CV Sabun Alami',
    'PT Kecantikan Mandiri', 'UD Aromaterapi Jaya', 'PT Spa Indonesia',
    'CV Kesehatan Herbal',
  ];
  const DESTINATIONS = [
    'Jakarta Selatan', 'Surabaya', 'Bandung', 'Medan', 'Semarang',
    'Makassar', 'Yogyakarta', 'Bali', 'Palembang', 'Tangerang',
  ];
  const dispatchInserts = dispatchedLots.map((lot, i) => ({
    lot_id: lot.id,
    customer_name: CUSTOMERS[i % CUSTOMERS.length],
    destination: DESTINATIONS[i % DESTINATIONS.length],
    dispatch_date: daysAgo(randomInt(1, 14)),
    dispatched_by: warehouseId,
    status: randomItem(DISPATCH_STATUSES),
    notes: `Pengiriman batch ${lot.lot_number} ke customer`,
  }));

  if (dispatchInserts.length > 0) {
    const { data: existingDispatches, error: existingDispatchError } = await supabase.from('dispatches').select('lot_id');
    if (existingDispatchError) throw existingDispatchError;
    const dispatchedLotIds = new Set(existingDispatches.map(dispatch => dispatch.lot_id));
    const newDispatches = dispatchInserts.filter(dispatch => !dispatchedLotIds.has(dispatch.lot_id));
    if (newDispatches.length > 0) {
      const { error } = await supabase.from('dispatches').insert(newDispatches);
      if (error) throw error;
    }
    console.log(`  ✅ ${newDispatches.length} dispatches created, ${dispatchInserts.length - newDispatches.length} reused`);
  } else {
    console.log('  ⚠️  No dispatched lots available for dispatch records');
  }

  console.log('\n✨ Seed complete! AromOS is ready.\n');
  console.log('Test accounts:');
  console.log('  Admin:     budi.admin@simaarome.id   / Admin@123');
  console.log('  QC:        siti.qc@simaarome.id      / Qc@12345');
  console.log('  PPIC:      fajar.ppic@simaarome.id   / Ppic@123');
  console.log('  Warehouse: teguh.wh@simaarome.id     / Wh@12345');
}

seedAll().catch(err => { console.error('Fatal seed error:', err); process.exit(1); });
