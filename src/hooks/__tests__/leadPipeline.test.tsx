/** @jest-environment jsdom */
import {
  stageLabel,
  stageColorClass,
  stageOrder,
  stageProgressPercent,
  isTerminalStage,
  sortLeadsByStage,
  countLeadsByStage,
} from '../../utils/leadPipeline';

describe('stageLabel', () => {
  it('returns human-readable labels for known stages', () => {
    expect(stageLabel('new')).toBe('New');
    expect(stageLabel('contacted')).toBe('Contacted');
    expect(stageLabel('qualified')).toBe('Qualified');
    expect(stageLabel('site_visited')).toBe('Site Visited');
    expect(stageLabel('negotiating')).toBe('Negotiating');
    expect(stageLabel('booked')).toBe('Booked');
    expect(stageLabel('lost')).toBe('Lost');
  });

  it('returns raw string for unknown stage', () => {
    expect(stageLabel('pipeline_stage_x')).toBe('pipeline_stage_x');
    expect(stageLabel('')).toBe('');
  });
});

describe('stageColorClass', () => {
  it('returns specific classes for known stages', () => {
    expect(stageColorClass('new')).toBe('badge-neutral');
    expect(stageColorClass('booked')).toBe('badge-success');
    expect(stageColorClass('lost')).toBe('badge-danger');
    expect(stageColorClass('qualified')).toBe('badge-info');
    expect(stageColorClass('negotiating')).toBe('badge-purple');
  });

  it('returns badge-neutral as default', () => {
    expect(stageColorClass('unknown')).toBe('badge-neutral');
    expect(stageColorClass('')).toBe('badge-neutral');
  });
});

describe('stageOrder', () => {
  it('orders all stages correctly', () => {
    expect(stageOrder('new')).toBe(0);
    expect(stageOrder('contacted')).toBe(1);
    expect(stageOrder('qualified')).toBe(2);
    expect(stageOrder('site_visited')).toBe(3);
    expect(stageOrder('negotiating')).toBe(4);
    expect(stageOrder('booked')).toBe(5);
    expect(stageOrder('lost')).toBe(6);
  });

  it('returns -1 for unknown stages', () => {
    expect(stageOrder('unknown')).toBe(-1);
  });
});

describe('stageProgressPercent', () => {
  it('returns 0 for new', () => {
    expect(stageProgressPercent('new')).toBe(0);
  });

  it('returns 100 for booked', () => {
    expect(stageProgressPercent('booked')).toBe(100);
  });

  it('returns intermediate value for mid-stage', () => {
    const p = stageProgressPercent('negotiating');
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(100);
  });

  it('returns 0 for lost (not in active stages)', () => {
    expect(stageProgressPercent('lost')).toBe(0);
  });

  it('returns 0 for unknown stage', () => {
    expect(stageProgressPercent('unknown')).toBe(0);
  });
});

describe('isTerminalStage', () => {
  it('marks booked and lost as terminal', () => {
    expect(isTerminalStage('booked')).toBe(true);
    expect(isTerminalStage('lost')).toBe(true);
  });

  it('marks all active stages as non-terminal', () => {
    for (const s of ['new', 'contacted', 'qualified', 'site_visited', 'negotiating']) {
      expect(isTerminalStage(s)).toBe(false);
    }
  });

  it('returns false for unknown stage', () => {
    expect(isTerminalStage('unknown')).toBe(false);
  });
});

describe('sortLeadsByStage', () => {
  it('sorts leads by stage order ascending', () => {
    const leads = [
      { id: '3', stage: 'negotiating' },
      { id: '1', stage: 'new' },
      { id: '2', stage: 'qualified' },
    ];
    const sorted = sortLeadsByStage(leads);
    expect(sorted[0].stage).toBe('new');
    expect(sorted[1].stage).toBe('qualified');
    expect(sorted[2].stage).toBe('negotiating');
  });

  it('does not mutate the original array', () => {
    const leads = [
      { id: '2', stage: 'booked' },
      { id: '1', stage: 'new' },
    ];
    const original = [...leads];
    sortLeadsByStage(leads);
    expect(leads).toEqual(original);
  });

  it('returns empty array for empty input', () => {
    expect(sortLeadsByStage([])).toEqual([]);
  });
});

describe('countLeadsByStage', () => {
  it('counts leads by stage', () => {
    const leads = [
      { stage: 'new' },
      { stage: 'new' },
      { stage: 'qualified' },
      { stage: 'booked' },
    ];
    const counts = countLeadsByStage(leads);
    expect(counts['new']).toBe(2);
    expect(counts['qualified']).toBe(1);
    expect(counts['booked']).toBe(1);
  });

  it('returns empty object for no leads', () => {
    expect(countLeadsByStage([])).toEqual({});
  });

  it('handles mixed known and unknown stages', () => {
    const leads = [{ stage: 'new' }, { stage: 'custom_stage' }];
    const counts = countLeadsByStage(leads);
    expect(counts['new']).toBe(1);
    expect(counts['custom_stage']).toBe(1);
  });
});
