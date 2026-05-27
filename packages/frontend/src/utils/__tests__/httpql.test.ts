import { describe, it, expect } from 'vitest';
import { ParameterLocation } from '@param-logger/shared';
import type { Parameter } from '@param-logger/shared';
import {
  escapeHttpQLString,
  escapeRegexLiteral,
  buildPathRegex,
  jsonLeafKey,
  buildHttpQLForParameter,
} from '../httpql';

function makeParam(overrides: Partial<Parameter> = {}): Parameter {
  return {
    id: 'test-id',
    domain: 'example.com',
    method: 'GET',
    normalizedPath: '/api/test',
    location: ParameterLocation.QUERY,
    name: 'param',
    valueTypes: [],
    flags: [],
    count: 1,
    firstSeen: new Date(),
    lastSeen: new Date(),
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// escapeHttpQLString
// ────────────────────────────────────────────────────────────────────────────

describe('escapeHttpQLString', () => {
  it('returns plain string unchanged', () => {
    expect(escapeHttpQLString('hello world')).toBe('hello world');
  });

  it('escapes backslashes', () => {
    expect(escapeHttpQLString('C:\\path\\file')).toBe('C:\\\\path\\\\file');
  });

  it('escapes double-quotes', () => {
    expect(escapeHttpQLString('say "hello"')).toBe('say \\"hello\\"');
  });

  it('escapes both backslashes and double-quotes', () => {
    expect(escapeHttpQLString('"C:\\dir"')).toBe('\\"C:\\\\dir\\"');
  });

  it('handles empty string', () => {
    expect(escapeHttpQLString('')).toBe('');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// escapeRegexLiteral
// ────────────────────────────────────────────────────────────────────────────

describe('escapeRegexLiteral', () => {
  it('returns plain alpha-numeric string unchanged', () => {
    expect(escapeRegexLiteral('hello123')).toBe('hello123');
  });

  it('escapes regex special characters', () => {
    const special = '\\ ^ $ . | ? * + ( ) [ ] { }';
    const escaped = escapeRegexLiteral(special);
    // Every special char should be preceded by a backslash
    expect(escaped).toBe('\\\\ \\^ \\$ \\. \\| \\? \\* \\+ \\( \\) \\[ \\] \\{ \\}');
  });

  it('escapes dots in domain names', () => {
    expect(escapeRegexLiteral('example.com')).toBe('example\\.com');
  });

  it('handles empty string', () => {
    expect(escapeRegexLiteral('')).toBe('');
  });

  it('escapes a string with only special chars', () => {
    expect(escapeRegexLiteral('.*+')).toBe('\\.\\*\\+');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildPathRegex
// ────────────────────────────────────────────────────────────────────────────

describe('buildPathRegex', () => {
  it('root path returns exact anchor ^/$', () => {
    expect(buildPathRegex('/')).toBe('^/$');
  });

  it('simple static path is anchored with optional trailing slash', () => {
    expect(buildPathRegex('/api/users')).toBe('^/api/users/?$');
  });

  it('replaces {placeholder} with [^/]+', () => {
    expect(buildPathRegex('/api/users/{id}')).toBe('^/api/users/[^/]+/?$');
  });

  it('replaces multiple placeholders', () => {
    expect(buildPathRegex('/api/{org}/{repo}/issues/{id}')).toBe(
      '^/api/[^/]+/[^/]+/issues/[^/]+/?$',
    );
  });

  it('escapes regex-special characters in static segments', () => {
    expect(buildPathRegex('/api/v1.0/search')).toBe('^/api/v1\\.0/search/?$');
  });

  it('handles path with a single segment', () => {
    expect(buildPathRegex('/health')).toBe('^/health/?$');
  });

  it('treats {uuid} placeholder like any other placeholder', () => {
    expect(buildPathRegex('/items/{uuid}')).toBe('^/items/[^/]+/?$');
  });

  it('treats {hash} placeholder like any other placeholder', () => {
    expect(buildPathRegex('/files/{hash}/download')).toBe('^/files/[^/]+/download/?$');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// jsonLeafKey
// ────────────────────────────────────────────────────────────────────────────

describe('jsonLeafKey', () => {
  it('returns simple key unchanged', () => {
    expect(jsonLeafKey('name')).toBe('name');
  });

  it('returns last segment of dot-separated key', () => {
    expect(jsonLeafKey('user.name')).toBe('name');
  });

  it('strips trailing empty-bracket array suffix before dot split', () => {
    // users[].name → first strip trailing [] (none here) then last dot segment
    expect(jsonLeafKey('users[].name')).toBe('name');
  });

  it('handles deeply nested key', () => {
    expect(jsonLeafKey('data.items[0].id')).toBe('id');
  });

  it('strips trailing numeric array index from final segment', () => {
    // e.g. top-level array: "items[0]"
    expect(jsonLeafKey('items[0]')).toBe('items');
  });

  it('handles trailing empty brackets on final segment', () => {
    expect(jsonLeafKey('tags[]')).toBe('tags');
  });

  it('returns empty string for empty input', () => {
    expect(jsonLeafKey('')).toBe('');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildHttpQLForParameter — shared structure
// ────────────────────────────────────────────────────────────────────────────

describe('buildHttpQLForParameter — shared clauses', () => {
  it('includes host, method, path clauses joined with AND', () => {
    const p = makeParam();
    const result = buildHttpQLForParameter(p);
    expect(result).toContain('req.host.regex:');
    expect(result).toContain('req.method.eq:');
    expect(result).toContain('req.path.regex:');
    expect(result.split(' AND ').length).toBeGreaterThanOrEqual(3);
  });

  it('includes case-insensitive host regex with optional port', () => {
    const p = makeParam({ domain: 'example.com' });
    const result = buildHttpQLForParameter(p);
    // Build the expected host clause using the same helper functions
    const expectedHostClause = `req.host.regex:"${escapeHttpQLString(`(?i)^${escapeRegexLiteral('example.com')}(?::\\d+)?$`)}"`;
    expect(result).toContain(expectedHostClause);
  });

  it('includes method exact-match clause', () => {
    const p = makeParam({ method: 'POST' });
    const result = buildHttpQLForParameter(p);
    expect(result).toContain('req.method.eq:"POST"');
  });

  it('embeds anchored path regex', () => {
    const p = makeParam({ normalizedPath: '/api/v1/users' });
    const result = buildHttpQLForParameter(p);
    expect(result).toContain('^/api/v1/users/?$');
  });

  it('resolves placeholders in path regex', () => {
    const p = makeParam({ normalizedPath: '/api/users/{id}' });
    const result = buildHttpQLForParameter(p);
    expect(result).toContain('^/api/users/[^/]+/?$');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildHttpQLForParameter — per-location clauses
// ────────────────────────────────────────────────────────────────────────────

describe('buildHttpQLForParameter — QUERY location', () => {
  it('adds req.query.regex clause anchored to name= assignment', () => {
    const p = makeParam({ location: ParameterLocation.QUERY, name: 'id' });
    const result = buildHttpQLForParameter(p);
    expect(result).toContain('req.query.regex:');
    expect(result).toContain('(?:^|&)id=');
  });

  it('escapes regex-special chars in parameter name', () => {
    const p = makeParam({ location: ParameterLocation.QUERY, name: 'foo.bar' });
    const result = buildHttpQLForParameter(p);
    const expectedPattern = escapeHttpQLString(`(?:^|&)${escapeRegexLiteral('foo.bar')}=`);
    expect(result).toContain(`req.query.regex:"${expectedPattern}"`);
  });
});

describe('buildHttpQLForParameter — FORM location', () => {
  it('adds req.raw.cont clause with name= suffix', () => {
    const p = makeParam({ location: ParameterLocation.FORM, name: 'username' });
    const result = buildHttpQLForParameter(p);
    expect(result).toContain('req.raw.cont:"username="');
  });
});

describe('buildHttpQLForParameter — JSON location', () => {
  it('adds req.raw.cont clause with quoted leaf key', () => {
    const p = makeParam({ location: ParameterLocation.JSON, name: 'user.name' });
    const result = buildHttpQLForParameter(p);
    expect(result).toContain('req.raw.cont:"\\"name\\""');
  });

  it('uses leaf key of a nested JSON path', () => {
    const p = makeParam({ location: ParameterLocation.JSON, name: 'data.items[0].id' });
    const result = buildHttpQLForParameter(p);
    expect(result).toContain('\\"id\\"');
  });
});

describe('buildHttpQLForParameter — MULTIPART location', () => {
  it('adds req.raw.cont clause matching name="…"', () => {
    const p = makeParam({ location: ParameterLocation.MULTIPART, name: 'file' });
    const result = buildHttpQLForParameter(p);
    expect(result).toContain('req.raw.cont:"name=\\"file\\""');
  });
});

describe('buildHttpQLForParameter — HEADER location', () => {
  it('adds req.raw.cont clause matching HeaderName:', () => {
    const p = makeParam({ location: ParameterLocation.HEADER, name: 'X-Custom-Header' });
    const result = buildHttpQLForParameter(p);
    expect(result).toContain('req.raw.cont:"X-Custom-Header:"');
  });
});

describe('buildHttpQLForParameter — COOKIE location', () => {
  it('adds req.raw.cont clause matching cookieName=', () => {
    const p = makeParam({ location: ParameterLocation.COOKIE, name: 'session' });
    const result = buildHttpQLForParameter(p);
    expect(result).toContain('req.raw.cont:"session="');
  });
});

describe('buildHttpQLForParameter — PATH location', () => {
  it('only emits 3 base clauses (no extra clause for PATH params)', () => {
    const p = makeParam({ location: ParameterLocation.PATH, name: 'id', normalizedPath: '/api/{id}' });
    const result = buildHttpQLForParameter(p);
    expect(result.split(' AND ')).toHaveLength(3);
  });
});
