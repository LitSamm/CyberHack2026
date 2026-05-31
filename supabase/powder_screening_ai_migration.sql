-- Apply after demo_ready_operations_migration.sql.
-- Persists OpenCV powder-screening recommendations separately from operator QC values.

DROP FUNCTION IF EXISTS public.submit_finished_product_qc(UUID, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT);

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
    jsonb_build_object('lot_id', p_lot_id, 'result', p_result, 'ai_used', p_ai_recommendation IS NOT NULL));
  RETURN v_check_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_finished_product_qc(UUID, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_finished_product_qc(UUID, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, TEXT) TO authenticated;

