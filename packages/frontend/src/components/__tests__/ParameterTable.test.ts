import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ParameterTable from '../ParameterTable.vue';
import type { Parameter } from '@param-logger/shared';
import { ParameterLocation, ValueType, Flag } from '@param-logger/shared';

function makeParam(overrides: Partial<Parameter> = {}): Parameter {
  return {
    id: 'param-1',
    domain: 'example.com',
    method: 'GET',
    normalizedPath: '/api/users',
    location: ParameterLocation.QUERY,
    name: 'userId',
    valueTypes: [],
    flags: [],
    count: 1,
    firstSeen: new Date(),
    lastSeen: new Date(),
    ...overrides,
  };
}

function mountTable(overrides: Record<string, unknown> = {}) {
  return mount(ParameterTable, {
    props: {
      parameters: [],
      selectedParam: null,
      rowNumWidth: 40,
      ...overrides,
    },
  });
}

describe('ParameterTable', () => {
  describe('DOM structure', () => {
    it('renders the table container', () => {
      const wrapper = mountTable();
      expect(wrapper.find('.table-container').exists()).toBe(true);
    });

    it('renders the table header', () => {
      const wrapper = mountTable();
      expect(wrapper.find('.table-header').exists()).toBe(true);
    });

    it('renders all header columns', () => {
      const wrapper = mountTable();
      const headerCells = wrapper.findAll('.table-head-cell');
      const labels = headerCells.map(c => c.text()).filter(Boolean);
      expect(labels).toContain('Parameter');
      expect(labels).toContain('Location');
      expect(labels).toContain('Endpoint');
      expect(labels).toContain('Value type');
      expect(labels).toContain('Flags');
      expect(labels).toContain('Risk');
    });

    it('applies rowNumWidth style to the row-num header cell', () => {
      const wrapper = mountTable({ rowNumWidth: 55 });
      const rowNumCell = wrapper.find('.table-head-cell.row-num');
      expect((rowNumCell.element as HTMLElement).style.width).toBe('55px');
    });
  });

  describe('empty state', () => {
    it('renders no data rows when parameters is empty', () => {
      const wrapper = mountTable({ parameters: [] });
      expect(wrapper.findAll('.table-row')).toHaveLength(0);
    });
  });

  describe('row rendering', () => {
    it('renders one row per parameter', () => {
      const wrapper = mountTable({
        parameters: [makeParam({ id: '1' }), makeParam({ id: '2' })],
      });
      expect(wrapper.findAll('.table-row')).toHaveLength(2);
    });

    it('shows parameter name in the row', () => {
      const wrapper = mountTable({ parameters: [makeParam({ name: 'csrf_token' })] });
      expect(wrapper.find('.param-name').text()).toBe('csrf_token');
    });

    it('shows location badge', () => {
      const wrapper = mountTable({ parameters: [makeParam({ location: ParameterLocation.JSON })] });
      const locSpan = wrapper.find('.loc');
      expect(locSpan.text()).toBe('json');
      expect(locSpan.classes()).toContain('loc-json');
    });

    it('shows method badge', () => {
      const wrapper = mountTable({ parameters: [makeParam({ method: 'POST' })] });
      const badge = wrapper.find('.method-badge');
      expect(badge.text()).toBe('POST');
      expect(badge.classes()).toContain('m-POST');
    });

    it('shows normalizedPath', () => {
      const wrapper = mountTable({ parameters: [makeParam({ normalizedPath: '/search' })] });
      expect(wrapper.find('.endpoint-path').text()).toBe('/search');
    });

    it('shows valueTypes joined by comma', () => {
      const wrapper = mountTable({
        parameters: [makeParam({ valueTypes: [ValueType.JWT, ValueType.BASE64] })],
      });
      expect(wrapper.find('.val-type').text()).toBe('jwt, base64');
    });

    it('shows a dash when there are no flags', () => {
      const wrapper = mountTable({ parameters: [makeParam({ flags: [] })] });
      expect(wrapper.find('.dim-dash').exists()).toBe(true);
    });

    it('shows flag badges when flags are present', () => {
      const wrapper = mountTable({
        parameters: [makeParam({ flags: [Flag.AUTH, Flag.IDOR] })],
      });
      const flags = wrapper.findAll('.flag');
      expect(flags).toHaveLength(2);
      expect(flags[0].text()).toBe('auth');
      expect(flags[1].text()).toBe('idor');
    });

    it('adds correct flag CSS class per flag', () => {
      const wrapper = mountTable({
        parameters: [makeParam({ flags: [Flag.SENSITIVE] })],
      });
      expect(wrapper.find('.flag').classes()).toContain('flag-sensitive');
    });

    it('shows row number starting at 1', () => {
      const wrapper = mountTable({
        parameters: [makeParam({ id: 'p1' }), makeParam({ id: 'p2' })],
      });
      const rowNums = wrapper.findAll('.table-cell.row-num');
      expect(rowNums[0].text()).toBe('1');
      expect(rowNums[1].text()).toBe('2');
    });

    it('applies rowNumWidth style to each row-num cell', () => {
      const wrapper = mountTable({
        parameters: [makeParam()],
        rowNumWidth: 60,
      });
      const rowNumCell = wrapper.find('.table-cell.row-num');
      expect((rowNumCell.element as HTMLElement).style.width).toBe('60px');
    });
  });

  describe('risk score', () => {
    it('renders risk-score for each row', () => {
      const wrapper = mountTable({ parameters: [makeParam()] });
      expect(wrapper.find('.risk-score').exists()).toBe(true);
    });

    it('shows a numeric risk score', () => {
      const wrapper = mountTable({ parameters: [makeParam({ flags: [], valueTypes: [], count: 1 })] });
      const score = wrapper.find('.risk-number').text();
      expect(Number(score)).toBeGreaterThanOrEqual(0);
    });

    it('renders risk-fill with correct risk class', () => {
      const wrapper = mountTable({
        parameters: [makeParam({ flags: [Flag.REFLECTED, Flag.IDOR, Flag.INJECTION], count: 100 })],
      });
      const fill = wrapper.find('.risk-fill');
      const hasRiskClass = fill.classes().some(c => c.startsWith('risk-'));
      expect(hasRiskClass).toBe(true);
    });
  });

  describe('row selection', () => {
    it('marks selected row with "selected" class', () => {
      const p = makeParam({ id: 'selected-param' });
      const wrapper = mountTable({ parameters: [p], selectedParam: p });
      expect(wrapper.find('.table-row').classes()).toContain('selected');
    });

    it('does not mark unselected rows', () => {
      const p1 = makeParam({ id: 'p1' });
      const p2 = makeParam({ id: 'p2' });
      const wrapper = mountTable({ parameters: [p1, p2], selectedParam: p2 });
      const rows = wrapper.findAll('.table-row');
      expect(rows[0].classes()).not.toContain('selected');
      expect(rows[1].classes()).toContain('selected');
    });

    it('no row has "selected" class when selectedParam is null', () => {
      const wrapper = mountTable({ parameters: [makeParam()], selectedParam: null });
      expect(wrapper.findAll('.selected')).toHaveLength(0);
    });
  });

  describe('row click event', () => {
    it('emits "row-click" with the parameter when a row is clicked', async () => {
      const p = makeParam({ id: 'click-test' });
      const wrapper = mountTable({ parameters: [p] });
      await wrapper.find('.table-row').trigger('click');
      expect(wrapper.emitted('row-click')).toEqual([[p]]);
    });
  });
});
