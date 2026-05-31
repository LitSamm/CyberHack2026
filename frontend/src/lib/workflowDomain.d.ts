export interface PipelineInput {
  materials?: Array<{ id?: string; qc_status?: string }>;
  lots?: Array<{ id?: string; material_id?: string; status?: string; created_at?: string }>;
  slots?: Array<{ is_occupied?: boolean; current_lot_id?: string | null }>;
  dispatches?: Array<{ lot_id?: string; status?: string }>;
}

export interface PipelineStage {
  id: string;
  label: string;
  count: number;
  tone: string;
}

export interface ChartInput {
  lots?: Array<{ created_at?: string }>;
  qcChecks?: Array<{ checked_at?: string }>;
  now?: Date;
}

export interface ChartPoint {
  date: string;
  name: string;
  lots: number;
  qc: number;
}

export function buildOperationsPipeline(input: PipelineInput): PipelineStage[];
export function getSevenDayProductionQcChart(input: ChartInput): ChartPoint[];
export function getLotStatusAfterWarehouseRelease(currentStatus: string): string;
export function getDispatchEffects(movementType: string, status: string): {
  releaseSlot: boolean;
  lotStatus: string | null;
};
