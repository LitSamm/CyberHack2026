-- AromOS Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'qc', 'ppic', 'warehouse')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SUPPLIERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  contact TEXT,
  material_type TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INCOMING MATERIALS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.incoming_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES public.suppliers(id),
  material_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  received_date TIMESTAMPTZ DEFAULT NOW(),
  received_by UUID REFERENCES public.users(id),
  qc_status TEXT DEFAULT 'pending' CHECK (qc_status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- LOTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_number TEXT UNIQUE NOT NULL,
  material_id UUID REFERENCES public.incoming_materials(id),
  production_date TIMESTAMPTZ,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'in_production', 'completed', 'dispatched', 'rejected')),
  created_by UUID REFERENCES public.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- QC CHECKS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.qc_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_id UUID REFERENCES public.lots(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.incoming_materials(id) ON DELETE CASCADE,
  checked_by UUID REFERENCES public.users(id),
  color_grade INTEGER CHECK (color_grade BETWEEN 1 AND 5),
  consistency_grade INTEGER CHECK (consistency_grade BETWEEN 1 AND 5),
  contamination_flag BOOLEAN DEFAULT FALSE,
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail')),
  notes TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  -- AI Integration Columns
  ai_color_grade INTEGER CHECK (ai_color_grade BETWEEN 1 AND 5),
  ai_consistency_grade INTEGER CHECK (ai_consistency_grade BETWEEN 1 AND 5),
  ai_contamination_flag BOOLEAN,
  ai_confidence NUMERIC,
  ai_recommendation TEXT CHECK (ai_recommendation IN ('approve', 'review', 'reject')),
  ai_used BOOLEAN DEFAULT FALSE,
  CONSTRAINT qc_checks_exactly_one_subject CHECK ((material_id IS NOT NULL) <> (lot_id IS NOT NULL))
);

-- =============================================
-- PPIC SCHEDULES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.ppic_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_id UUID REFERENCES public.lots(id) ON DELETE CASCADE,
  scheduled_date DATE,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'low')),
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'in_production', 'completed', 'dispatched')),
  assigned_to UUID REFERENCES public.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- WAREHOUSE SLOTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.warehouse_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_code TEXT UNIQUE NOT NULL,
  zone_row TEXT NOT NULL,
  zone_col INTEGER NOT NULL,
  temperature_zone TEXT NOT NULL CHECK (temperature_zone IN ('normal', 'cold_minus4', 'cold_minus20')),
  hazard_type TEXT CHECK (hazard_type IN ('none', 'ibc', 'ippc')),
  is_occupied BOOLEAN DEFAULT FALSE,
  current_lot_id UUID REFERENCES public.lots(id),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DISPATCHES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.dispatches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_id UUID REFERENCES public.lots(id),
  customer_name TEXT NOT NULL,
  destination TEXT NOT NULL,
  dispatch_date TIMESTAMPTZ DEFAULT NOW(),
  dispatched_by UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'prepared' CHECK (status IN ('prepared', 'shipped', 'delivered')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AUDIT LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_value JSONB,
  new_value JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ppic_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (backend uses service role key)
CREATE POLICY "Service role full access" ON public.users FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.suppliers FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.incoming_materials FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.lots FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.qc_checks FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.ppic_schedules FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.warehouse_slots FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.dispatches FOR ALL USING (true);
CREATE POLICY "Service role full access" ON public.audit_logs FOR ALL USING (true);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_lots_status ON public.lots(status);
CREATE INDEX IF NOT EXISTS idx_lots_lot_number ON public.lots(lot_number);
CREATE INDEX IF NOT EXISTS idx_materials_qc_status ON public.incoming_materials(qc_status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ppic_schedules_status ON public.ppic_schedules(status);
CREATE INDEX IF NOT EXISTS idx_warehouse_slots_is_occupied ON public.warehouse_slots(is_occupied);
