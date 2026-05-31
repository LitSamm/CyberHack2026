-- AromOS demo-ready operations migration.
-- Apply after schema.sql, material_qc_migration.sql, and notifications_schema.sql.

-- =============================================
-- DOMAIN MODEL
-- =============================================

ALTER TABLE public.incoming_materials
  ADD COLUMN IF NOT EXISTS receiving_area TEXT NOT NULL DEFAULT 'quarantine';

ALTER TABLE public.lots DROP CONSTRAINT IF EXISTS lots_status_check;
ALTER TABLE public.lots
  ADD CONSTRAINT lots_status_check
  CHECK (status IN ('queued', 'in_production', 'awaiting_finished_qc', 'completed', 'dispatched', 'rejected'));

ALTER TABLE public.ppic_schedules DROP CONSTRAINT IF EXISTS ppic_schedules_status_check;
ALTER TABLE public.ppic_schedules
  ADD CONSTRAINT ppic_schedules_status_check
  CHECK (status IN ('queued', 'in_production', 'awaiting_finished_qc', 'completed', 'dispatched', 'rejected'));

ALTER TABLE public.dispatches
  ADD COLUMN IF NOT EXISTS movement_type TEXT NOT NULL DEFAULT 'bulk',
  ADD COLUMN IF NOT EXISTS quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS unit TEXT;

ALTER TABLE public.dispatches DROP CONSTRAINT IF EXISTS dispatches_movement_type_check;
ALTER TABLE public.dispatches
  ADD CONSTRAINT dispatches_movement_type_check CHECK (movement_type IN ('sample', 'bulk'));

ALTER TABLE public.dispatches DROP CONSTRAINT IF EXISTS dispatches_quantity_positive;
ALTER TABLE public.dispatches
  ADD CONSTRAINT dispatches_quantity_positive CHECK (quantity IS NULL OR quantity > 0);

CREATE TABLE IF NOT EXISTS public.material_storage_specs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_name TEXT UNIQUE NOT NULL,
  required_temperature_zone TEXT NOT NULL DEFAULT 'normal'
    CHECK (required_temperature_zone IN ('normal', 'cold_minus4', 'cold_minus20')),
  min_temperature NUMERIC NOT NULL DEFAULT 15,
  max_temperature NUMERIC NOT NULL DEFAULT 30,
  hazard_type TEXT NOT NULL DEFAULT 'none' CHECK (hazard_type IN ('none', 'ibc', 'ippc')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.warehouse_slots
  ADD COLUMN IF NOT EXISTS current_temperature NUMERIC;

UPDATE public.warehouse_slots SET hazard_type = 'none' WHERE hazard_type IS NULL;
ALTER TABLE public.warehouse_slots ALTER COLUMN hazard_type SET DEFAULT 'none';
ALTER TABLE public.warehouse_slots ALTER COLUMN hazard_type SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.cold_chain_excursions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id UUID NOT NULL REFERENCES public.warehouse_slots(id) ON DELETE CASCADE,
  lot_id UUID REFERENCES public.lots(id) ON DELETE SET NULL,
  measured_temperature NUMERIC NOT NULL,
  min_temperature NUMERIC NOT NULL,
  max_temperature NUMERIC NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES public.incoming_materials(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_excursions_slot_open ON public.cold_chain_excursions(slot_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_dispatches_lot_id ON public.dispatches(lot_id);
CREATE INDEX IF NOT EXISTS idx_qc_checks_material_id ON public.qc_checks(material_id);
CREATE INDEX IF NOT EXISTS idx_qc_checks_lot_id ON public.qc_checks(lot_id);

INSERT INTO public.material_storage_specs
  (material_name, required_temperature_zone, min_temperature, max_temperature, hazard_type)
VALUES
  ('Apel Fuji', 'normal', 15, 30, 'none'),
  ('Ekstrak Cair', 'cold_minus4', -6, -2, 'none'),
  ('Frozen Material', 'cold_minus20', -22, -18, 'none')
ON CONFLICT (material_name) DO NOTHING;

-- =============================================
-- SECURITY HELPERS
-- =============================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() AND is_active = TRUE
$$;

CREATE OR REPLACE FUNCTION public.has_role(VARIADIC allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = ANY(allowed_roles), FALSE)
$$;

CREATE OR REPLACE FUNCTION public.write_audit(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id TEXT,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, old_value, new_value)
  VALUES (auth.uid(), p_action, p_table_name, p_record_id, p_old_value, p_new_value);
END;
$$;

-- =============================================
-- RLS
-- =============================================

ALTER TABLE public.material_storage_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cold_chain_excursions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.users;
DROP POLICY IF EXISTS "Service role full access" ON public.suppliers;
DROP POLICY IF EXISTS "Service role full access" ON public.incoming_materials;
DROP POLICY IF EXISTS "Service role full access" ON public.lots;
DROP POLICY IF EXISTS "Service role full access" ON public.qc_checks;
DROP POLICY IF EXISTS "Service role full access" ON public.ppic_schedules;
DROP POLICY IF EXISTS "Service role full access" ON public.warehouse_slots;
DROP POLICY IF EXISTS "Service role full access" ON public.dispatches;
DROP POLICY IF EXISTS "Service role full access" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role full access on notifications" ON public.notifications;

CREATE POLICY "Authenticated users can read profiles" ON public.users
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can read suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can read materials" ON public.incoming_materials
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can read lots" ON public.lots
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can read QC checks" ON public.qc_checks
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can read schedules" ON public.ppic_schedules
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can read warehouse slots" ON public.warehouse_slots
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can read dispatches" ON public.dispatches
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "Users can write own audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Authenticated users can read storage specs" ON public.material_storage_specs
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can read excursions" ON public.cold_chain_excursions
  FOR SELECT TO authenticated USING (TRUE);

-- =============================================
-- ATOMIC OPERATIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.receive_material(
  p_supplier_id UUID,
  p_material_name TEXT,
  p_quantity NUMERIC,
  p_unit TEXT,
  p_received_date TIMESTAMPTZ DEFAULT NOW(),
  p_notes TEXT DEFAULT NULL,
  p_action TEXT DEFAULT 'RECEIVE_MATERIAL'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_material_id UUID;
BEGIN
  IF NOT public.has_role('admin', 'warehouse', 'ppic', 'qc') THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_material_name IS NULL OR p_quantity IS NULL OR p_quantity <= 0 OR p_unit IS NULL THEN
    RAISE EXCEPTION 'Material name, positive quantity, and unit are required';
  END IF;
  INSERT INTO public.incoming_materials(supplier_id, material_name, quantity, unit, received_date, received_by, qc_status, notes, receiving_area)
  VALUES (p_supplier_id, p_material_name, p_quantity, p_unit, p_received_date, auth.uid(), 'pending', p_notes, 'quarantine')
  RETURNING id INTO v_material_id;
  PERFORM public.write_audit(p_action, 'incoming_materials', v_material_id::TEXT, NULL,
    jsonb_build_object('material_name', p_material_name, 'quantity', p_quantity, 'unit', p_unit));
  RETURN v_material_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_raw_material_qc(
  p_material_id UUID,
  p_color_grade INTEGER,
  p_consistency_grade INTEGER,
  p_contamination_flag BOOLEAN,
  p_result TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check_id UUID;
BEGIN
  IF NOT public.has_role('admin', 'qc') THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_result NOT IN ('pass', 'fail') THEN RAISE EXCEPTION 'Invalid QC result'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.incoming_materials WHERE id = p_material_id AND qc_status = 'pending') THEN
    RAISE EXCEPTION 'Material is not pending QC';
  END IF;

  INSERT INTO public.qc_checks(material_id, checked_by, color_grade, consistency_grade, contamination_flag, result, notes)
  VALUES (p_material_id, auth.uid(), p_color_grade, p_consistency_grade, p_contamination_flag, p_result, p_notes)
  RETURNING id INTO v_check_id;

  UPDATE public.incoming_materials
  SET qc_status = CASE WHEN p_result = 'pass' THEN 'approved' ELSE 'rejected' END
  WHERE id = p_material_id;

  PERFORM public.write_audit('RAW_MATERIAL_QC', 'qc_checks', v_check_id::TEXT, NULL,
    jsonb_build_object('material_id', p_material_id, 'result', p_result));
  RETURN v_check_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_ppic_schedule(p_schedule_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot_id UUID;
  v_status TEXT;
BEGIN
  IF NOT public.has_role('admin', 'ppic') THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT lot_id, status INTO v_lot_id, v_status FROM public.ppic_schedules WHERE id = p_schedule_id FOR UPDATE;
  IF v_lot_id IS NULL THEN RAISE EXCEPTION 'Schedule not found'; END IF;
  IF v_status <> 'queued' THEN RAISE EXCEPTION 'Only queued schedules can be cancelled'; END IF;
  DELETE FROM public.lots WHERE id = v_lot_id;
  PERFORM public.write_audit('CANCEL_SCHEDULE', 'ppic_schedules', p_schedule_id::TEXT,
    jsonb_build_object('lot_id', v_lot_id, 'status', v_status), NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_material_intake(p_material_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('admin', 'warehouse', 'ppic') THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.incoming_materials WHERE id = p_material_id AND qc_status = 'pending') THEN
    RAISE EXCEPTION 'Only pending material intake can be cancelled';
  END IF;
  DELETE FROM public.incoming_materials WHERE id = p_material_id;
  PERFORM public.write_audit('CANCEL_INTAKE', 'incoming_materials', p_material_id::TEXT, NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ppic_schedule(
  p_material_id UUID,
  p_scheduled_date DATE,
  p_priority TEXT DEFAULT 'normal',
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot_id UUID;
  v_schedule_id UUID;
  v_lot_number TEXT;
  v_prefix TEXT;
  v_sequence INTEGER;
BEGIN
  IF NOT public.has_role('admin', 'ppic') THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.incoming_materials WHERE id = p_material_id AND qc_status = 'approved') THEN
    RAISE EXCEPTION 'Material must pass raw-material QC first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lots WHERE material_id = p_material_id) THEN
    RAISE EXCEPTION 'Material already has a production lot';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('aromos-lot-number-' || CURRENT_DATE::TEXT));
  v_prefix := 'SA-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-';
  SELECT COALESCE(MAX(NULLIF(split_part(lot_number, '-', 3), '')::INTEGER), 0) + 1
  INTO v_sequence FROM public.lots WHERE lot_number LIKE v_prefix || '%';
  v_lot_number := v_prefix || lpad(v_sequence::TEXT, 3, '0');

  INSERT INTO public.lots(lot_number, material_id, production_date, status, created_by, notes)
  VALUES (v_lot_number, p_material_id, p_scheduled_date, 'queued', auth.uid(), p_notes)
  RETURNING id INTO v_lot_id;

  INSERT INTO public.ppic_schedules(lot_id, scheduled_date, priority, status, assigned_to, notes)
  VALUES (v_lot_id, p_scheduled_date, p_priority, 'queued', auth.uid(), p_notes)
  RETURNING id INTO v_schedule_id;

  PERFORM public.write_audit('CREATE_SCHEDULE', 'ppic_schedules', v_schedule_id::TEXT, NULL,
    jsonb_build_object('lot_id', v_lot_id, 'lot_number', v_lot_number));
  RETURN v_schedule_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_ppic_schedule(p_schedule_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot_id UUID;
  v_old_status TEXT;
BEGIN
  IF NOT public.has_role('admin', 'ppic') THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_status NOT IN ('queued', 'in_production', 'awaiting_finished_qc') THEN
    RAISE EXCEPTION 'PPIC cannot release or dispatch a lot';
  END IF;
  SELECT lot_id, status INTO v_lot_id, v_old_status FROM public.ppic_schedules WHERE id = p_schedule_id FOR UPDATE;
  IF v_lot_id IS NULL THEN RAISE EXCEPTION 'Schedule not found'; END IF;
  IF v_old_status IN ('awaiting_finished_qc', 'completed', 'rejected', 'dispatched') THEN
    RAISE EXCEPTION 'Schedule is already outside PPIC control';
  END IF;

  UPDATE public.ppic_schedules SET status = p_status WHERE id = p_schedule_id;
  UPDATE public.lots SET status = p_status WHERE id = v_lot_id;
  PERFORM public.write_audit('MOVE_SCHEDULE', 'ppic_schedules', p_schedule_id::TEXT,
    jsonb_build_object('status', v_old_status), jsonb_build_object('status', p_status, 'lot_id', v_lot_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_finished_product_qc(
  p_lot_id UUID,
  p_color_grade INTEGER,
  p_consistency_grade INTEGER,
  p_contamination_flag BOOLEAN,
  p_result TEXT,
  p_notes TEXT DEFAULT NULL,
  p_ai_color_grade INTEGER DEFAULT NULL,
  p_ai_consistency_grade INTEGER DEFAULT NULL,
  p_ai_contamination_flag BOOLEAN DEFAULT NULL,
  p_ai_confidence NUMERIC DEFAULT NULL,
  p_ai_recommendation TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check_id UUID;
  v_lot_status TEXT;
BEGIN
  IF NOT public.has_role('admin', 'qc') THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_result NOT IN ('pass', 'fail') THEN RAISE EXCEPTION 'Invalid QC result'; END IF;
  SELECT status INTO v_lot_status FROM public.lots WHERE id = p_lot_id FOR UPDATE;
  IF v_lot_status <> 'awaiting_finished_qc' THEN RAISE EXCEPTION 'Lot is not awaiting finished-product QC'; END IF;

  INSERT INTO public.qc_checks(
    lot_id, checked_by, color_grade, consistency_grade, contamination_flag, result, notes,
    ai_color_grade, ai_consistency_grade, ai_contamination_flag, ai_confidence, ai_recommendation, ai_used
  )
  VALUES (
    p_lot_id, auth.uid(), p_color_grade, p_consistency_grade, p_contamination_flag, p_result, p_notes,
    p_ai_color_grade, p_ai_consistency_grade, p_ai_contamination_flag, p_ai_confidence, p_ai_recommendation,
    p_ai_recommendation IS NOT NULL
  )
  RETURNING id INTO v_check_id;

  UPDATE public.lots SET status = CASE WHEN p_result = 'pass' THEN 'completed' ELSE 'rejected' END WHERE id = p_lot_id;
  UPDATE public.ppic_schedules SET status = CASE WHEN p_result = 'pass' THEN 'completed' ELSE 'rejected' END WHERE lot_id = p_lot_id;
  PERFORM public.write_audit('FINISHED_PRODUCT_QC', 'qc_checks', v_check_id::TEXT, NULL,
    jsonb_build_object('lot_id', p_lot_id, 'result', p_result));
  RETURN v_check_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_warehouse_slot(p_slot_id UUID, p_lot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('admin', 'warehouse') THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lots WHERE id = p_lot_id AND status = 'completed') THEN
    RAISE EXCEPTION 'Only QC-released finished goods can enter warehouse';
  END IF;
  IF EXISTS (SELECT 1 FROM public.warehouse_slots WHERE id = p_slot_id AND is_occupied) THEN RAISE EXCEPTION 'Slot is occupied'; END IF;
  IF EXISTS (SELECT 1 FROM public.warehouse_slots WHERE current_lot_id = p_lot_id) THEN RAISE EXCEPTION 'Lot already stored'; END IF;
  UPDATE public.warehouse_slots SET current_lot_id = p_lot_id, is_occupied = TRUE, last_updated = NOW(), updated_by = auth.uid() WHERE id = p_slot_id;
  PERFORM public.write_audit('ASSIGN_SLOT', 'warehouse_slots', p_slot_id::TEXT, NULL, jsonb_build_object('lot_id', p_lot_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.release_warehouse_slot(p_slot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_lot_id UUID;
BEGIN
  IF NOT public.has_role('admin', 'warehouse') THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT current_lot_id INTO v_lot_id FROM public.warehouse_slots WHERE id = p_slot_id FOR UPDATE;
  UPDATE public.warehouse_slots SET current_lot_id = NULL, is_occupied = FALSE, last_updated = NOW(), updated_by = auth.uid() WHERE id = p_slot_id;
  PERFORM public.write_audit('RELEASE_SLOT', 'warehouse_slots', p_slot_id::TEXT, jsonb_build_object('lot_id', v_lot_id), NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_dispatch(
  p_lot_id UUID,
  p_customer_name TEXT,
  p_destination TEXT,
  p_movement_type TEXT,
  p_quantity NUMERIC,
  p_unit TEXT,
  p_dispatch_date TIMESTAMPTZ DEFAULT NOW(),
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_dispatch_id UUID;
BEGIN
  IF NOT public.has_role('admin', 'warehouse', 'ppic') THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_movement_type NOT IN ('sample', 'bulk') THEN RAISE EXCEPTION 'Invalid movement type'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_unit IS NULL THEN RAISE EXCEPTION 'Quantity and unit are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lots WHERE id = p_lot_id AND status = 'completed') THEN RAISE EXCEPTION 'Only QC-released lots can be dispatched'; END IF;

  INSERT INTO public.dispatches(lot_id, customer_name, destination, dispatch_date, dispatched_by, status, notes, movement_type, quantity, unit)
  VALUES (p_lot_id, p_customer_name, p_destination, p_dispatch_date, auth.uid(), 'prepared', p_notes, p_movement_type, p_quantity, p_unit)
  RETURNING id INTO v_dispatch_id;
  PERFORM public.write_audit('CREATE_DISPATCH', 'dispatches', v_dispatch_id::TEXT, NULL,
    jsonb_build_object('lot_id', p_lot_id, 'movement_type', p_movement_type, 'quantity', p_quantity, 'unit', p_unit));
  RETURN v_dispatch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_dispatch(p_dispatch_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatch public.dispatches%ROWTYPE;
BEGIN
  IF NOT public.has_role('admin', 'warehouse', 'ppic') THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT * INTO v_dispatch FROM public.dispatches WHERE id = p_dispatch_id FOR UPDATE;
  IF v_dispatch.id IS NULL THEN RAISE EXCEPTION 'Dispatch not found'; END IF;
  IF NOT ((v_dispatch.status = 'prepared' AND p_status = 'shipped') OR (v_dispatch.status = 'shipped' AND p_status = 'delivered')) THEN
    RAISE EXCEPTION 'Invalid dispatch transition';
  END IF;
  UPDATE public.dispatches SET status = p_status WHERE id = p_dispatch_id;
  IF v_dispatch.movement_type = 'bulk' AND p_status = 'shipped' THEN
    UPDATE public.lots SET status = 'dispatched' WHERE id = v_dispatch.lot_id;
    UPDATE public.warehouse_slots SET current_lot_id = NULL, is_occupied = FALSE, last_updated = NOW(), updated_by = auth.uid()
    WHERE current_lot_id = v_dispatch.lot_id;
  END IF;
  PERFORM public.write_audit('ADVANCE_DISPATCH', 'dispatches', p_dispatch_id::TEXT,
    jsonb_build_object('status', v_dispatch.status), jsonb_build_object('status', p_status));
END;
$$;

CREATE OR REPLACE FUNCTION public.record_sensor_reading(p_slot_id UUID, p_temperature NUMERIC)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot public.warehouse_slots%ROWTYPE;
  v_min NUMERIC := 15;
  v_max NUMERIC := 30;
  v_excursion_id UUID;
BEGIN
  IF NOT public.has_role('admin', 'warehouse') THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT * INTO v_slot FROM public.warehouse_slots WHERE id = p_slot_id FOR UPDATE;
  IF v_slot.id IS NULL THEN RAISE EXCEPTION 'Slot not found'; END IF;

  IF v_slot.current_lot_id IS NOT NULL THEN
    SELECT COALESCE(spec.min_temperature, 15), COALESCE(spec.max_temperature, 30)
    INTO v_min, v_max
    FROM public.lots lot
    JOIN public.incoming_materials material ON material.id = lot.material_id
    LEFT JOIN public.material_storage_specs spec ON lower(spec.material_name) = lower(material.material_name)
    WHERE lot.id = v_slot.current_lot_id;
  END IF;

  UPDATE public.warehouse_slots SET current_temperature = p_temperature, last_updated = NOW(), updated_by = auth.uid() WHERE id = p_slot_id;
  IF p_temperature < v_min OR p_temperature > v_max THEN
    SELECT id INTO v_excursion_id FROM public.cold_chain_excursions WHERE slot_id = p_slot_id AND resolved_at IS NULL LIMIT 1;
    IF v_excursion_id IS NULL THEN
      INSERT INTO public.cold_chain_excursions(slot_id, lot_id, measured_temperature, min_temperature, max_temperature, created_by)
      VALUES (p_slot_id, v_slot.current_lot_id, p_temperature, v_min, v_max, auth.uid())
      RETURNING id INTO v_excursion_id;
    END IF;
  ELSE
    UPDATE public.cold_chain_excursions SET resolved_at = NOW() WHERE slot_id = p_slot_id AND resolved_at IS NULL;
  END IF;
  PERFORM public.write_audit('SENSOR_READING', 'warehouse_slots', p_slot_id::TEXT, NULL, jsonb_build_object('temperature', p_temperature));
  RETURN v_excursion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit(TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.receive_material(UUID, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_raw_material_qc(UUID, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_material_intake(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_ppic_schedule(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_ppic_schedule(UUID, DATE, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.move_ppic_schedule(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_finished_product_qc(UUID, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_warehouse_slot(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_warehouse_slot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_dispatch(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_dispatch(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_sensor_reading(UUID, NUMERIC) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.receive_material(UUID, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_raw_material_qc(UUID, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_material_intake(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ppic_schedule(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ppic_schedule(UUID, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_ppic_schedule(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_finished_product_qc(UUID, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_warehouse_slot(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_warehouse_slot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_dispatch(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_dispatch(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_sensor_reading(UUID, NUMERIC) TO authenticated;
