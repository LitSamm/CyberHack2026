-- Material-level QC support for existing AromOS Supabase projects.
-- Run this once after the original schema.sql has been applied.

ALTER TABLE public.qc_checks
  ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES public.incoming_materials(id) ON DELETE CASCADE;

ALTER TABLE public.qc_checks
  DROP CONSTRAINT IF EXISTS qc_checks_exactly_one_subject;

ALTER TABLE public.qc_checks
  ADD CONSTRAINT qc_checks_exactly_one_subject
  CHECK ((material_id IS NOT NULL) <> (lot_id IS NOT NULL));
