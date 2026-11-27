import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed, shallowRef } from 'vue';
import type { Parameter } from '@param-logger/shared';
import { ParameterLocation, ValueType, Flag } from '@param-logger/shared';
import { useFilters } from '../useFilters';
import type { ScopeSelection } from '../useSelection';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

let idCounter = 0;

function makeParam(overrides: Partial<Parameter> = {}): Parameter {
  idCounter++;
  return {
    id: `p${idCounter}`,
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

type TreeEndpoint = { method: string; path: string; params: Parameter[] };
type TreeNode = { name: string; paramCount: number; endpoints: TreeEndpoint[] };

/** Group parameters by domain and endpoint, as useInventory's tree does. */
function treeOf(params: Parameter[]): TreeNode[] {
  const domains = new Map<string, Map<string, TreeEndpoint>>();
  for (const p of params) {
    let endpoints = domains.get(p.domain);
    if (!endpoints) domains.set(p.domain, (endpoints = new Map()));
    const key = `${p.method} ${p.normalizedPath}`;
    let endpoint = endpoints.get(key);
    if (!endpoint) endpoints.set(key, (endpoint = { method: p.method, path: p.normalizedPath, params: [] }));
    endpoint.params.push(p);
  }
  return [...domains].map(([name, endpoints]) => ({
    name,
    paramCount: [...endpoints.values()].reduce((s, e) => s + e.params.length, 0),
    endpoints: [...endpoints.values()],
  }));
}

/**
 * Build a useFilters instance wired to the supplied parameters and tree
 * (by default the tree of those parameters, as in the app), with a
 * configurable scope selection and an isHostInScope predicate.
 */
function makeFilters(
  params: Parameter[],
  tree: TreeNode[] = treeOf(params),
  scopeValue: ScopeSelection = null,
  inScope: (host: string) => boolean = () => true,
) {
  const parametersRef = computed(() => params);
  const treeRef = computed(() => tree);
  const selectedScope = shallowRef<ScopeSelection>(scopeValue);

  const filters = useFilters(parametersRef, treeRef, inScope, selectedScope);
  return { filters, selectedScope };
}

// ────────────────────────────────────────────────────────────────────────────
// filteredParameters — scope filtering
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — scope filtering', () => {
  beforeEach(() => { idCounter = 0; });

  it('returns all in-scope params when selectedScope is null', () => {
    const params = [makeParam({ domain: 'a.com' }), makeParam({ domain: 'b.com' })];
    const { filters } = makeFilters(params, undefined, null, h => h === 'a.com');
    // only a.com is in scope
    const ids = filters.filteredParameters.value.map(p => p.domain);
    expect(ids).toEqual(['a.com']);
  });

  it('filters to domain when selectedScope has domain only', () => {
    const params = [
      makeParam({ domain: 'a.com', normalizedPath: '/x', method: 'GET' }),
      makeParam({ domain: 'b.com', normalizedPath: '/y', method: 'GET' }),
    ];
    const { filters, selectedScope } = makeFilters(params);
    selectedScope.value = { domain: 'a.com' };
    const domains = filters.filteredParameters.value.map(p => p.domain);
    expect(domains.every(d => d === 'a.com')).toBe(true);
  });

  it('filters to specific endpoint when scope has path+method', () => {
    const params = [
      makeParam({ domain: 'a.com', normalizedPath: '/ep1', method: 'GET' }),
      makeParam({ domain: 'a.com', normalizedPath: '/ep2', method: 'POST' }),
    ];
    const { filters, selectedScope } = makeFilters(params);
    selectedScope.value = { domain: 'a.com', path: '/ep1', method: 'GET' };
    expect(filters.filteredParameters.value).toHaveLength(1);
    expect(filters.filteredParameters.value[0].normalizedPath).toBe('/ep1');
  });

  it('excludes out-of-scope hosts even when selectedScope is null', () => {
    const params = [
      makeParam({ domain: 'allowed.com' }),
      makeParam({ domain: 'blocked.com' }),
    ];
    const { filters } = makeFilters(params, undefined, null, h => h === 'allowed.com');
    expect(filters.filteredParameters.value.every(p => p.domain === 'allowed.com')).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Scope decided per domain
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — scope decided per domain', () => {
  beforeEach(() => { idCounter = 0; });

  function readAll(filters: ReturnType<typeof useFilters>): void {
    void filters.filteredParameters.value;
    void filters.filteredTree.value;
    void filters.resultCountLabel.value;
    void filters.scopedParameterCount.value;
  }

  it('calls isHostInScope once per domain per pass', () => {
    const domains = ['a.com', 'b.com', 'c.com'];
    const params = shallowRef(domains.flatMap(domain =>
      Array.from({ length: 10 }, (_, i) => makeParam({ domain, name: `p${i}` }))));
    const inScope = vi.fn((host: string) => host !== 'b.com');
    const filters = useFilters(
      computed(() => params.value),
      computed(() => treeOf(params.value)),
      inScope,
      shallowRef<ScopeSelection>(null),
    );

    readAll(filters);
    expect(inScope).toHaveBeenCalledTimes(3);
    expect(filters.scopedParameterCount.value).toBe(20);

    // A new inventory batch is one more pass.
    params.value = [...params.value, makeParam({ domain: 'a.com', name: 'new' })];
    readAll(filters);
    expect(inScope).toHaveBeenCalledTimes(6);
    expect(filters.scopedParameterCount.value).toBe(21);

    // Narrowing filters reuse the domain decisions.
    filters.searchQuery.value = 'p1';
    filters.treeFilter.value = 'a';
    readAll(filters);
    expect(inScope).toHaveBeenCalledTimes(6);
    expect(new Set(inScope.mock.calls.map(([host]) => host))).toEqual(new Set(domains));
  });

  it('matches a per-parameter scope check under a mixed allowlist and denylist', async () => {
    vi.resetModules();
    const { useScope } = await import('../useScope');
    const scope = useScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Mixed',
      allowlist: ['*.example.com', 'api.other.org', 'exact.test:8443'],
      denylist: ['admin.example.com', '*.internal.example.com'],
    } as any;

    const domains = [
      'www.example.com', 'admin.example.com', 'db.internal.example.com', 'example.com',
      'api.other.org', 'cdn.other.org', 'exact.test', 'unrelated.net',
    ];
    const params = [0, 1].flatMap(i => domains.map(domain => makeParam({ domain, name: `p${i}` })));
    // explain() checks every host against the patterns without the decision cache.
    const perParameter = () => params.filter(p => scope.explain(p.domain).inScope);

    const { filters } = makeFilters(params, undefined, null, scope.isHostInScope);
    expect(filters.scopedParameters.value).toEqual(perParameter());
    expect(filters.filteredTree.value.map(d => d.name)).toEqual(['www.example.com', 'api.other.org', 'exact.test']);
    expect(filters.resultCountLabel.value).toBe('6 parameters across 3 domains');

    scope.currentScope.value!.denylist.push('api.other.org');
    expect(filters.scopedParameters.value).toEqual(perParameter());
    expect(filters.filteredTree.value.map(d => d.name)).toEqual(['www.example.com', 'exact.test']);
    expect(filters.resultCountLabel.value).toBe('4 parameters across 2 domains');

    scope.currentScope.value = undefined;
    expect(filters.scopedParameters.value).toEqual(params);
    expect(filters.resultCountLabel.value).toBe('16 parameters across 8 domains');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// filteredParameters — location filter
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — location filter', () => {
  beforeEach(() => { idCounter = 0; });

  it('shows all when activeLoc is "all"', () => {
    const params = [
      makeParam({ location: ParameterLocation.QUERY }),
      makeParam({ location: ParameterLocation.HEADER }),
    ];
    const { filters } = makeFilters(params);
    expect(filters.filteredParameters.value).toHaveLength(2);
  });

  it('filters to selected location', () => {
    const params = [
      makeParam({ location: ParameterLocation.QUERY }),
      makeParam({ location: ParameterLocation.HEADER }),
    ];
    const { filters } = makeFilters(params);
    filters.activeLoc.value = ParameterLocation.QUERY;
    expect(filters.filteredParameters.value).toHaveLength(1);
    expect(filters.filteredParameters.value[0].location).toBe(ParameterLocation.QUERY);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// filteredParameters — flag filter (OR semantics)
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — flag filter', () => {
  beforeEach(() => { idCounter = 0; });

  it('no active flags → show all', () => {
    const params = [makeParam({ flags: [Flag.SENSITIVE] }), makeParam({ flags: [] })];
    const { filters } = makeFilters(params);
    expect(filters.filteredParameters.value).toHaveLength(2);
  });

  it('filters by a single flag', () => {
    const params = [
      makeParam({ flags: [Flag.SENSITIVE] }),
      makeParam({ flags: [Flag.DEBUG] }),
      makeParam({ flags: [] }),
    ];
    const { filters } = makeFilters(params);
    filters.toggleFlag(Flag.SENSITIVE);
    expect(filters.filteredParameters.value).toHaveLength(1);
    expect(filters.filteredParameters.value[0].flags).toContain(Flag.SENSITIVE);
  });

  it('OR semantics: param shown if it has any of the active flags', () => {
    const params = [
      makeParam({ id: 'a', flags: [Flag.SENSITIVE] }),
      makeParam({ id: 'b', flags: [Flag.DEBUG] }),
      makeParam({ id: 'c', flags: [] }),
    ];
    const { filters } = makeFilters(params);
    filters.toggleFlag(Flag.SENSITIVE);
    filters.toggleFlag(Flag.DEBUG);
    expect(filters.filteredParameters.value).toHaveLength(2);
  });

  it('toggleFlag twice removes the flag', () => {
    const params = [makeParam({ flags: [Flag.SENSITIVE] }), makeParam({ flags: [] })];
    const { filters } = makeFilters(params);
    filters.toggleFlag(Flag.SENSITIVE);
    filters.toggleFlag(Flag.SENSITIVE);
    expect(filters.filteredParameters.value).toHaveLength(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// filteredParameters — value type filter
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — value type filter', () => {
  beforeEach(() => { idCounter = 0; });

  it('no active value types → show all', () => {
    const params = [makeParam({ valueTypes: [ValueType.JWT] }), makeParam({ valueTypes: [] })];
    const { filters } = makeFilters(params);
    expect(filters.filteredParameters.value).toHaveLength(2);
  });

  it('filters by value type', () => {
    const params = [
      makeParam({ valueTypes: [ValueType.JWT] }),
      makeParam({ valueTypes: [ValueType.INTEGER] }),
    ];
    const { filters } = makeFilters(params);
    filters.toggleValueType(ValueType.JWT);
    expect(filters.filteredParameters.value).toHaveLength(1);
    expect(filters.filteredParameters.value[0].valueTypes).toContain(ValueType.JWT);
  });

  it('toggleValueType twice removes the filter', () => {
    const params = [makeParam({ valueTypes: [ValueType.JWT] }), makeParam({ valueTypes: [] })];
    const { filters } = makeFilters(params);
    filters.toggleValueType(ValueType.JWT);
    filters.toggleValueType(ValueType.JWT);
    expect(filters.filteredParameters.value).toHaveLength(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// filteredParameters — search query
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — search query', () => {
  beforeEach(() => { idCounter = 0; });

  it('empty query returns all', () => {
    const params = [makeParam({ name: 'userId' }), makeParam({ name: 'token' })];
    const { filters } = makeFilters(params);
    expect(filters.filteredParameters.value).toHaveLength(2);
  });

  it('filters by name substring (case insensitive)', () => {
    const params = [makeParam({ name: 'UserId' }), makeParam({ name: 'token' })];
    const { filters } = makeFilters(params);
    filters.searchQuery.value = 'userid';
    expect(filters.filteredParameters.value).toHaveLength(1);
    expect(filters.filteredParameters.value[0].name).toBe('UserId');
  });

  it('filters by normalizedPath', () => {
    const params = [
      makeParam({ normalizedPath: '/api/users' }),
      makeParam({ normalizedPath: '/api/products' }),
    ];
    const { filters } = makeFilters(params);
    filters.searchQuery.value = 'users';
    expect(filters.filteredParameters.value).toHaveLength(1);
  });

  it('filters by domain', () => {
    const params = [makeParam({ domain: 'alpha.com' }), makeParam({ domain: 'beta.com' })];
    const { filters } = makeFilters(params);
    filters.searchQuery.value = 'alpha';
    expect(filters.filteredParameters.value).toHaveLength(1);
  });

  it('filters by flag name', () => {
    const params = [makeParam({ flags: [Flag.SENSITIVE] }), makeParam({ flags: [] })];
    const { filters } = makeFilters(params);
    filters.searchQuery.value = 'sensitive';
    expect(filters.filteredParameters.value).toHaveLength(1);
  });

  it('filters by value type', () => {
    const params = [makeParam({ valueTypes: [ValueType.JWT] }), makeParam({ valueTypes: [ValueType.INTEGER] })];
    const { filters } = makeFilters(params);
    filters.searchQuery.value = 'jwt';
    expect(filters.filteredParameters.value).toHaveLength(1);
  });

  it('trims whitespace from query', () => {
    const params = [makeParam({ name: 'csrf' }), makeParam({ name: 'token' })];
    const { filters } = makeFilters(params);
    filters.searchQuery.value = '  csrf  ';
    expect(filters.filteredParameters.value).toHaveLength(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// filteredParameters — sort by risk descending
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — sort by risk score', () => {
  beforeEach(() => { idCounter = 0; });

  it('higher risk parameters appear first', () => {
    const params = [
      makeParam({ id: 'low', flags: [] }),
      makeParam({ id: 'high', flags: [Flag.REFLECTED, Flag.IDOR] }),
    ];
    const { filters } = makeFilters(params);
    expect(filters.filteredParameters.value[0].id).toBe('high');
    expect(filters.filteredParameters.value[1].id).toBe('low');
  });

  it('keeps inventory order among equal scores', () => {
    const params = [
      makeParam({ id: 'a' }),
      makeParam({ id: 'b', flags: [Flag.IDOR] }),
      makeParam({ id: 'c' }),
      makeParam({ id: 'd', flags: [Flag.IDOR] }),
    ];
    const { filters } = makeFilters(params);
    expect(filters.filteredParameters.value.map(p => p.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('scores each parameter object once across filter passes and batches', () => {
    // computeRiskScore reads `count` once per call; nothing else in useFilters reads it.
    const reads = new Map<string, number>();
    function counted(id: string, count: number): Parameter {
      const p = makeParam({ id, name: id });
      Object.defineProperty(p, 'count', {
        get: () => {
          reads.set(id, (reads.get(id) ?? 0) + 1);
          return count;
        },
      });
      return p;
    }

    const params = shallowRef([counted('a', 1), counted('b', 8), counted('c', 2)]);
    const filters = useFilters(
      computed(() => params.value),
      computed(() => treeOf(params.value)),
      () => true,
      shallowRef<ScopeSelection>(null),
    );
    const ids = () => filters.filteredParameters.value.map(p => p.id);

    expect(ids()).toEqual(['b', 'c', 'a']);
    filters.searchQuery.value = 'example.com';
    expect(ids()).toEqual(['b', 'c', 'a']);
    filters.activeLoc.value = ParameterLocation.QUERY;
    expect(ids()).toEqual(['b', 'c', 'a']);
    expect(Object.fromEntries(reads)).toEqual({ a: 1, b: 1, c: 1 });

    // A batch replaces the record for `a` with a new object; only that one is scored.
    params.value = [counted('a', 64), params.value[1], params.value[2]];
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(Object.fromEntries(reads)).toEqual({ a: 2, b: 1, c: 1 });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// resultCountLabel
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — resultCountLabel', () => {
  beforeEach(() => { idCounter = 0; });

  it('shows "X parameters across N domains" when no scope selected', () => {
    const params = [
      makeParam({ domain: 'a.com' }),
      makeParam({ domain: 'b.com' }),
      makeParam({ domain: 'b.com' }),
    ];
    const { filters } = makeFilters(params);
    const label = filters.resultCountLabel.value;
    expect(label).toMatch(/3 parameters/);
    expect(label).toMatch(/2 domain/);
  });

  it('pluralises "parameter" correctly for 1 result', () => {
    const params = [makeParam()];
    const { filters } = makeFilters(params);
    expect(filters.resultCountLabel.value).toMatch(/1 parameter\b/);
  });

  it('shows "X parameters in <domain>" when scope has domain only', () => {
    const params = [makeParam({ domain: 'a.com' }), makeParam({ domain: 'a.com' })];
    const { filters, selectedScope } = makeFilters(params);
    selectedScope.value = { domain: 'a.com' };
    expect(filters.resultCountLabel.value).toMatch(/in a\.com/);
  });

  it('shows "X parameters in METHOD /path" when scope has endpoint', () => {
    const params = [makeParam({ domain: 'a.com', method: 'POST', normalizedPath: '/submit' })];
    const { filters, selectedScope } = makeFilters(params);
    selectedScope.value = { domain: 'a.com', method: 'POST', path: '/submit' };
    expect(filters.resultCountLabel.value).toMatch(/POST \/submit/);
  });

  it('uses correct domain pluralisation for 1 domain', () => {
    const params = [makeParam({ domain: 'a.com' })];
    const { filters } = makeFilters(params);
    const label = filters.resultCountLabel.value;
    expect(label).toMatch(/1 domain\b/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// rowNumWidth
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — rowNumWidth', () => {
  beforeEach(() => { idCounter = 0; });

  it('minimum is 32', () => {
    const { filters } = makeFilters([]);
    expect(filters.rowNumWidth.value).toBeGreaterThanOrEqual(32);
  });

  it('grows with more results', () => {
    // 10 params → 2 digits → 2*8+16=32; 100 → 3 digits → 3*8+16=40
    const ten = Array.from({ length: 10 }, (_, i) => makeParam({ id: `p${i}` }));
    const hundred = Array.from({ length: 100 }, (_, i) => makeParam({ id: `q${i}` }));
    const { filters: f10 } = makeFilters(ten);
    const { filters: f100 } = makeFilters(hundred);
    expect(f100.rowNumWidth.value).toBeGreaterThan(f10.rowNumWidth.value);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// scopedParameterCount
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — scopedParameterCount', () => {
  beforeEach(() => { idCounter = 0; });

  it('counts only in-scope parameters', () => {
    const params = [
      makeParam({ domain: 'allowed.com' }),
      makeParam({ domain: 'blocked.com' }),
    ];
    const { filters } = makeFilters(params, undefined, null, h => h === 'allowed.com');
    expect(filters.scopedParameterCount.value).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// filteredTree
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — filteredTree', () => {
  beforeEach(() => { idCounter = 0; });

  function makeTree(nodes: Array<{ name: string; endpoints?: TreeEndpoint[] }>): TreeNode[] {
    return nodes.map(n => ({
      name: n.name,
      paramCount: (n.endpoints ?? []).reduce((s, e) => s + e.params.length, 0),
      endpoints: n.endpoints ?? [],
    }));
  }

  it('returns only in-scope domains', () => {
    const tree = makeTree([{ name: 'a.com' }, { name: 'b.com' }]);
    const { filters } = makeFilters([], tree, null, h => h === 'a.com');
    expect(filters.filteredTree.value.map(d => d.name)).toEqual(['a.com']);
  });

  it('returns all in-scope domains when treeFilter is empty', () => {
    const tree = makeTree([{ name: 'a.com' }, { name: 'b.com' }]);
    const { filters } = makeFilters([], tree);
    expect(filters.filteredTree.value).toHaveLength(2);
  });

  it('filters domains by name substring', () => {
    const tree = makeTree([{ name: 'alpha.com' }, { name: 'beta.com' }]);
    const { filters } = makeFilters([], tree);
    filters.treeFilter.value = 'alpha';
    expect(filters.filteredTree.value.map(d => d.name)).toEqual(['alpha.com']);
  });

  it('shows domain when endpoint path matches filter', () => {
    const tree = makeTree([
      {
        name: 'a.com',
        endpoints: [{ method: 'GET', path: '/api/users', params: [] }],
      },
      {
        name: 'b.com',
        endpoints: [{ method: 'GET', path: '/api/products', params: [] }],
      },
    ]);
    const { filters } = makeFilters([], tree);
    filters.treeFilter.value = 'users';
    expect(filters.filteredTree.value.map(d => d.name)).toEqual(['a.com']);
  });

  it('shows domain when endpoint method matches filter', () => {
    const tree = makeTree([
      {
        name: 'a.com',
        endpoints: [{ method: 'DELETE', path: '/x', params: [] }],
      },
    ]);
    const { filters } = makeFilters([], tree);
    filters.treeFilter.value = 'delete';
    expect(filters.filteredTree.value).toHaveLength(1);
  });

  it('recalculates paramCount to only matched endpoints', () => {
    const param = makeParam();
    const tree = makeTree([
      {
        name: 'a.com',
        endpoints: [
          { method: 'GET', path: '/match', params: [param] },
          { method: 'POST', path: '/other', params: [] },
        ],
      },
    ]);
    const { filters } = makeFilters([], tree);
    filters.treeFilter.value = 'match';
    const domain = filters.filteredTree.value.find(d => d.name === 'a.com')!;
    expect(domain.paramCount).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// resetFilters
// ────────────────────────────────────────────────────────────────────────────

describe('useFilters — resetFilters', () => {
  beforeEach(() => { idCounter = 0; });

  it('clears searchQuery', () => {
    const { filters } = makeFilters([]);
    filters.searchQuery.value = 'foo';
    filters.resetFilters();
    expect(filters.searchQuery.value).toBe('');
  });

  it('clears treeFilter', () => {
    const { filters } = makeFilters([]);
    filters.treeFilter.value = 'bar';
    filters.resetFilters();
    expect(filters.treeFilter.value).toBe('');
  });

  it('resets activeLoc to "all"', () => {
    const { filters } = makeFilters([]);
    filters.activeLoc.value = ParameterLocation.COOKIE;
    filters.resetFilters();
    expect(filters.activeLoc.value).toBe('all');
  });

  it('clears activeFlags', () => {
    const { filters } = makeFilters([]);
    filters.toggleFlag(Flag.SENSITIVE);
    filters.resetFilters();
    expect(filters.activeFlags.size).toBe(0);
  });

  it('clears activeValueTypes', () => {
    const { filters } = makeFilters([]);
    filters.toggleValueType(ValueType.JWT);
    filters.resetFilters();
    expect(filters.activeValueTypes.size).toBe(0);
  });
});
