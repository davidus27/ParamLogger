import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TreePanel from '../TreePanel.vue';
import type { Parameter } from '@param-logger/shared';
import { ParameterLocation, ValueType } from '@param-logger/shared';
import type { ScopeSelection } from '../../composables/useSelection';

function makeEndpoint(
  method = 'GET',
  path = '/api/users',
  params: Partial<Parameter>[] = [],
) {
  return {
    method,
    path,
    params: params.map(p => ({
      id: 'p1',
      domain: 'example.com',
      method,
      normalizedPath: path,
      location: ParameterLocation.QUERY,
      name: 'foo',
      valueTypes: [] as ValueType[],
      flags: [],
      count: 1,
      firstSeen: new Date(),
      lastSeen: new Date(),
      ...p,
    })) as Parameter[],
  };
}

function makeTree(domains: Array<{ name: string; paramCount?: number; endpoints?: ReturnType<typeof makeEndpoint>[] }>) {
  return domains.map(d => ({
    name: d.name,
    paramCount: d.paramCount ?? 1,
    endpoints: d.endpoints ?? [makeEndpoint()],
  }));
}

function mountTree(overrides: Record<string, unknown> = {}) {
  return mount(TreePanel, {
    props: {
      tree: [],
      treeFilter: '',
      selectedScope: null as ScopeSelection,
      openDomains: new Set<string>(),
      sidebarOpen: false,
      scopedParameterCount: 0,
      ...overrides,
    },
  });
}

describe('TreePanel', () => {
  describe('DOM structure', () => {
    it('renders aside with inv-tree-panel class', () => {
      const wrapper = mountTree();
      expect(wrapper.find('aside.inv-tree-panel').exists()).toBe(true);
    });

    it('adds sidebar-open class when sidebarOpen is true', () => {
      const wrapper = mountTree({ sidebarOpen: true });
      expect(wrapper.find('aside.inv-tree-panel').classes()).toContain('sidebar-open');
    });

    it('does not add sidebar-open class when sidebarOpen is false', () => {
      const wrapper = mountTree({ sidebarOpen: false });
      expect(wrapper.find('aside.inv-tree-panel').classes()).not.toContain('sidebar-open');
    });

    it('renders the tree filter input', () => {
      const wrapper = mountTree();
      expect(wrapper.find('input.inv-tree-search').exists()).toBe(true);
    });

    it('binds treeFilter to the input value', () => {
      const wrapper = mountTree({ treeFilter: 'api' });
      const input = wrapper.find('input.inv-tree-search').element as HTMLInputElement;
      expect(input.value).toBe('api');
    });
  });

  describe('"All targets" row', () => {
    it('renders the "All targets" row', () => {
      const wrapper = mountTree();
      expect(wrapper.text()).toContain('All targets');
    });

    it('shows scopedParameterCount in the All targets row', () => {
      const wrapper = mountTree({ scopedParameterCount: 42 });
      const allRow = wrapper.find('.inv-tree-row');
      expect(allRow.text()).toContain('42');
    });

    it('marks All targets row as selected when selectedScope is null', () => {
      const wrapper = mountTree({ selectedScope: null });
      expect(wrapper.find('.inv-tree-row').classes()).toContain('selected');
    });

    it('does not mark All targets row as selected when selectedScope is set', () => {
      const wrapper = mountTree({ selectedScope: { domain: 'example.com' } });
      expect(wrapper.find('.inv-tree-row').classes()).not.toContain('selected');
    });

    it('emits "select-scope" with null when All targets row is clicked', async () => {
      const wrapper = mountTree();
      await wrapper.find('.inv-tree-row').trigger('click');
      expect(wrapper.emitted('select-scope')).toEqual([[null]]);
    });
  });

  describe('domain rows', () => {
    it('renders domain rows', () => {
      const wrapper = mountTree({ tree: makeTree([{ name: 'example.com' }]) });
      expect(wrapper.findAll('.tree-domain')).toHaveLength(1);
    });

    it('shows domain name', () => {
      const wrapper = mountTree({ tree: makeTree([{ name: 'api.example.com' }]) });
      expect(wrapper.find('.tree-domain').text()).toContain('api.example.com');
    });

    it('shows domain paramCount', () => {
      const wrapper = mountTree({ tree: makeTree([{ name: 'x.com', paramCount: 7 }]) });
      expect(wrapper.find('.tree-domain').text()).toContain('7');
    });

    it('marks domain as selected when isDomainSelected returns true', () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'example.com' }]),
        selectedScope: { domain: 'example.com' },
      });
      expect(wrapper.find('.tree-domain').classes()).toContain('selected');
    });

    it('does not mark domain as selected when different scope', () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'example.com' }]),
        selectedScope: { domain: 'other.com' },
      });
      expect(wrapper.find('.tree-domain').classes()).not.toContain('selected');
    });

    it('does not mark domain as selected when an endpoint within it is selected', () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'example.com' }]),
        selectedScope: { domain: 'example.com', method: 'GET', path: '/api' },
      });
      expect(wrapper.find('.tree-domain').classes()).not.toContain('selected');
    });

    it('emits "toggle-domain" with domain name when domain row is clicked', async () => {
      const wrapper = mountTree({ tree: makeTree([{ name: 'example.com' }]) });
      await wrapper.find('.tree-domain').trigger('click');
      expect(wrapper.emitted('toggle-domain')).toEqual([['example.com']]);
    });

    it('shows expand arrow as open when domain is in openDomains', () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'example.com' }]),
        openDomains: new Set(['example.com']),
      });
      expect(wrapper.find('.tree-domain .inv-tree-arrow').classes()).toContain('open');
    });

    it('does not show expand arrow as open when domain not in openDomains', () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'example.com' }]),
        openDomains: new Set<string>(),
      });
      expect(wrapper.find('.tree-domain .inv-tree-arrow').classes()).not.toContain('open');
    });
  });

  describe('endpoint rows', () => {
    it('hides endpoint rows when domain is not open', () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'example.com', endpoints: [makeEndpoint('GET', '/api')] }]),
        openDomains: new Set<string>(),
      });
      expect(wrapper.findAll('.tree-endpoint')).toHaveLength(0);
    });

    it('shows endpoint rows when domain is open', () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'example.com', endpoints: [makeEndpoint('GET', '/api')] }]),
        openDomains: new Set(['example.com']),
      });
      expect(wrapper.findAll('.tree-endpoint')).toHaveLength(1);
    });

    it('shows method badge and path for endpoints', () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'example.com', endpoints: [makeEndpoint('POST', '/submit')] }]),
        openDomains: new Set(['example.com']),
      });
      const ep = wrapper.find('.tree-endpoint');
      expect(ep.text()).toContain('POST');
      expect(ep.text()).toContain('/submit');
    });

    it('emits "select-scope" with endpoint scope on click', async () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'example.com', endpoints: [makeEndpoint('GET', '/api')] }]),
        openDomains: new Set(['example.com']),
      });
      await wrapper.find('.tree-endpoint').trigger('click');
      expect(wrapper.emitted('select-scope')).toEqual([
        [{ domain: 'example.com', method: 'GET', path: '/api' }],
      ]);
    });

    it('marks endpoint as selected when isEndpointSelected returns true', () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'example.com', endpoints: [makeEndpoint('GET', '/api')] }]),
        openDomains: new Set(['example.com']),
        selectedScope: { domain: 'example.com', method: 'GET', path: '/api' },
      });
      expect(wrapper.find('.tree-endpoint').classes()).toContain('selected');
    });

    it('does not mark endpoint as selected when different path', () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'example.com', endpoints: [makeEndpoint('GET', '/api')] }]),
        openDomains: new Set(['example.com']),
        selectedScope: { domain: 'example.com', method: 'GET', path: '/other' },
      });
      expect(wrapper.find('.tree-endpoint').classes()).not.toContain('selected');
    });
  });

  describe('toolbar buttons', () => {
    it('emits "collapse-all" when collapse button is clicked', async () => {
      const wrapper = mountTree();
      await wrapper.find('button[title="Collapse all"]').trigger('click');
      expect(wrapper.emitted('collapse-all')).toHaveLength(1);
    });

    it('emits "expand-all" when expand button is clicked', async () => {
      const wrapper = mountTree();
      await wrapper.find('button[title="Expand all"]').trigger('click');
      expect(wrapper.emitted('expand-all')).toHaveLength(1);
    });

    it('emits "update:treeFilter" with new value when filter input changes', async () => {
      const wrapper = mountTree();
      await wrapper.find('input.inv-tree-search').setValue('api');
      expect(wrapper.emitted('update:treeFilter')).toEqual([['api']]);
    });
  });

  describe('multiple domains', () => {
    it('renders all domain rows', () => {
      const wrapper = mountTree({
        tree: makeTree([{ name: 'a.com' }, { name: 'b.com' }, { name: 'c.com' }]),
      });
      expect(wrapper.findAll('.tree-domain')).toHaveLength(3);
    });
  });
});
