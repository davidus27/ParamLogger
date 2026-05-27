import { describe, it, expect } from 'vitest';
import { calculateShannonEntropy, classifyUUID, classifyValue } from '../classify';
import { ValueType } from '@param-logger/shared';

// ── calculateShannonEntropy ───────────────────────────────────────────────────

describe('calculateShannonEntropy', () => {
  it('returns 0 for an empty string', () => {
    expect(calculateShannonEntropy('')).toBe(0);
  });

  it('returns 0 for a string where all characters are identical', () => {
    expect(calculateShannonEntropy('aaaaaaa')).toBe(0);
  });

  it('returns log2(n) for a string with n unique characters each appearing once', () => {
    // "ab" → 2 unique chars → entropy = log2(2) = 1
    expect(calculateShannonEntropy('ab')).toBeCloseTo(1, 5);
    // "abcd" → 4 unique chars → entropy = log2(4) = 2
    expect(calculateShannonEntropy('abcd')).toBeCloseTo(2, 5);
  });

  it('returns a value between 0 and log2(n) for non-uniform distributions', () => {
    // "aaab" → p(a)=0.75, p(b)=0.25
    const entropy = calculateShannonEntropy('aaab');
    expect(entropy).toBeGreaterThan(0);
    expect(entropy).toBeLessThan(1);
  });

  it('returns a single character with entropy 0', () => {
    expect(calculateShannonEntropy('x')).toBe(0);
  });
});

// ── classifyUUID ─────────────────────────────────────────────────────────────

describe('classifyUUID', () => {
  it('classifies a v1 UUID', () => {
    expect(classifyUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toEqual([ValueType.UUID_V1]);
  });

  it('classifies a v3 UUID', () => {
    expect(classifyUUID('6ba7b810-9dad-31d1-80b4-00c04fd430c8')).toEqual([ValueType.UUID_V3]);
  });

  it('classifies a v4 UUID', () => {
    expect(classifyUUID('550e8400-e29b-41d4-a716-446655440000')).toEqual([ValueType.UUID_V4]);
  });

  it('classifies a v5 UUID', () => {
    expect(classifyUUID('6ba7b810-9dad-51d1-80b4-00c04fd430c8')).toEqual([ValueType.UUID_V5]);
  });

  it('classifies a v6 UUID', () => {
    expect(classifyUUID('6ba7b810-9dad-61d1-80b4-00c04fd430c8')).toEqual([ValueType.UUID_V6]);
  });

  it('classifies a v7 UUID', () => {
    expect(classifyUUID('01917456-f2e3-7ada-b3fb-91f7fac71eec')).toEqual([ValueType.UUID_V7]);
  });

  it('classifies a v8 UUID', () => {
    expect(classifyUUID('550e8400-e29b-81d4-a716-446655440000')).toEqual([ValueType.UUID_V8]);
  });

  it('accepts mixed-case UUIDs', () => {
    expect(classifyUUID('550E8400-E29B-41D4-A716-446655440000')).toEqual([ValueType.UUID_V4]);
  });

  it('classifies a compound uuid@timestamp (10 digits)', () => {
    const result = classifyUUID('550e8400-e29b-41d4-a716-446655440000@1716000000');
    expect(result).toContain(ValueType.UUID_V4);
    expect(result).toContain(ValueType.UUID_COMPOUND);
    expect(result).toHaveLength(2);
  });

  it('classifies a compound uuid@timestamp (13 digits)', () => {
    const result = classifyUUID('01917456-f2e3-7ada-b3fb-91f7fac71eec@1716000000000');
    expect(result).toContain(ValueType.UUID_V7);
    expect(result).toContain(ValueType.UUID_COMPOUND);
  });

  it('classifies a compound uuid@timestamp (16 digits)', () => {
    const result = classifyUUID('550e8400-e29b-41d4-a716-446655440000@1716000000000000');
    expect(result).toContain(ValueType.UUID_COMPOUND);
  });

  it('falls back to UUID for v2 (DCE Security / generic version nibble 2)', () => {
    expect(classifyUUID('6ba7b810-9dad-21d1-80b4-00c04fd430c8')).toEqual([ValueType.UUID]);
  });

  it('falls back to UUID for version nibble 0 (generic fallback)', () => {
    expect(classifyUUID('6ba7b810-9dad-01d1-80b4-00c04fd430c8')).toEqual([ValueType.UUID]);
  });

  it('returns empty array for a non-UUID string', () => {
    expect(classifyUUID('not-a-uuid')).toEqual([]);
  });

  it('returns empty array for an email address (not a UUID)', () => {
    expect(classifyUUID('user@example.com')).toEqual([]);
  });
});

// ── classifyValue ─────────────────────────────────────────────────────────────

describe('classifyValue', () => {
  it('EMPTY — empty string', () => {
    expect(classifyValue('')).toEqual([ValueType.EMPTY]);
  });

  it('BOOLEAN — true (case-insensitive)', () => {
    expect(classifyValue('true')).toEqual([ValueType.BOOLEAN]);
    expect(classifyValue('True')).toEqual([ValueType.BOOLEAN]);
    expect(classifyValue('TRUE')).toEqual([ValueType.BOOLEAN]);
  });

  it('BOOLEAN — false (case-insensitive)', () => {
    expect(classifyValue('false')).toEqual([ValueType.BOOLEAN]);
    expect(classifyValue('False')).toEqual([ValueType.BOOLEAN]);
    expect(classifyValue('FALSE')).toEqual([ValueType.BOOLEAN]);
  });

  it('INTEGER — positive integer', () => {
    expect(classifyValue('42')).toEqual([ValueType.INTEGER]);
  });

  it('INTEGER — zero', () => {
    expect(classifyValue('0')).toEqual([ValueType.INTEGER]);
  });

  it('DECIMAL — decimal number', () => {
    expect(classifyValue('3.14')).toEqual([ValueType.DECIMAL]);
  });

  it('UUID_V4 — standard UUID', () => {
    expect(classifyValue('550e8400-e29b-41d4-a716-446655440000')).toEqual([ValueType.UUID_V4]);
  });

  it('JWT — valid long JWT', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
      '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
      '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect(classifyValue(jwt)).toEqual([ValueType.JWT]);
  });

  it('STRING (not JWT) — short dot-separated value like www.firmy.cz', () => {
    // Regression: must not be classified as JWT
    expect(classifyValue('www.firmy.cz')).toEqual([ValueType.STRING]);
  });

  it('STRING (not JWT) — three parts but last segment too short (<20 chars)', () => {
    // Construct a value >=50 chars total with a short last segment
    const short = 'a'.repeat(20) + '.' + 'b'.repeat(20) + '.' + 'c'.repeat(8);
    expect(classifyValue(short)).toEqual([ValueType.STRING]);
  });

  it('EMAIL — email address', () => {
    expect(classifyValue('user@example.com')).toEqual([ValueType.EMAIL]);
  });

  it('URL — http URL', () => {
    expect(classifyValue('http://example.com/path')).toEqual([ValueType.URL]);
  });

  it('URL — https URL', () => {
    expect(classifyValue('https://example.com')).toEqual([ValueType.URL]);
  });

  it('HASH — 16 lowercase hex chars', () => {
    expect(classifyValue('abcdef1234567890')).toEqual([ValueType.HASH]);
  });

  it('HASH — 40 hex chars (SHA-1)', () => {
    expect(classifyValue('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toEqual([ValueType.HASH]);
  });

  it('BASE64 — valid base64 string (length multiple of 4, correct chars)', () => {
    // base64("abcd") = "YWJjZA==" (8 chars)
    expect(classifyValue('YWJjZA==')).toEqual([ValueType.BASE64]);
  });

  it('INTEGER — 10-digit number (INTEGER check runs before TIMESTAMP for pure-digit strings)', () => {
    // The INTEGER regex /^\d+$/ matches before the 10/13/16-digit TIMESTAMP regexes,
    // so digit-only timestamps are classified as INTEGER.
    expect(classifyValue('1716000000')).toEqual([ValueType.INTEGER]);
  });

  it('INTEGER — 13-digit number (same ordering: INTEGER before TIMESTAMP)', () => {
    expect(classifyValue('1716000000000')).toEqual([ValueType.INTEGER]);
  });

  it('INTEGER — 16-digit number (same ordering: INTEGER before TIMESTAMP)', () => {
    expect(classifyValue('1716000000000000')).toEqual([ValueType.INTEGER]);
  });

  it('TIMESTAMP — ISO 8601 date-time string', () => {
    expect(classifyValue('2024-01-15T12:00:00Z')).toEqual([ValueType.TIMESTAMP]);
  });

  it('IP — valid IPv4 address', () => {
    expect(classifyValue('192.168.1.1')).toEqual([ValueType.IP]);
  });

  it('IP — IPv4 with octet exactly 255', () => {
    expect(classifyValue('255.255.255.255')).toEqual([ValueType.IP]);
  });

  it('STRING (not IP) — IPv4 with octet > 255', () => {
    expect(classifyValue('999.1.1.1')).not.toEqual([ValueType.IP]);
  });

  it('IP — compressed IPv6 loopback', () => {
    expect(classifyValue('::1')).toEqual([ValueType.IP]);
  });

  it('IP — compressed IPv6 address', () => {
    expect(classifyValue('2001:db8::1')).toEqual([ValueType.IP]);
  });

  it('SERIALIZED — PHP serialized object', () => {
    expect(classifyValue('O:8:"stdClass":0:{}')).toEqual([ValueType.SERIALIZED]);
  });

  it('SERIALIZED — Java serialized (aced prefix with non-base64 chars)', () => {
    // "aced_data" contains '_' which is outside base64 alphabet [A-Za-z0-9+/=],
    // so BASE64 check fails; the /^aced/i guard then classifies it as SERIALIZED.
    expect(classifyValue('aced_data')).toEqual([ValueType.SERIALIZED]);
  });

  it('SERIALIZED — Java serialized short aced prefix (too short for BASE64)', () => {
    // Length 5 < 8 so BASE64 guard fails; SERIALIZED wins.
    expect(classifyValue('aced0')).toEqual([ValueType.SERIALIZED]);
  });

  it('STRING — fallback for unrecognised values', () => {
    expect(classifyValue('hello-world')).toEqual([ValueType.STRING]);
  });
});
