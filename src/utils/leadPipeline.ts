export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'site_visited'
  | 'negotiating'
  | 'booked'
  | 'lost';

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  site_visited: 'Site Visited',
  negotiating: 'Negotiating',
  booked: 'Booked',
  lost: 'Lost',
};

const STAGE_COLOR_CLASSES: Record<string, string> = {
  new: 'badge-neutral',
  contacted: 'badge-primary',
  qualified: 'badge-info',
  site_visited: 'badge-warning',
  negotiating: 'badge-purple',
  booked: 'badge-success',
  lost: 'badge-danger',
};

const STAGE_ORDER_MAP: Record<string, number> = {
  new: 0,
  contacted: 1,
  qualified: 2,
  site_visited: 3,
  negotiating: 4,
  booked: 5,
  lost: 6,
};

const ACTIVE_STAGES: LeadStage[] = [
  'new',
  'contacted',
  'qualified',
  'site_visited',
  'negotiating',
  'booked',
];

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function stageColorClass(stage: string): string {
  return STAGE_COLOR_CLASSES[stage] ?? 'badge-neutral';
}

export function stageOrder(stage: string): number {
  return STAGE_ORDER_MAP[stage] ?? -1;
}

export function stageProgressPercent(stage: string): number {
  const idx = ACTIVE_STAGES.indexOf(stage as LeadStage);
  if (idx === -1) return 0;
  return Math.round((idx / (ACTIVE_STAGES.length - 1)) * 100);
}

export function isTerminalStage(stage: string): boolean {
  return stage === 'booked' || stage === 'lost';
}

export function sortLeadsByStage<T extends { stage: string }>(leads: T[]): T[] {
  return [...leads].sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage));
}

export function countLeadsByStage(leads: { stage: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const lead of leads) {
    counts[lead.stage] = (counts[lead.stage] ?? 0) + 1;
  }
  return counts;
}
