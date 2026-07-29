import rulesEngine, { RuleCondition } from '../rulesEngine';
import { WorkItem } from '../adoService';

const baseItem: WorkItem = {
  id: 101,
  title: 'Fix login bug',
  state: 'In Progress',
  type: 'Task',
  assignedTo: '',
  effort: null,
  priority: 1,
  tags: ['urgent', 'pr-merged'],
  createdDate: '2026-07-01T00:00:00.000Z',
  updatedDate: '2026-07-20T00:00:00.000Z',
  description: 'Needs attention',
  url: 'https://example.com/101',
};

describe('RulesEngine condition evaluation', () => {
  test('matches equals + days_since with AND', () => {
    const conditions: RuleCondition[] = [
      { field: 'state', operator: 'equals', value: 'In Progress' },
      { field: 'updatedDate', operator: 'days_since', value: 5, logicalOperator: 'AND' },
    ];

    expect(rulesEngine.evaluateConditions(conditions, baseItem)).toBe(true);
  });

  test('detects unassigned high priority via is_null', () => {
    const conditions: RuleCondition[] = [
      { field: 'priority', operator: 'in', value: [1, 2, 'Critical', 'High'] },
      { field: 'assignedTo', operator: 'is_null', value: null, logicalOperator: 'AND' },
    ];

    expect(rulesEngine.evaluateConditions(conditions, baseItem)).toBe(true);
  });

  test('matches tag contains', () => {
    const conditions: RuleCondition[] = [
      { field: 'tags', operator: 'contains', value: 'pr-merged' },
    ];

    expect(rulesEngine.evaluateConditions(conditions, baseItem)).toBe(true);
  });

  test('changedDate alias maps to updatedDate', () => {
    const conditions: RuleCondition[] = [
      { field: 'changedDate', operator: 'days_since', value: 1 },
    ];

    expect(rulesEngine.evaluateConditions(conditions, baseItem)).toBe(true);
  });

  test('OR logic short-circuits correctly', () => {
    const conditions: RuleCondition[] = [
      { field: 'state', operator: 'equals', value: 'Done' },
      { field: 'state', operator: 'equals', value: 'In Progress', logicalOperator: 'OR' },
    ];

    expect(rulesEngine.evaluateConditions(conditions, baseItem)).toBe(true);
  });
});
