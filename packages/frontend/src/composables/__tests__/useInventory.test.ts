import { describe, it, expect, beforeEach, vi } from 'vitest';
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
