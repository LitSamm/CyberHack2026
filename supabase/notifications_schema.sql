-- =============================================
-- NOTIFICATIONS SYSTEM SCHEMA
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('qc_overdue', 'lot_urgent', 'cold_mismatch', 'dispatch_ready', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  lot_id UUID REFERENCES public.lots(id),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Setup RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" 
ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on notifications" 
ON public.notifications FOR ALL USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 3. Trigger: Dispatch Ready (Warehouse notification)
CREATE OR REPLACE FUNCTION notify_dispatch_ready() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO public.notifications (user_id, type, title, message, lot_id)
    SELECT id, 'dispatch_ready', 'Lot Siap Dikirim', 'Lot ' || NEW.lot_number || ' telah selesai produksi dan siap dikirim.', NEW.id
    FROM public.users WHERE role = 'warehouse';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lot_completed_trigger ON public.lots;
CREATE TRIGGER lot_completed_trigger
AFTER UPDATE ON public.lots
FOR EACH ROW EXECUTE FUNCTION notify_dispatch_ready();


-- 4. Trigger: Urgent Lot (PPIC notification)
CREATE OR REPLACE FUNCTION notify_urgent_schedule() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.priority = 'urgent' AND OLD.priority != 'urgent' THEN
    -- Get the lot number
    DECLARE
      v_lot_num TEXT;
    BEGIN
      SELECT lot_number INTO v_lot_num FROM public.lots WHERE id = NEW.lot_id;
      
      INSERT INTO public.notifications (user_id, type, title, message, lot_id)
      SELECT id, 'lot_urgent', 'Jadwal Mendesak', 'Lot ' || v_lot_num || ' telah ditandai sebagai URGENT.', NEW.lot_id
      FROM public.users WHERE role = 'ppic';
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schedule_urgent_trigger ON public.ppic_schedules;
CREATE TRIGGER schedule_urgent_trigger
AFTER UPDATE ON public.ppic_schedules
FOR EACH ROW EXECUTE FUNCTION notify_urgent_schedule();


-- 5. Trigger: Cold-Chain Mismatch (Warehouse notification)
CREATE OR REPLACE FUNCTION notify_cold_mismatch() RETURNS TRIGGER AS $$
DECLARE
  v_req_temp TEXT;
  v_material_name TEXT;
  v_lot_num TEXT;
BEGIN
  IF NEW.is_occupied = true AND NEW.current_lot_id IS NOT NULL AND 
     (OLD.is_occupied = false OR OLD.current_lot_id IS DISTINCT FROM NEW.current_lot_id) THEN
    
    -- Figure out required temp by material name (mock logic matching frontend)
    SELECT im.material_name, l.lot_number INTO v_material_name, v_lot_num
    FROM public.lots l
    JOIN public.incoming_materials im ON l.material_id = im.id
    WHERE l.id = NEW.current_lot_id;

    v_req_temp := 'normal';
    IF v_material_name ILIKE '%ekstrak%' OR v_material_name ILIKE '%liquid%' THEN v_req_temp := 'cold_minus4'; END IF;
    IF v_material_name ILIKE '%frozen%' OR v_material_name ILIKE '%beku%' OR v_material_name ILIKE '%kultur%' THEN v_req_temp := 'cold_minus20'; END IF;

    IF v_req_temp != NEW.temperature_zone THEN
      INSERT INTO public.notifications (user_id, type, title, message, lot_id)
      SELECT id, 'cold_mismatch', 'Peringatan Suhu (Mismatch)', 'Lot ' || v_lot_num || ' ditempatkan di zona ' || NEW.temperature_zone || ' padahal membutuhkan zona ' || v_req_temp || '. Segera pindahkan!', NEW.current_lot_id
      FROM public.users WHERE role = 'warehouse';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS warehouse_mismatch_trigger ON public.warehouse_slots;
CREATE TRIGGER warehouse_mismatch_trigger
AFTER UPDATE ON public.warehouse_slots
FOR EACH ROW EXECUTE FUNCTION notify_cold_mismatch();
