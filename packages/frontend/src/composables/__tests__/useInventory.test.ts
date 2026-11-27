import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { watch } from 'vue';
import type { Parameter, Domain, InventoryStats } from '@param-logger/shared';
import { ParameterLocation, ValueType, Flag } from '@param-logger/shared';

// useInventory uses module-level Maps/refs as a singleton. Reset modules
// between tests to get a clean slate.

function makeParam(overrides: Partial<Parameter> = {}): Parameter {
  return {
    id: 'p1',
    domain: 'example.com',
    method: 'GET',
    normalizedPath: '/api/test',
    location: ParameterLocation.QUERY,
    name: 'q',
    valueTypes: [],
    flags: [],
    count: 1,
    firstSeen: new Date(),
    lastSeen: new Date(),
    ...overrides,
  };
}

async function freshInventory() {
  vi.resetModules();
  const mod = await import('../useInventory');
  return mod.useInventory();
}

describe('useInventory — updateParameters', () => {
  it('replaces existing parameters with new set', async () => {
    const inv = await freshInventory();
    inv.updateParameters([makeParam({ id: 'old' })]);
    inv.updateParameters([makeParam({ id: 'new1' }), makeParam({ id: 'new2' })]);
    const ids = inv.parameters.value.map(p => p.id);
    expect(ids).not.toContain('old');
    expect(ids).toContain('new1');
    expect(ids).toContain('new2');
  });

  it('sets parameters to empty array when called with []', async () => {
    const inv = await freshInventory();
    inv.updateParameters([makeParam()]);
    inv.updateParameters([]);
    expect(inv.parameters.value).toHaveLength(0);
  });

  it('parameters array is frozen', async () => {
    const inv = await freshInventory();
    inv.updateParameters([makeParam()]);
    expect(Object.isFrozen(inv.parameters.value)).toBe(true);
  });
});

describe('useInventory — upsertParameters', () => {
  it('adds new parameters incrementally', async () => {
    const inv = await freshInventory();
    inv.upsertParameters([makeParam({ id: 'p1' })]);
    inv.upsertParameters([makeParam({ id: 'p2' })]);
    const ids = inv.parameters.value.map(p => p.id);
    expect(ids).toContain('p1');
    expect(ids).toContain('p2');
  });

  it('updates an existing parameter in place', async () => {
    const inv = await freshInventory();
    inv.upsertParameters([makeParam({ id: 'p1', count: 1 })]);
    inv.upsertParameters([makeParam({ id: 'p1', count: 99 })]);
    const p = inv.parameters.value.find(x => x.id === 'p1');
    expect(p?.count).toBe(99);
    expect(inv.parameters.value).toHaveLength(1);
  });

  it('parameters array is frozen after upsert', async () => {
    const inv = await freshInventory();
    inv.upsertParameters([makeParam()]);
    expect(Object.isFrozen(inv.parameters.value)).toBe(true);
  });
});

describe('useInventory — clearInventory', () => {
  it('empties parameters', async () => {
    const inv = await freshInventory();
    inv.updateParameters([makeParam()]);
    inv.clearInventory();
    expect(inv.parameters.value).toHaveLength(0);
  });

  it('empties domains', async () => {
    const inv = await freshInventory();
    inv.updateDomains([{ name: 'example.com', count: 1 }]);
    inv.clearInventory();
    expect(inv.domains.value).toHaveLength(0);
  });

  it('resets stats to zeros', async () => {
    const inv = await freshInventory();
    inv.updateStats({ totalRequests: 5, uniqueParams: 3, domains: 2 } as any);
    inv.clearInventory();
    expect(inv.stats.totalRequests).toBe(0);
    expect(inv.stats.uniqueParams).toBe(0);
    expect(inv.stats.domains).toBe(0);
  });
});

describe('useInventory — updateDomains', () => {
  it('replaces domains', async () => {
    const inv = await freshInventory();
    inv.updateDomains([{ name: 'a.com', count: 1 }]);
    inv.updateDomains([{ name: 'b.com', count: 2 }, { name: 'c.com', count: 3 }]);
    const names = inv.domains.value.map(d => d.name);
    expect(names).not.toContain('a.com');
    expect(names).toContain('b.com');
    expect(names).toContain('c.com');
  });
});

describe('useInventory — updateStats', () => {
  it('merges stats values', async () => {
    const inv = await freshInventory();
    inv.updateStats({ totalRequests: 42, uniqueParams: 10, domains: 3 } as any);
    expect(inv.stats.totalRequests).toBe(42);
    expect(inv.stats.uniqueParams).toBe(10);
    expect(inv.stats.domains).toBe(3);
  });
});

describe('useInventory — setLoading', () => {
  it('sets isLoading to true', async () => {
    const inv = await freshInventory();
    inv.setLoading(true);
    expect(inv.isLoading.value).toBe(true);
  });

  it('sets isLoading to false', async () => {
    const inv = await freshInventory();
    inv.setLoading(true);
    inv.setLoading(false);
    expect(inv.isLoading.value).toBe(false);
  });
});

describe('useInventory — tree computed', () => {
  it('is empty when no parameters loaded', async () => {
    const inv = await freshInventory();
    expect(inv.tree.value).toHaveLength(0);
  });

  it('groups parameters by domain', async () => {
    const inv = await freshInventory();
    inv.updateParameters([
      makeParam({ id: 'p1', domain: 'a.com', method: 'GET', normalizedPath: '/api' }),
      makeParam({ id: 'p2', domain: 'b.com', method: 'GET', normalizedPath: '/other' }),
    ]);
    const domains = inv.tree.value.map(d => d.name).sort();
    expect(domains).toEqual(['a.com', 'b.com']);
  });

  it('groups parameters by endpoint within a domain', async () => {
    const inv = await freshInventory();
    inv.updateParameters([
      makeParam({ id: 'p1', domain: 'a.com', method: 'GET', normalizedPath: '/api/foo' }),
      makeParam({ id: 'p2', domain: 'a.com', method: 'POST', normalizedPath: '/api/bar' }),
    ]);
    const domain = inv.tree.value.find(d => d.name === 'a.com')!;
    expect(domain.endpoints).toHaveLength(2);
  });

  it('paramCount equals total params in domain', async () => {
    const inv = await freshInventory();
    inv.updateParameters([
      makeParam({ id: 'p1', domain: 'a.com', method: 'GET', normalizedPath: '/ep1' }),
      makeParam({ id: 'p2', domain: 'a.com', method: 'GET', normalizedPath: '/ep1' }),
      makeParam({ id: 'p3', domain: 'a.com', method: 'POST', normalizedPath: '/ep2' }),
    ]);
    const domain = inv.tree.value.find(d => d.name === 'a.com')!;
    expect(domain.paramCount).toBe(3);
  });

  it('domains are sorted alphabetically', async () => {
    const inv = await freshInventory();
    inv.updateParameters([
      makeParam({ id: 'p1', domain: 'z.com', method: 'GET', normalizedPath: '/a' }),
      makeParam({ id: 'p2', domain: 'a.com', method: 'GET', normalizedPath: '/b' }),
      makeParam({ id: 'p3', domain: 'm.com', method: 'GET', normalizedPath: '/c' }),
    ]);
    const names = inv.tree.value.map(d => d.name);
    expect(names).toEqual(['a.com', 'm.com', 'z.com']);
  });

  it('endpoints within a domain are sorted by path+method', async () => {
    const inv = await freshInventory();
    inv.updateParameters([
      makeParam({ id: 'p1', domain: 'a.com', method: 'POST', normalizedPath: '/z' }),
      makeParam({ id: 'p2', domain: 'a.com', method: 'GET', normalizedPath: '/a' }),
    ]);
    const domain = inv.tree.value.find(d => d.name === 'a.com')!;
    expect(domain.endpoints[0].path).toBe('/a');
    expect(domain.endpoints[1].path).toBe('/z');
  });

  it('updates reactively after upsertParameters', async () => {
    const inv = await freshInventory();
    inv.updateParameters([makeParam({ id: 'p1', domain: 'a.com', method: 'GET', normalizedPath: '/x' })]);
    expect(inv.tree.value).toHaveLength(1);
    inv.upsertParameters([makeParam({ id: 'p2', domain: 'b.com', method: 'GET', normalizedPath: '/y' })]);
    expect(inv.tree.value).toHaveLength(2);
  });

  it('updates reactively after clearInventory', async () => {
    const inv = await freshInventory();
    inv.updateParameters([makeParam()]);
    inv.clearInventory();
    expect(inv.tree.value).toHaveLength(0);
  });
});

// The tree as it was built before it became incremental: regroup and sort
// the whole published inventory.
function fullTree(params: readonly Parameter[]) {
  const domainMap = new Map<string, Map<string, Parameter[]>>();
  for (const param of params) {
    let endpointMap = domainMap.get(param.domain);
    if (!endpointMap) domainMap.set(param.domain, (endpointMap = new Map()));
    const key = `${param.method} ${param.normalizedPath}`;
    let bucket = endpointMap.get(key);
    if (!bucket) endpointMap.set(key, (bucket = []));
    bucket.push(param);
  }
  const result = [];
  for (const [name, endpointMap] of domainMap) {
    const endpoints = Array.from(endpointMap, ([key, ps]) => {
      const [method, path] = key.split(' ', 2);
      return { method, path, params: ps };
    }).sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
    result.push({ name, paramCount: endpoints.reduce((s, e) => s + e.params.length, 0), endpoints });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

function randomParam(rand: () => number, count: number): Parameter {
  const domain = `d${Math.floor(rand() * 12)}.com`;
  const method = rand() < 0.7 ? 'GET' : 'POST';
  const normalizedPath = `/p${Math.floor(rand() * 6)}`;
  const name = `n${Math.floor(rand() * 8)}`;
  return makeParam({
    id: `${domain}:${method}:${normalizedPath}:query:${name}`,
    domain,
    method,
    normalizedPath,
    name,
    count,
  });
}

describe('useInventory — incremental tree', () => {
  it('equals a full rebuild after random batches', async () => {
    const inv = await freshInventory();
    const rand = seededRandom(23);
    inv.updateParameters(Array.from({ length: 40 }, (_, i) => randomParam(rand, i)));
    expect(inv.tree.value).toEqual(fullTree(inv.parameters.value));

    for (let round = 0; round < 60; round++) {
      const size = Math.floor(rand() * 15);
      inv.upsertParameters(Array.from({ length: size }, () => randomParam(rand, round)));
      if (round === 30) {
        inv.updateParameters(Array.from({ length: 25 }, () => randomParam(rand, round)));
      }
      expect(inv.tree.value).toEqual(fullTree(inv.parameters.value));
    }
  });

  it('keeps parameters in first-seen order when a known one is updated', async () => {
    const inv = await freshInventory();
    inv.upsertParameters([
      makeParam({ id: 'a', count: 1 }),
      makeParam({ id: 'b', count: 1 }),
      makeParam({ id: 'c', count: 1 }),
    ]);
    inv.upsertParameters([makeParam({ id: 'a', count: 2 })]);
    const params = inv.tree.value[0].endpoints[0].params;
    expect(params.map(p => p.id)).toEqual(['a', 'b', 'c']);
    expect(params[0].count).toBe(2);
  });

  it('reuses the nodes of domains a batch did not touch', async () => {
    const inv = await freshInventory();
    inv.updateParameters([
      makeParam({ id: 'a1', domain: 'a.com' }),
      makeParam({ id: 'b1', domain: 'b.com' }),
    ]);
    const [aBefore, bBefore] = inv.tree.value;

    inv.upsertParameters([makeParam({ id: 'b2', domain: 'b.com', name: 'other' })]);
    const [aAfter, bAfter] = inv.tree.value;
    expect(aAfter).toBe(aBefore);
    expect(bAfter).not.toBe(bBefore);
    expect(bAfter.paramCount).toBe(2);
  });

  it('keeps the same tree array when a publish touches no domain', async () => {
    const inv = await freshInventory();
    inv.updateParameters([makeParam({ id: 'a1' })]);
    const before = inv.tree.value;
    inv.upsertParameters([]);
    expect(inv.tree.value).toBe(before);
  });

  it('sorts a domain added later into place', async () => {
    const inv = await freshInventory();
    inv.updateParameters([makeParam({ id: 'm', domain: 'm.com' }), makeParam({ id: 'z', domain: 'z.com' })]);
    inv.upsertParameters([makeParam({ id: 'a', domain: 'a.com' })]);
    expect(inv.tree.value.map(d => d.name)).toEqual(['a.com', 'm.com', 'z.com']);
  });

  it('drops domains that a full update no longer has', async () => {
    const inv = await freshInventory();
    inv.updateParameters([makeParam({ id: 'a', domain: 'a.com' }), makeParam({ id: 'b', domain: 'b.com' })]);
    inv.updateParameters([makeParam({ id: 'b', domain: 'b.com' })]);
    expect(inv.tree.value.map(d => d.name)).toEqual(['b.com']);
  });
});

describe('useInventory — while the page is hidden', () => {
  let stopTracking: (() => void) | undefined;

  afterEach(() => {
    stopTracking?.();
    stopTracking = undefined;
    document.body.innerHTML = '';
  });

  // Must run after freshInventory() so both share one usePageVisibility module.
  async function trackPage(root: HTMLElement = document.createElement('div')) {
    const { usePageVisibility } = await import('../usePageVisibility');
    const listeners: Array<(e: { type: 'Plugin'; path: string }) => void> = [];
    const caido = {
      navigation: {
        onPageChange: (cb: (typeof listeners)[number]) => {
          listeners.push(cb);
          return { stop: () => listeners.splice(listeners.indexOf(cb), 1) };
        },
      },
    } as any;
    const visibility = usePageVisibility();
    visibility.start(root, caido);
    stopTracking = visibility.stop;
    return (path: string) => listeners.forEach(cb => cb({ type: 'Plugin', path }));
  }

  function countPublishes(inv: Awaited<ReturnType<typeof freshInventory>>) {
    let publishes = 0;
    watch(inv.parameters, () => { publishes++; }, { flush: 'sync' });
    return () => publishes;
  }

  it('does not publish upserts or full updates', async () => {
    const inv = await freshInventory();
    await trackPage();
    const publishes = countPublishes(inv);

    inv.updateParameters([makeParam({ id: 'p1' })]);
    inv.upsertParameters([makeParam({ id: 'p2', domain: 'b.com' })]);

    expect(publishes()).toBe(0);
    expect(inv.parameters.value).toHaveLength(0);
    expect(inv.tree.value).toHaveLength(0);
  });

  it('publishes once, with the latest inventory, when the page is shown', async () => {
    const inv = await freshInventory();
    const go = await trackPage();
    const publishes = countPublishes(inv);

    inv.updateParameters([makeParam({ id: 'p1', count: 1 }), makeParam({ id: 'p2' })]);
    inv.upsertParameters([makeParam({ id: 'p1', count: 7 })]);
    inv.upsertParameters([makeParam({ id: 'p3', domain: 'b.com' })]);
    go('/param-logger');

    expect(publishes()).toBe(1);
    expect(inv.parameters.value.map(p => p.id).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(inv.parameters.value.find(p => p.id === 'p1')?.count).toBe(7);
    expect(Object.isFrozen(inv.parameters.value)).toBe(true);
    expect(inv.tree.value.map(d => d.name)).toEqual(['b.com', 'example.com']);
  });

  it('does not publish on show when nothing changed while hidden', async () => {
    const inv = await freshInventory();
    const go = await trackPage();
    const publishes = countPublishes(inv);
    go('/param-logger');
    expect(publishes()).toBe(0);
  });

  it('defers again once the page is hidden again', async () => {
    const inv = await freshInventory();
    const go = await trackPage();
    go('/param-logger');
    inv.upsertParameters([makeParam({ id: 'p1' })]);
    expect(inv.parameters.value).toHaveLength(1);

    go('/replay');
    inv.upsertParameters([makeParam({ id: 'p2' })]);
    expect(inv.parameters.value).toHaveLength(1);

    go('/param-logger');
    expect(inv.parameters.value).toHaveLength(2);
  });

  it('clears immediately, and drops the pending publish', async () => {
    const inv = await freshInventory();
    inv.updateParameters([makeParam({ id: 'old' })]);
    const go = await trackPage();
    inv.upsertParameters([makeParam({ id: 'pending' })]);
    const publishes = countPublishes(inv);

    inv.clearInventory();
    expect(publishes()).toBe(1);
    expect(inv.parameters.value).toHaveLength(0);
    expect(inv.tree.value).toHaveLength(0);

    go('/param-logger');
    expect(publishes()).toBe(1);
    expect(inv.parameters.value).toHaveLength(0);
  });

  it('publishes rescanned parameters that arrive after a clear on show', async () => {
    const inv = await freshInventory();
    const go = await trackPage();
    inv.clearInventory();
    inv.upsertParameters([makeParam({ id: 'rescanned' })]);
    expect(inv.parameters.value).toHaveLength(0);
    go('/param-logger');
    expect(inv.parameters.value.map(p => p.id)).toEqual(['rescanned']);
  });

  it('keeps the published tree unchanged while upserts run ahead', async () => {
    const inv = await freshInventory();
    const go = await trackPage();
    go('/param-logger');
    inv.upsertParameters([makeParam({ id: 'p1', count: 1 })]);
    const published = inv.tree.value;

    go('/replay');
    inv.upsertParameters([makeParam({ id: 'p1', count: 5 }), makeParam({ id: 'p2' })]);
    expect(inv.tree.value).toBe(published);
    expect(published[0].endpoints[0].params.map(p => [p.id, p.count])).toEqual([['p1', 1]]);

    go('/param-logger');
    expect(inv.tree.value).toEqual(fullTree(inv.parameters.value));
    expect(inv.tree.value[0].paramCount).toBe(2);
  });

  it('publishes in the same call while the tracked page is shown', async () => {
    const inv = await freshInventory();
    const root = document.createElement('div');
    document.body.appendChild(root);
    await trackPage(root);
    inv.upsertParameters([makeParam({ id: 'p1' })]);
    expect(inv.parameters.value).toHaveLength(1);
  });
});
