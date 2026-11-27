import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { Parameter } from '@param-logger/shared';
import { ParameterLocation } from '@param-logger/shared';

type Scope = { id: string; name: string; allowlist: string[]; denylist: string[] };

function makeParam(id: string, domain: string): Parameter {
  return {
    id,
    domain,
    method: 'GET',
    normalizedPath: '/api',
    location: ParameterLocation.QUERY,
    name: id,
    valueTypes: [],
    flags: [],
    count: 1,
    firstSeen: new Date(),
    lastSeen: new Date(),
  };
}

const everything: Scope = { id: 's1', name: 'everything', allowlist: [], denylist: [] };
const notB: Scope = { id: 's2', name: 'not b', allowlist: [], denylist: ['b.com'] };

function createCaido(parameters: Parameter[], scope: Scope | undefined) {
  let current = scope;
  const scopeListeners: Array<(e: { scopeId: string | undefined }) => void> = [];
  const caido = {
    backend: {
      getInventory: vi.fn(async () => parameters),
      getDomains: vi.fn(async () => []),
      getStats: vi.fn(async () => ({
        totalRequests: 0,
        totalParams: parameters.length,
        uniqueParams: parameters.length,
        domains: 0,
        endpoints: 0,
      })),
      getCurrentProject: vi.fn(async () => ({ projectId: 'p1', projectName: 'Project' })),
      onEvent: vi.fn(() => ({ stop: () => {} })),
    },
    scopes: {
      getCurrentScope: () => current,
      onCurrentScopeChange: (cb: (typeof scopeListeners)[number]) => {
        scopeListeners.push(cb);
        return { stop: () => {} };
      },
    },
    navigation: {
      onPageChange: () => ({ stop: () => {} }),
      goTo: vi.fn(),
    },
  };
  return {
    caido,
    selectScope(next: Scope | undefined) {
      current = next;
      scopeListeners.forEach(cb => cb({ scopeId: next?.id }));
    },
  };
}

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
});

// App's composables are module singletons; reset modules for a clean slate.
async function mountApp(parameters: Parameter[], scope: Scope | undefined) {
  vi.resetModules();
  const App = (await import('../App.vue')).default;
  const sdk = createCaido(parameters, scope);
  wrapper = mount(App, { attachTo: document.body, global: { provide: { caido: sdk.caido } } });
  await flushPromises();
  return { ...sdk, wrapper };
}

const inventory = [makeParam('a1', 'a.com'), makeParam('b1', 'b.com')];

describe('App — scope changes', () => {
  it('loads the inventory once on mount, including when a scope is already selected', async () => {
    const { caido } = await mountApp(inventory, everything);
    expect(caido.backend.getInventory).toHaveBeenCalledTimes(1);
    expect(wrapper!.findAll('.table-row')).toHaveLength(2);
  });

  it('applies a new scope to the loaded inventory without refetching it', async () => {
    const { caido, selectScope } = await mountApp(inventory, everything);

    selectScope(notB);
    await flushPromises();

    expect(caido.backend.getInventory).toHaveBeenCalledTimes(1);
    const rows = wrapper!.findAll('.table-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('a1');

    selectScope(undefined);
    await flushPromises();
    expect(caido.backend.getInventory).toHaveBeenCalledTimes(1);
    expect(wrapper!.findAll('.table-row')).toHaveLength(2);
  });

  it('resets the search filter on a scope change', async () => {
    const { selectScope } = await mountApp(inventory, everything);
    const search = wrapper!.find('input[type="text"]');
    await search.setValue('a1');
    expect(wrapper!.findAll('.table-row')).toHaveLength(1);

    selectScope(notB);
    await flushPromises();

    expect((search.element as HTMLInputElement).value).toBe('');
    expect(wrapper!.findAll('.table-row')).toHaveLength(1);
  });
});
