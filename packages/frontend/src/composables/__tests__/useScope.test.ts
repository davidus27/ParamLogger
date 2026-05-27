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
