import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeStaticFlags, recomputeNewFlag } from '../flags';
import { Flag, ValueType } from '@param-logger/shared';

// ── computeStaticFlags ────────────────────────────────────────────────────────

describe('computeStaticFlags — name-based flags', () => {
  it('sets SENSITIVE for a password parameter name', () => {
    expect(computeStaticFlags('password', 'secret123', [ValueType.STRING])).toContain(Flag.SENSITIVE);
  });

  it('sets SENSITIVE for a token parameter name', () => {
    expect(computeStaticFlags('access_token', 'abc', [ValueType.STRING])).toContain(Flag.SENSITIVE);
  });

  it('sets REDIRECT for a redirect parameter name', () => {
    expect(computeStaticFlags('redirect_uri', 'https://example.com', [ValueType.URL])).toContain(Flag.REDIRECT);
  });

  it('sets REDIRECT for a next parameter name', () => {
    expect(computeStaticFlags('next', '/dashboard', [ValueType.STRING])).toContain(Flag.REDIRECT);
  });

  it('sets FILE for a file parameter name', () => {
    expect(computeStaticFlags('file', '/etc/passwd', [ValueType.STRING])).toContain(Flag.FILE);
  });

  it('sets FILE for a path parameter name', () => {
    expect(computeStaticFlags('path', '/tmp/file.txt', [ValueType.STRING])).toContain(Flag.FILE);
  });

  it('sets AUTH for a user parameter name', () => {
    expect(computeStaticFlags('user', 'alice', [ValueType.STRING])).toContain(Flag.AUTH);
  });

  it('sets AUTH for a role parameter name', () => {
    expect(computeStaticFlags('role', 'admin', [ValueType.STRING])).toContain(Flag.AUTH);
  });

  it('sets SSTI for a template parameter name', () => {
    expect(computeStaticFlags('template', '{{7*7}}', [ValueType.STRING])).toContain(Flag.SSTI);
  });

  it('sets SSTI for a render parameter name', () => {
    expect(computeStaticFlags('render', 'twig', [ValueType.STRING])).toContain(Flag.SSTI);
  });

  it('sets INJECTION for a query parameter name', () => {
    expect(computeStaticFlags('query', "1' OR '1'='1", [ValueType.STRING])).toContain(Flag.INJECTION);
  });

  it('sets INJECTION for a sql parameter name', () => {
    expect(computeStaticFlags('sql', 'SELECT 1', [ValueType.STRING])).toContain(Flag.INJECTION);
  });

  it('sets DEBUG for a debug parameter name', () => {
    expect(computeStaticFlags('debug', '1', [ValueType.INTEGER])).toContain(Flag.DEBUG);
  });

  it('sets DEBUG for an admin parameter name', () => {
    expect(computeStaticFlags('admin', 'true', [ValueType.BOOLEAN])).toContain(Flag.DEBUG);
  });
});

describe('computeStaticFlags — IDOR detection', () => {
  it('sets IDOR when name matches IDOR pattern AND value type is INTEGER', () => {
    // IDOR_NAME_PATTERNS = [/auth/i], so "auth_id" matches
    const flags = computeStaticFlags('auth_id', '42', [ValueType.INTEGER]);
    expect(flags).toContain(Flag.IDOR);
  });

  it('does NOT set IDOR when name matches but value type is not INTEGER', () => {
    const flags = computeStaticFlags('auth_id', 'abc', [ValueType.STRING]);
    expect(flags).not.toContain(Flag.IDOR);
  });

  it('does NOT set IDOR when value is INTEGER but name does not match IDOR patterns', () => {
    const flags = computeStaticFlags('offset', '5', [ValueType.INTEGER]);
    expect(flags).not.toContain(Flag.IDOR);
  });
});

describe('computeStaticFlags — PROTO_POLLUTION detection', () => {
  it('sets PROTO_POLLUTION for __proto__', () => {
    expect(computeStaticFlags('__proto__', '{}', [ValueType.STRING])).toContain(Flag.PROTO_POLLUTION);
  });

  it('sets PROTO_POLLUTION for constructor', () => {
    expect(computeStaticFlags('constructor', 'fn', [ValueType.STRING])).toContain(Flag.PROTO_POLLUTION);
  });

  it('sets PROTO_POLLUTION for prototype', () => {
    expect(computeStaticFlags('prototype', '{}', [ValueType.STRING])).toContain(Flag.PROTO_POLLUTION);
  });

  it('sets PROTO_POLLUTION for a substring match like foo.__proto__.bar', () => {
    expect(computeStaticFlags('foo.__proto__.bar', 'x', [ValueType.STRING])).toContain(Flag.PROTO_POLLUTION);
  });
});

describe('computeStaticFlags — value-based SENSITIVE detection', () => {
  it('sets SENSITIVE for JWT value type', () => {
    const flags = computeStaticFlags('token', 'somevalue', [ValueType.JWT]);
    expect(flags).toContain(Flag.SENSITIVE);
  });

  it('sets SENSITIVE for HASH value type with value longer than 20 chars', () => {
    const hash = 'da39a3ee5e6b4b0d3255bfef95601890afd80709'; // 40 chars
    const flags = computeStaticFlags('checksum', hash, [ValueType.HASH]);
    expect(flags).toContain(Flag.SENSITIVE);
  });

  it('does NOT set SENSITIVE for HASH value type with value 20 chars or shorter', () => {
    const shortHash = 'abcdef1234567890abcd'; // exactly 20 chars
    const flags = computeStaticFlags('h', shortHash, [ValueType.HASH]);
    expect(flags).not.toContain(Flag.SENSITIVE);
  });

  it('sets SENSITIVE for an AWS AKIA key', () => {
    const flags = computeStaticFlags('key', 'AKIAIOSFODNN7EXAMPLE', [ValueType.STRING]);
    expect(flags).toContain(Flag.SENSITIVE);
  });

  it('sets SENSITIVE for a PEM certificate header', () => {
    const flags = computeStaticFlags('cert', '-----BEGIN CERTIFICATE-----\nMIID...', [ValueType.STRING]);
    expect(flags).toContain(Flag.SENSITIVE);
  });

  it('sets SENSITIVE for a PEM private key header', () => {
    const flags = computeStaticFlags('key', '-----BEGIN RSA KEY-----\nMIIE...', [ValueType.STRING]);
    expect(flags).toContain(Flag.SENSITIVE);
  });

  it('sets SENSITIVE for a high-entropy STRING value (>4.5 bits/char)', () => {
    // 32 unique chars → entropy = log2(32) = 5 > 4.5, length >= 8
    const highEntropyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef'; // 32 chars, all unique
    const flags = computeStaticFlags('x', highEntropyStr, [ValueType.STRING]);
    expect(flags).toContain(Flag.SENSITIVE);
  });

  it('does NOT set SENSITIVE for a low-entropy STRING value', () => {
    // "aaabbbccc" — entropy ≈ 1.58 < 4.5
    const flags = computeStaticFlags('x', 'aaabbbccc', [ValueType.STRING]);
    expect(flags).not.toContain(Flag.SENSITIVE);
  });

  it('does NOT add SENSITIVE twice when name and value both trigger it', () => {
    // "password" name triggers SENSITIVE via name pattern
    // JWT value type also triggers SENSITIVE via value pattern
    const flags = computeStaticFlags('password', 'somevalue', [ValueType.JWT]);
    expect(flags.filter(f => f === Flag.SENSITIVE)).toHaveLength(1);
  });
});

describe('computeStaticFlags — no spurious flags', () => {
  it('returns an empty array for a plain innocuous parameter', () => {
    expect(computeStaticFlags('color', 'blue', [ValueType.STRING])).toEqual([]);
  });
});

// ── recomputeNewFlag ──────────────────────────────────────────────────────────

describe('recomputeNewFlag', () => {
  it('adds NEW flag when first seen is within 24 hours', () => {
    const recent = new Date(Date.now() - 1000); // 1 second ago
    const flags = recomputeNewFlag([], recent);
    expect(flags).toContain(Flag.NEW);
  });

  it('does NOT add NEW flag when first seen is older than 24 hours', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    const flags = recomputeNewFlag([], old);
    expect(flags).not.toContain(Flag.NEW);
  });

  it('removes existing NEW flag when parameter is older than threshold', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const flags = recomputeNewFlag([Flag.NEW, Flag.SENSITIVE], old);
    expect(flags).not.toContain(Flag.NEW);
    expect(flags).toContain(Flag.SENSITIVE);
  });

  it('keeps NEW when called again within 24h (idempotent for fresh params)', () => {
    const recent = new Date(Date.now() - 1000);
    const first = recomputeNewFlag([], recent);
    const second = recomputeNewFlag(first, recent);
    expect(second.filter(f => f === Flag.NEW)).toHaveLength(1);
  });

  it('preserves other flags order when adding NEW', () => {
    const recent = new Date(Date.now() - 1000);
    const input = [Flag.SENSITIVE, Flag.REDIRECT];
    const result = recomputeNewFlag(input, recent);
    // SENSITIVE and REDIRECT should still be present
    expect(result).toContain(Flag.SENSITIVE);
    expect(result).toContain(Flag.REDIRECT);
    expect(result).toContain(Flag.NEW);
  });

  it('preserves other flags when removing NEW', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const input = [Flag.SENSITIVE, Flag.NEW, Flag.FILE];
    const result = recomputeNewFlag(input, old);
    expect(result).toContain(Flag.SENSITIVE);
    expect(result).toContain(Flag.FILE);
    expect(result).not.toContain(Flag.NEW);
  });
});
