import { describe, it, expect } from 'vitest';
import { Flag, ValueType, ParameterLocation } from '@param-logger/shared';
import type { Parameter } from '@param-logger/shared';
import { getAttackHints } from '../attackHints';

function makeParam(overrides: Partial<Parameter> = {}): Parameter {
  return {
    id: 'test-id',
    domain: 'example.com',
    method: 'GET',
    normalizedPath: '/test',
    location: ParameterLocation.QUERY,
    name: 'p',
    valueTypes: [],
    flags: [],
    count: 1,
    firstSeen: new Date(),
    lastSeen: new Date(),
    ...overrides,
  };
}

function labelOf(hints: ReturnType<typeof getAttackHints>) {
  return hints.map((h) => h.label);
}

// ────────────────────────────────────────────────────────────────────────────
// Flag-based hints
// ────────────────────────────────────────────────────────────────────────────

describe('getAttackHints — flag-based', () => {
  it('returns no hints for empty flags, no types, QUERY location', () => {
    // QUERY still adds a location hint, so filter for flag-specific ones
    const hints = getAttackHints(makeParam({ location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Path IDOR / Traversal');
    expect(labelOf(hints)).not.toContain('Open Redirect');
  });

  it('REDIRECT flag → Open Redirect hint', () => {
    const hints = getAttackHints(makeParam({ flags: [Flag.REDIRECT], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Open Redirect');
  });

  it('FILE flag → Path Traversal / LFI hint', () => {
    const hints = getAttackHints(makeParam({ flags: [Flag.FILE], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Path Traversal / LFI');
  });

  it('AUTH flag → Auth Control hint', () => {
    const hints = getAttackHints(makeParam({ flags: [Flag.AUTH], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Auth Control');
  });

  it('IDOR flag → IDOR Candidate hint', () => {
    const hints = getAttackHints(makeParam({ flags: [Flag.IDOR], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('IDOR Candidate');
  });

  it('SSTI flag → SSTI hint', () => {
    const hints = getAttackHints(makeParam({ flags: [Flag.SSTI], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('SSTI');
  });

  it('INJECTION flag → Injection hint', () => {
    const hints = getAttackHints(makeParam({ flags: [Flag.INJECTION], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Injection');
  });

  it('DEBUG flag → Debug / Info Disclosure hint', () => {
    const hints = getAttackHints(makeParam({ flags: [Flag.DEBUG], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Debug / Info Disclosure');
  });

  it('PROTO_POLLUTION flag → Prototype Pollution hint', () => {
    const hints = getAttackHints(makeParam({ flags: [Flag.PROTO_POLLUTION], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Prototype Pollution');
  });

  it('SENSITIVE flag (no JWT) → Sensitive Value hint', () => {
    const hints = getAttackHints(makeParam({ flags: [Flag.SENSITIVE], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Sensitive Value');
  });

  it('SENSITIVE + JWT → no Sensitive Value hint (JWT hint shown instead)', () => {
    const hints = getAttackHints(makeParam({
      flags: [Flag.SENSITIVE],
      valueTypes: [ValueType.JWT],
      location: ParameterLocation.PATH,
    }));
    expect(labelOf(hints)).toContain('JWT');
    expect(labelOf(hints)).not.toContain('Sensitive Value');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Value-type hints
// ────────────────────────────────────────────────────────────────────────────

describe('getAttackHints — value-type hints', () => {
  it('JWT value type → JWT hint', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.JWT], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('JWT');
  });

  it('INTEGER value type → IDOR hint with generic desc', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.INTEGER], location: ParameterLocation.PATH }));
    const idor = hints.find((h) => h.label === 'IDOR');
    expect(idor).toBeDefined();
    expect(idor!.desc).toContain('direct object ID');
  });

  it('UUID value type → IDOR hint with generic UUID desc', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.UUID], location: ParameterLocation.PATH }));
    const idor = hints.find((h) => h.label === 'IDOR');
    expect(idor).toBeDefined();
    expect(idor!.desc).toContain('UUID identifier');
  });

  it('UUID_V1 → timestamp+MAC desc', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.UUID_V1], location: ParameterLocation.PATH }));
    const idor = hints.find((h) => h.label === 'IDOR');
    expect(idor!.desc).toContain('timestamp + MAC');
  });

  it('UUID_V6 → timestamp+MAC desc (same branch as v1)', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.UUID_V6], location: ParameterLocation.PATH }));
    const idor = hints.find((h) => h.label === 'IDOR');
    expect(idor!.desc).toContain('timestamp + MAC');
  });

  it('UUID_V7 → epoch timestamp desc', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.UUID_V7], location: ParameterLocation.PATH }));
    const idor = hints.find((h) => h.label === 'IDOR');
    expect(idor!.desc).toContain('timestamp');
    expect(idor!.desc).toContain('brute-forced');
  });

  it('UUID_COMPOUND → compound UUID desc', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.UUID_COMPOUND], location: ParameterLocation.PATH }));
    const idor = hints.find((h) => h.label === 'IDOR');
    expect(idor!.desc).toContain('Compound UUID');
  });

  it('UUID_V3 → deterministic UUID desc', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.UUID_V3], location: ParameterLocation.PATH }));
    const idor = hints.find((h) => h.label === 'IDOR');
    expect(idor!.desc).toContain('Deterministic UUID');
  });

  it('UUID_V5 → deterministic UUID desc (same branch as v3)', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.UUID_V5], location: ParameterLocation.PATH }));
    const idor = hints.find((h) => h.label === 'IDOR');
    expect(idor!.desc).toContain('Deterministic UUID');
  });

  it('UUID_V4 (no other UUID branch) → generic UUID desc', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.UUID_V4], location: ParameterLocation.PATH }));
    const idor = hints.find((h) => h.label === 'IDOR');
    expect(idor!.desc).toContain('UUID identifier');
  });

  it('URL value type → SSRF hint', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.URL], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('SSRF');
  });

  it('BOOLEAN value type → Boolean Bypass hint', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.BOOLEAN], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Boolean Bypass');
  });

  it('EMAIL value type → User Enumeration hint', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.EMAIL], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('User Enumeration');
  });

  it('BASE64 value type → Encoded Payload hint', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.BASE64], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Encoded Payload');
  });

  it('HASH value type → Hash / HMAC hint', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.HASH], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Hash / HMAC');
  });

  it('DECIMAL value type → Numeric Manipulation hint', () => {
    const hints = getAttackHints(makeParam({ valueTypes: [ValueType.DECIMAL], location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Numeric Manipulation');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Location-based hints
// ────────────────────────────────────────────────────────────────────────────

describe('getAttackHints — location-based hints', () => {
  it('QUERY location → Injection (QUERY) hint', () => {
    const hints = getAttackHints(makeParam({ location: ParameterLocation.QUERY }));
    expect(labelOf(hints)).toContain('Injection (QUERY)');
  });

  it('FORM location → Injection (FORM) hint', () => {
    const hints = getAttackHints(makeParam({ location: ParameterLocation.FORM }));
    expect(labelOf(hints)).toContain('Injection (FORM)');
  });

  it('JSON location → Injection (JSON) hint', () => {
    const hints = getAttackHints(makeParam({ location: ParameterLocation.JSON }));
    expect(labelOf(hints)).toContain('Injection (JSON)');
  });

  it('HEADER location → Header Injection hint', () => {
    const hints = getAttackHints(makeParam({ location: ParameterLocation.HEADER }));
    expect(labelOf(hints)).toContain('Header Injection');
  });

  it('COOKIE location → Cookie Manipulation hint', () => {
    const hints = getAttackHints(makeParam({ location: ParameterLocation.COOKIE }));
    expect(labelOf(hints)).toContain('Cookie Manipulation');
  });

  it('PATH location → Path IDOR / Traversal hint', () => {
    const hints = getAttackHints(makeParam({ location: ParameterLocation.PATH }));
    expect(labelOf(hints)).toContain('Path IDOR / Traversal');
  });

  it('MULTIPART location → File Upload hint', () => {
    const hints = getAttackHints(makeParam({ location: ParameterLocation.MULTIPART }));
    expect(labelOf(hints)).toContain('File Upload');
  });

  it('GRAPHQL location → no location-specific hint (not covered by switch)', () => {
    const hints = getAttackHints(makeParam({ location: ParameterLocation.GRAPHQL }));
    expect(labelOf(hints)).not.toContain('Injection (GRAPHQL)');
    expect(labelOf(hints)).not.toContain('Header Injection');
    expect(labelOf(hints)).not.toContain('Cookie Manipulation');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Multiple hints combined
// ────────────────────────────────────────────────────────────────────────────

describe('getAttackHints — combined', () => {
  it('produces multiple hints when flags, types, and location all contribute', () => {
    const hints = getAttackHints(makeParam({
      flags: [Flag.REFLECTED, Flag.INJECTION],
      valueTypes: [ValueType.JWT, ValueType.INTEGER],
      location: ParameterLocation.QUERY,
    }));
    expect(labelOf(hints)).toContain('JWT');
    expect(labelOf(hints)).toContain('Injection');
    expect(labelOf(hints)).toContain('IDOR');
    expect(labelOf(hints)).toContain('Injection (QUERY)');
  });

  it('returns empty array for a completely empty parameter on PATH location with no flags/types', () => {
    // PATH location generates 1 hint, no flags or types
    const hints = getAttackHints(makeParam({ location: ParameterLocation.PATH }));
    expect(hints.length).toBe(1);
    expect(hints[0].label).toBe('Path IDOR / Traversal');
  });

  it('each hint has icon, label, and desc properties', () => {
    const hints = getAttackHints(makeParam({ flags: [Flag.REDIRECT], location: ParameterLocation.PATH }));
    for (const hint of hints) {
      expect(hint).toHaveProperty('icon');
      expect(hint).toHaveProperty('label');
      expect(hint).toHaveProperty('desc');
      expect(typeof hint.icon).toBe('string');
      expect(typeof hint.label).toBe('string');
      expect(typeof hint.desc).toBe('string');
    }
  });
});
