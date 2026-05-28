import { createClient } from '@/lib/supabase';

/**
 * Supabase direct API layer.
 * Used as fallback when the Express backend is unavailable.
 * Requires proper RLS policies on all tables.
 */

function getSupabase() {
  return createClient();
}

// ── Dashboard ─────────────────────────────────────────
export const supabaseDashboardApi = {
  getStats: async () => {
    const sb = getSupabase();
    const today = new Date().toISOString().slice(0, 10);
    const [lotsToday, qcChecks, pendingSchedules, warehouseSlots, pendingQC] = await Promise.all([
      sb.from('lots').select('id', { count: 'exact', head: true }).gte('created_at', today),
      sb.from('qc_checks').select('result').gte('checked_at', today),
      sb.from('ppic_schedules').select('id', { count: 'exact', head: true }).in('status', ['queued', 'in_production']),
      sb.from('warehouse_slots').select('is_occupied'),
      sb.from('incoming_materials').select('id', { count: 'exact', head: true }).eq('qc_status', 'pending'),
    ]);
    const checks = qcChecks.data || [];
    const slots = warehouseSlots.data || [];
    const passRate = checks.length > 0 ? Math.round((checks.filter((c: any) => c.result === 'pass').length / checks.length) * 100) : 0;
    const occupancyPct = slots.length > 0 ? Math.round((slots.filter((s: any) => s.is_occupied).length / slots.length) * 100) : 0;
    return {
      lots_today: lotsToday.count || 0,
      qc_pass_rate: passRate,
      pending_schedules: pendingSchedules.count || 0,
      warehouse_occupancy: occupancyPct,
      pending_qc_count: pendingQC.count || 0,
    };
  },

  getRecentActivity: async () => {
    const sb = getSupabase();
    const { data } = await sb.from('audit_logs').select('*, users!user_id(name, role)').order('timestamp', { ascending: false }).limit(20);
    return data || [];
  },

  getNotifications: async () => {
    const sb = getSupabase();
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [pendingQC, overdueSchedules] = await Promise.all([
      sb.from('incoming_materials').select('id, material_name, received_date').eq('qc_status', 'pending').lt('received_date', cutoff24h),
      sb.from('ppic_schedules').select('id, lots(lot_number), scheduled_date, priority').in('status', ['queued', 'in_production']).lt('scheduled_date', new Date().toISOString().slice(0, 10)),
    ]);
    const notifications = [
      ...(pendingQC.data || []).map((m: any) => ({ type: 'warning', message: `Material "${m.material_name}" pending QC > 24 jam`, id: m.id, table: 'incoming_materials' })),
      ...(overdueSchedules.data || []).map((s: any) => ({ type: 'error', message: `Lot ${s.lots?.lot_number} overdue — jadwal ${s.scheduled_date}`, id: s.id, table: 'ppic_schedules' })),
    ];
    return { count: notifications.length, notifications };
  },
};

// ── Users ─────────────────────────────────────────────
export const supabaseUsersApi = {
  getAll: async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
};

// ── Suppliers ─────────────────────────────────────────
export const supabaseSuppliersApi = {
  getAll: async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('suppliers').select('*').order('name');
    if (error) throw error;
    return data;
  },
};

// ── Materials ─────────────────────────────────────────
export const supabaseMaterialsApi = {
  getAll: async (params?: { status?: string; supplier_id?: string }) => {
    const sb = getSupabase();
    let query = sb.from('incoming_materials').select('*, suppliers(name, material_type)').order('received_date', { ascending: false });
    if (params?.status) query = query.eq('qc_status', params.status);
    if (params?.supplier_id) query = query.eq('supplier_id', params.supplier_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  update: async (id: string, updates: any) => {
    const sb = getSupabase();
    const { data, error } = await sb.from('incoming_materials').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
};

// ── Lots ──────────────────────────────────────────────
export const supabaseLotsApi = {
  getAll: async (params?: { status?: string }) => {
    const sb = getSupabase();
    let query = sb.from('lots').select('*, incoming_materials(material_name, quantity, unit), users!created_by(name)').order('created_at', { ascending: false });
    if (params?.status) query = query.eq('status', params.status);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
};

// ── QC ────────────────────────────────────────────────
export const supabaseQcApi = {
  getAll: async (params?: { date?: string; result?: string }) => {
    const sb = getSupabase();
    let query = sb.from('qc_checks').select('*, lots(lot_number, status), users!checked_by(name)').order('checked_at', { ascending: false });
    if (params?.result) query = query.eq('result', params.result);
    if (params?.date) query = query.gte('checked_at', params.date).lt('checked_at', params.date + 'T23:59:59');
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  getPending24h: async () => {
    const sb = getSupabase();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb.from('incoming_materials').select('*, suppliers(name)').eq('qc_status', 'pending').lt('received_date', cutoff);
    if (error) throw error;
    return data;
  },
};

// ── PPIC ──────────────────────────────────────────────
export const supabasePpicApi = {
  getSchedules: async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('ppic_schedules').select('*, lots(lot_number, status, incoming_materials(material_name)), users!assigned_to(name)').order('scheduled_date', { ascending: true });
    if (error) throw error;
    return data;
  },
};

// ── Warehouse ─────────────────────────────────────────
export const supabaseWarehouseApi = {
  getSlots: async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('warehouse_slots').select('*, lots!current_lot_id(lot_number, status)').order('slot_code');
    if (error) throw error;
    return data;
  },
  getStats: async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('warehouse_slots').select('is_occupied, temperature_zone');
    if (error) throw error;
    const total = (data || []).length;
    const occupied = (data || []).filter((s: any) => s.is_occupied).length;
    return { total, occupied, available: total - occupied, occupancy_pct: total > 0 ? Math.round((occupied / total) * 100) : 0 };
  },
};

// ── Dispatch ──────────────────────────────────────────
export const supabaseDispatchApi = {
  getAll: async (params?: { status?: string }) => {
    const sb = getSupabase();
    let query = sb.from('dispatches').select('*, lots(lot_number, status), users!dispatched_by(name)').order('dispatch_date', { ascending: false });
    if (params?.status) query = query.eq('status', params.status);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
};

// ── Audit ─────────────────────────────────────────────
export const supabaseAuditApi = {
  getAll: async (params?: any) => {
    const sb = getSupabase();
    let query = sb.from('audit_logs').select('*, users!user_id(name, email, role)', { count: 'exact' }).order('timestamp', { ascending: false }).limit(100);
    if (params?.user_id) query = query.eq('user_id', params.user_id);
    if (params?.table_name) query = query.eq('table_name', params.table_name);
    if (params?.action) query = query.eq('action', params.action);
    if (params?.from) query = query.gte('timestamp', params.from);
    if (params?.to) query = query.lte('timestamp', params.to);
    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data || [], total: count || 0 };
  },
};

// ── Search ────────────────────────────────────────────
export const supabaseSearchApi = {
  search: async (q: string) => {
    const sb = getSupabase();
    const term = q.trim();
    const [lots, materials, dispatches] = await Promise.all([
      sb.from('lots').select('id, lot_number, status, production_date').ilike('lot_number', `%${term}%`).limit(5),
      sb.from('incoming_materials').select('id, material_name, qc_status, received_date').ilike('material_name', `%${term}%`).limit(5),
      sb.from('dispatches').select('id, customer_name, destination, status, dispatch_date').or(`customer_name.ilike.%${term}%,destination.ilike.%${term}%`).limit(5),
    ]);
    return {
      lots: lots.data || [],
      materials: materials.data || [],
      dispatches: dispatches.data || [],
      total: (lots.data?.length || 0) + (materials.data?.length || 0) + (dispatches.data?.length || 0),
    };
  },
};
