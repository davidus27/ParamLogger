import { describe, it, expect } from 'vitest';
import { normalizePath } from '../normalize';

describe('normalizePath', () => {
  it('returns / for root path', () => {
    expect(normalizePath('/')).toBe('/');
  });

  it('returns / for empty string', () => {
    expect(normalizePath('')).toBe('/');
  });

  it('preserves a single real segment', () => {
    expect(normalizePath('/users')).toBe('/users');
  });

  it('replaces a numeric segment with {id}', () => {
    expect(normalizePath('/users/42')).toBe('/users/{id}');
  });

  it('replaces a large numeric segment with {id}', () => {
    expect(normalizePath('/orders/9999999999')).toBe('/orders/{id}');
  });

  it('replaces a UUID v4 segment with {uuid}', () => {
    expect(normalizePath('/items/550e8400-e29b-41d4-a716-446655440000')).toBe('/items/{uuid}');
  });

  it('replaces a UUID v1 segment with {uuid}', () => {
    expect(normalizePath('/items/6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('/items/{uuid}');
  });

  it('replaces a UUID v7 segment with {uuid}', () => {
    expect(normalizePath('/items/01917456-f2e3-7ada-b3fb-91f7fac71eec')).toBe('/items/{uuid}');
  });

  it('replaces a UUID in mixed case with {uuid}', () => {
    expect(normalizePath('/items/550E8400-E29B-41D4-A716-446655440000')).toBe('/items/{uuid}');
  });

  it('replaces a 9-char hex segment with {hash}', () => {
    expect(normalizePath('/files/abcdef123')).toBe('/files/{hash}');
  });

  it('replaces a 40-char hex segment (SHA-1) with {hash}', () => {
    expect(normalizePath('/commits/da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe('/commits/{hash}');
  });

  it('replaces a 64-char hex segment (SHA-256) with {hash}', () => {
    const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    expect(normalizePath(`/blobs/${sha256}`)).toBe('/blobs/{hash}');
  });

  it('replaces a long alphanumeric segment (>10 chars) with {id}', () => {
    expect(normalizePath('/sessions/XyZ1234567890')).toBe('/sessions/{id}');
  });

  it('preserves a short alphanumeric segment that contains non-hex chars', () => {
    // "v2beta" has 'v' which is not a hex char, so it won't match the hash pattern
    expect(normalizePath('/api/v2beta')).toBe('/api/v2beta');
  });

  it('handles mixed real and dynamic segments', () => {
    expect(normalizePath('/api/v1/users/42/posts/da39a3ee5e6b4b0d3255bfef95601890afd80709'))
      .toBe('/api/v1/users/{id}/posts/{hash}');
  });

  it('handles trailing slash by ignoring it', () => {
    expect(normalizePath('/users/42/')).toBe('/users/{id}');
  });

  it('handles deep nested path with UUID and number', () => {
    expect(normalizePath('/org/550e8400-e29b-41d4-a716-446655440000/resource/99'))
      .toBe('/org/{uuid}/resource/{id}');
  });

  it('preserves a segment that is an 8-char hex (below hash threshold)', () => {
    // 8 hex chars does not meet the /^[a-f0-9]{9,64}$/ threshold
    expect(normalizePath('/x/deadbeef')).toBe('/x/deadbeef');
  });
});
