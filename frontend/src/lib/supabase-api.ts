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
  cancelIntake: async (id: string) => {
    const sb = getSupabase();
    const { error } = await sb.rpc('cancel_material_intake', { p_material_id: id });
    if (error) throw error;
  },
  receive: async (payload: { supplier_id: string | null; material_name: string; quantity: number; unit: string; received_date?: string; notes?: string; action?: string }) => {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('receive_material', {
      p_supplier_id: payload.supplier_id,
      p_material_name: payload.material_name,
      p_quantity: payload.quantity,
      p_unit: payload.unit,
      p_received_date: payload.received_date || new Date().toISOString(),
      p_notes: payload.notes || null,
      p_action: payload.action || 'RECEIVE_MATERIAL',
    });
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
    let query = sb.from('qc_checks').select('*, lots(lot_number, status), incoming_materials(material_name), users!checked_by(name)').order('checked_at', { ascending: false });
    if (params?.result) query = query.eq('result', params.result);
    if (params?.date) query = query.gte('checked_at', params.date).lt('checked_at', params.date + 'T23:59:59');
    const { data, error } = await query;
    if (error) {
      console.error('Supabase QC Error:', error);
      return []; // Return empty array instead of crashing if migration is missing
    }
    return data;
  },
  getPending24h: async () => {
    const sb = getSupabase();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb.from('incoming_materials').select('*, suppliers(name)').eq('qc_status', 'pending').lt('received_date', cutoff);
    if (error) throw error;
    return data;
  },
  getPendingFinishedLots: async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('lots')
      .select('*, incoming_materials(material_name, quantity, unit)')
      .eq('status', 'awaiting_finished_qc')
      .order('production_date', { ascending: true });
    if (error) throw error;
    return data;
  },
  submitRawMaterial: async (payload: { material_id: string; color_grade: number; consistency_grade: number; contamination_flag: boolean; result: 'pass' | 'fail'; notes?: string }) => {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('submit_raw_material_qc', {
      p_material_id: payload.material_id,
      p_color_grade: payload.color_grade,
      p_consistency_grade: payload.consistency_grade,
      p_contamination_flag: payload.contamination_flag,
      p_result: payload.result,
      p_notes: payload.notes || null,
    });
    if (error) throw error;
    return data;
  },
  submitFinishedProduct: async (payload: { lot_id: string; color_grade: number; consistency_grade: number; contamination_flag: boolean; result: 'pass' | 'fail'; notes?: string }) => {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('submit_finished_product_qc', {
      p_lot_id: payload.lot_id,
      p_color_grade: payload.color_grade,
      p_consistency_grade: payload.consistency_grade,
      p_contamination_flag: payload.contamination_flag,
      p_result: payload.result,
      p_notes: payload.notes || null,
    });
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
  createSchedule: async (payload: { material_id: string; scheduled_date: string; priority: string; notes?: string }) => {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('create_ppic_schedule', {
      p_material_id: payload.material_id,
      p_scheduled_date: payload.scheduled_date,
      p_priority: payload.priority,
      p_notes: payload.notes || null,
    });
    if (error) throw error;
    return data;
  },
  moveSchedule: async (scheduleId: string, status: string) => {
    const sb = getSupabase();
    const { error } = await sb.rpc('move_ppic_schedule', { p_schedule_id: scheduleId, p_status: status });
    if (error) throw error;
  },
  cancelSchedule: async (scheduleId: string) => {
    const sb = getSupabase();
    const { error } = await sb.rpc('cancel_ppic_schedule', { p_schedule_id: scheduleId });
    if (error) throw error;
  },
};

// ── Warehouse ─────────────────────────────────────────
export const supabaseWarehouseApi = {
  getSlots: async () => {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('warehouse_slots')
      .select('*, lots!current_lot_id(lot_number, status, incoming_materials(material_name))')
      .order('zone_row', { ascending: true })
      .order('zone_col', { ascending: true });
    if (error) throw error;
    return data;
  },
  getStats: async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('warehouse_slots').select('is_occupied, temperature_zone');
    if (error) throw error;
    const total = (data || []).length;
    const occupied = (data || []).filter((s: any) => s.is_occupied).length;
    return { total, occupied, available: total - occupied, occupancy_pct: total > 0 ? Math.round((occupied / total) * 100) : 0, rawData: data || [] };
  },
  getStorageSpecs: async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('material_storage_specs').select('*').order('material_name');
    if (error) throw error;
    return data || [];
  },
  getExcursions: async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('cold_chain_excursions')
      .select('*, warehouse_slots(slot_code), lots(lot_number)')
      .order('opened_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },
  assignSlot: async (slotId: string, lotId: string) => {
    const sb = getSupabase();
    const { error } = await sb.rpc('assign_warehouse_slot', { p_slot_id: slotId, p_lot_id: lotId });
    if (error) throw error;
  },
  releaseSlot: async (slotId: string) => {
    const sb = getSupabase();
    const { error } = await sb.rpc('release_warehouse_slot', { p_slot_id: slotId });
    if (error) throw error;
  },
  recordSensorReading: async (slotId: string, temperature: number) => {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('record_sensor_reading', { p_slot_id: slotId, p_temperature: temperature });
    if (error) throw error;
    return data;
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
  create: async (payload: { lot_id: string; customer_name: string; destination: string; movement_type: 'sample' | 'bulk'; quantity: number; unit: string; dispatch_date?: string; notes?: string }) => {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('create_dispatch', {
      p_lot_id: payload.lot_id,
      p_customer_name: payload.customer_name,
      p_destination: payload.destination,
      p_movement_type: payload.movement_type,
      p_quantity: payload.quantity,
      p_unit: payload.unit,
      p_dispatch_date: payload.dispatch_date || new Date().toISOString(),
      p_notes: payload.notes || null,
    });
    if (error) throw error;
    return data;
  },
  advance: async (id: string, status: string) => {
    const sb = getSupabase();
    const { error } = await sb.rpc('advance_dispatch', { p_dispatch_id: id, p_status: status });
    if (error) throw error;
  },
};

export const supabaseLotPassportApi = {
  getById: async (id: string) => {
    const sb = getSupabase();
    const { data: lot, error } = await sb.from('lots')
      .select('*, incoming_materials(*, suppliers(name)), qc_checks(*, users!checked_by(name)), ppic_schedules(*), warehouse_slots(*), dispatches(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    const [{ data: rawMaterialChecks }, { data: excursions }, { data: audits }] = await Promise.all([
      sb.from('qc_checks').select('*, users!checked_by(name)').eq('material_id', lot.material_id).order('checked_at', { ascending: false }),
      sb.from('cold_chain_excursions').select('*, warehouse_slots(slot_code)').eq('lot_id', id).order('opened_at', { ascending: false }),
      sb.from('audit_logs').select('*').contains('new_value', { lot_id: id }).order('timestamp', { ascending: false }),
    ]);
    return { ...lot, qc_checks: [...(rawMaterialChecks || []), ...(lot.qc_checks || [])], cold_chain_excursions: excursions || [], audit_logs: audits || [] };
  },
};

// ── Notifications ─────────────────────────────────────
export const supabaseNotificationsApi = {
  getAll: async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  markAsRead: async (id: string) => {
    const sb = getSupabase();
    const { data, error } = await sb.from('notifications').update({ is_read: true }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  markAllAsRead: async () => {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { error } = await sb.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    if (error) throw error;
    return true;
  },
  deleteAll: async () => {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { error } = await sb.from('notifications').delete().eq('user_id', user.id);
    if (error) throw error;
    return true;
  }
};
