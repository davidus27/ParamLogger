import { describe, it, expect, beforeEach, vi } from 'vitest';

// useScope is a module-level singleton — reset modules between tests that
// mutate shared state so each describe block starts from a clean slate.
describe('useScope — isHostInScope', () => {
  // We access isHostInScope by calling useScope() which wraps the singleton.
  // To avoid cross-test state leaks we re-import after vi.resetModules().

  async function freshScope() {
    vi.resetModules();
    const mod = await import('../useScope');
    return mod.useScope();
  }

  it('returns true for every host when no scope is selected (null currentScope)', async () => {
    const { isHostInScope } = await freshScope();
    expect(isHostInScope('example.com')).toBe(true);
    expect(isHostInScope('anything.internal')).toBe(true);
  });

  it('returns true for exact match in allowlist', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: ['example.com'],
      denylist: [],
    } as any;
    expect(scope.isHostInScope('example.com')).toBe(true);
  });

  it('returns false when host not in allowlist', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: ['example.com'],
      denylist: [],
    } as any;
    expect(scope.isHostInScope('other.com')).toBe(false);
  });

  it('wildcard *.example.com matches subdomains', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: ['*.example.com'],
      denylist: [],
    } as any;
    expect(scope.isHostInScope('api.example.com')).toBe(true);
    expect(scope.isHostInScope('app.example.com')).toBe(true);
  });

  it('wildcard *.example.com does not match base domain', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: ['*.example.com'],
      denylist: [],
    } as any;
    expect(scope.isHostInScope('example.com')).toBe(false);
  });

  it('deny list takes precedence over allow list', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: ['*.example.com'],
      denylist: ['evil.example.com'],
    } as any;
    expect(scope.isHostInScope('evil.example.com')).toBe(false);
    expect(scope.isHostInScope('safe.example.com')).toBe(true);
  });

  it('empty allowlist allows all (except denied)', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: [],
      denylist: ['bad.com'],
    } as any;
    expect(scope.isHostInScope('anything.com')).toBe(true);
    expect(scope.isHostInScope('bad.com')).toBe(false);
  });

  it('strips scheme from host before matching', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: ['example.com'],
      denylist: [],
    } as any;
    // Host normally comes without scheme from the backend, but the scope
    // patterns may have been entered with one — make sure normalisation works.
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: ['https://example.com'],
      denylist: [],
    } as any;
    expect(scope.isHostInScope('example.com')).toBe(true);
  });

  it('strips port from host before matching', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: ['example.com:8080'],
      denylist: [],
    } as any;
    expect(scope.isHostInScope('example.com')).toBe(true);
  });

  it('matching is case-insensitive', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: ['EXAMPLE.COM'],
      denylist: [],
    } as any;
    expect(scope.isHostInScope('example.com')).toBe(true);
  });

  it('wildcard deny blocks subdomain', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: ['*.example.com'],
      denylist: ['*.blocked.example.com'],
    } as any;
    expect(scope.isHostInScope('ok.example.com')).toBe(true);
    expect(scope.isHostInScope('test.blocked.example.com')).toBe(false);
  });
});

describe('useScope — compiled scope', () => {
  async function freshScope() {
    vi.resetModules();
    const mod = await import('../useScope');
    return mod.useScope();
  }

  // Counts `new RegExp(...)` calls made while `fn` runs. Regex literals don't count.
  function regexesBuiltBy(fn: () => void): number {
    let built = 0;
    const NativeRegExp = globalThis.RegExp;
    globalThis.RegExp = new Proxy(NativeRegExp, {
      construct(target, args) {
        built++;
        return Reflect.construct(target, args);
      },
    });
    try {
      fn();
    } finally {
      globalThis.RegExp = NativeRegExp;
    }
    return built;
  }

  it('builds no regexes when no scope is selected', async () => {
    const scope = await freshScope();
    expect(regexesBuiltBy(() => scope.isHostInScope('example.com'))).toBe(0);
  });

  it('compiles each pattern once across many calls', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1',
      name: 'Test',
      allowlist: ['*.example.com', 'example.org'],
      denylist: ['evil.example.com'],
    } as any;
    const results: boolean[] = [];
    let reason = '';
    const built = regexesBuiltBy(() => {
      for (let i = 0; i < 100; i++) {
        results.push(
          scope.isHostInScope('api.example.com'),
          scope.isHostInScope('evil.example.com'),
          scope.isHostInScope('other.net'),
        );
      }
      reason = scope.explain('example.org').reason;
    });
    expect(built).toBe(3);
    expect(results.slice(0, 3)).toEqual([true, false, false]);
    expect(results.slice(-3)).toEqual([true, false, false]);
    expect(reason).toBe('Matched allowlist pattern: example.org');
  });

  it('recompiles after the scope is swapped', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1', name: 'A', allowlist: ['example.com'], denylist: [],
    } as any;
    expect(scope.isHostInScope('other.com')).toBe(false);

    scope.currentScope.value = {
      id: 's2', name: 'B', allowlist: ['other.com'], denylist: ['bad.other.com'],
    } as any;
    let results: boolean[] = [];
    expect(regexesBuiltBy(() => {
      results = [scope.isHostInScope('other.com'), scope.isHostInScope('example.com')];
    })).toBe(2);
    expect(results).toEqual([true, false]);
    expect(regexesBuiltBy(() => scope.isHostInScope('other.com'))).toBe(0);

    scope.currentScope.value = undefined;
    expect(regexesBuiltBy(() => {
      results = [scope.isHostInScope('example.com')];
    })).toBe(0);
    expect(results).toEqual([true]);
  });

  it('recompiles after an in-place denylist.push', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1', name: 'T', allowlist: ['*.example.com'], denylist: [],
    } as any;
    expect(scope.isHostInScope('evil.example.com')).toBe(true);

    scope.currentScope.value!.denylist.push('evil.example.com');
    let inScope = true;
    expect(regexesBuiltBy(() => {
      inScope = scope.isHostInScope('evil.example.com');
    })).toBe(2);
    expect(inScope).toBe(false);
    expect(scope.explain('evil.example.com').reason).toBe('Blocked by denylist pattern: evil.example.com');
  });

  it('recompiles after an allowlist entry is replaced in place', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1', name: 'T', allowlist: ['example.com'], denylist: [],
    } as any;
    expect(scope.isHostInScope('other.com')).toBe(false);

    scope.currentScope.value!.allowlist[0] = 'other.com';
    expect(scope.isHostInScope('other.com')).toBe(true);
    expect(scope.isHostInScope('example.com')).toBe(false);
  });
});

describe('useScope — decision cache', () => {
  async function freshModule() {
    vi.resetModules();
    return import('../useScope');
  }

  // Counts pattern checks (RegExp#test) made while `fn` runs.
  function patternChecksBy(fn: () => void): number {
    const spy = vi.spyOn(RegExp.prototype, 'test');
    try {
      fn();
      return spy.mock.calls.length;
    } finally {
      spy.mockRestore();
    }
  }

  it('checks each host against the patterns once per scope revision', async () => {
    const scope = (await freshModule()).useScope();
    scope.currentScope.value = {
      id: 's1', name: 'T', allowlist: ['*.example.com'], denylist: ['evil.example.com'],
    } as any;
    const hosts = ['api.example.com', 'evil.example.com', 'other.net'];

    let first: boolean[] = [];
    expect(patternChecksBy(() => { first = hosts.map(h => scope.isHostInScope(h)); })).toBe(5);
    expect(first).toEqual([true, false, false]);

    let again: boolean[] = [];
    expect(patternChecksBy(() => {
      for (let i = 0; i < 100; i++) again = hosts.map(h => scope.isHostInScope(h));
    })).toBe(0);
    expect(again).toEqual(first);

    scope.currentScope.value = {
      id: 's2', name: 'U', allowlist: ['other.net'], denylist: [],
    } as any;
    expect(hosts.map(h => scope.isHostInScope(h))).toEqual([false, false, true]);
  });

  it('empties the cache once it holds SCOPE_DECISION_CACHE_LIMIT hosts', async () => {
    const mod = await freshModule();
    const scope = mod.useScope();
    scope.currentScope.value = {
      id: 's1', name: 'T', allowlist: ['*.example.com'], denylist: [],
    } as any;
    for (let i = 0; i < mod.SCOPE_DECISION_CACHE_LIMIT; i++) scope.isHostInScope(`h${i}.example.com`);

    expect(patternChecksBy(() => scope.isHostInScope('h0.example.com'))).toBe(0);
    expect(patternChecksBy(() => scope.isHostInScope('new.example.com'))).toBe(1);
    expect(patternChecksBy(() => scope.isHostInScope('new.example.com'))).toBe(0);
    expect(patternChecksBy(() => scope.isHostInScope('h0.example.com'))).toBe(1);
  });
});

describe('useScope — explain', () => {
  async function freshScope() {
    vi.resetModules();
    const mod = await import('../useScope');
    return mod.useScope();
  }

  it('returns inScope=true with "No scope selected" reason when no scope', async () => {
    const scope = await freshScope();
    const result = scope.explain('example.com');
    expect(result.inScope).toBe(true);
    expect(result.reason).toMatch(/no scope/i);
  });

  it('returns matching allowlist reason when host is allowed', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1', name: 'T', allowlist: ['example.com'], denylist: [],
    } as any;
    const result = scope.explain('example.com');
    expect(result.inScope).toBe(true);
    expect(result.reason).toMatch(/allowlist/i);
  });

  it('returns denylist reason when host is denied', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1', name: 'T', allowlist: [], denylist: ['evil.com'],
    } as any;
    const result = scope.explain('evil.com');
    expect(result.inScope).toBe(false);
    expect(result.reason).toMatch(/denylist/i);
  });

  it('returns empty allowlist reason when allowlist is empty', async () => {
    const scope = await freshScope();
    scope.currentScope.value = {
      id: 's1', name: 'T', allowlist: [], denylist: [],
    } as any;
    const result = scope.explain('anything.com');
    expect(result.inScope).toBe(true);
    expect(result.reason).toMatch(/empty/i);
  });
});

describe('useScope — getCurrentScope', () => {
  async function freshScope() {
    vi.resetModules();
    const mod = await import('../useScope');
    return mod.useScope();
  }

  it('returns undefined when no scope initialised', async () => {
    const scope = await freshScope();
    expect(scope.getCurrentScope()).toBeUndefined();
  });

  it('reflects the current scope value', async () => {
    const scope = await freshScope();
    const mockScope = { id: 's2', name: 'My Scope', allowlist: [], denylist: [] } as any;
    scope.currentScope.value = mockScope;
    expect(scope.getCurrentScope()).toStrictEqual(mockScope);
  });
});
