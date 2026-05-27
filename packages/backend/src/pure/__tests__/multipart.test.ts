import { describe, it, expect } from 'vitest';
import { escapeRegex, extractMultipartBoundary, isBinaryContent, parseMultipartParts } from '../multipart';

describe('escapeRegex', () => {
  it('escapes all special regex metacharacters', () => {
    const specials = '.*+?^${}()|[]\\';
    const escaped = escapeRegex(specials);
    // Every special char should now appear with a preceding backslash
    expect(() => new RegExp(escaped)).not.toThrow();
    const re = new RegExp(escaped);
    expect(re.test(specials)).toBe(true);
  });

  it('does not alter plain alphanumeric strings', () => {
    expect(escapeRegex('abc123')).toBe('abc123');
  });

  it('escapes a dot', () => {
    expect(escapeRegex('.')).toBe('\\.');
  });

  it('escapes a pipe', () => {
    expect(escapeRegex('|')).toBe('\\|');
  });

  it('escapes square brackets', () => {
    expect(escapeRegex('[x]')).toBe('\\[x\\]');
  });
});

describe('extractMultipartBoundary', () => {
  it('extracts unquoted boundary from Content-Type header', () => {
    expect(extractMultipartBoundary('', 'multipart/form-data; boundary=----WebKitBoundary123'))
      .toBe('----WebKitBoundary123');
  });

  it('strips quotes from quoted boundary value', () => {
    expect(extractMultipartBoundary('', 'multipart/form-data; boundary="----WebKitBoundary123"'))
      .toBe('----WebKitBoundary123');
  });

  it('handles boundary with extra params after it', () => {
    const ct = 'multipart/form-data; boundary=abc123; charset=utf-8';
    expect(extractMultipartBoundary('', ct)).toBe('abc123');
  });

  it('falls back to body when no Content-Type header supplied', () => {
    const body = '--myboundary\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--myboundary--';
    expect(extractMultipartBoundary(body)).toBe('myboundary');
  });

  it('falls back to body when Content-Type header has no boundary param', () => {
    const body = '--fallback\r\nContent-Disposition: form-data; name="x"\r\n\r\ny\r\n--fallback--';
    expect(extractMultipartBoundary(body, 'multipart/form-data')).toBe('fallback');
  });

  it('returns null when neither header nor body contains a boundary', () => {
    expect(extractMultipartBoundary('no boundary here at all')).toBeNull();
  });
});

describe('isBinaryContent', () => {
  it('returns true for image/* content type', () => {
    expect(isBinaryContent('Content-Type: image/png', 'PNG binary data here')).toBe(true);
  });

  it('returns true for application/octet-stream', () => {
    expect(isBinaryContent('Content-Type: application/octet-stream', 'raw bytes')).toBe(true);
  });

  it('returns true for application/pdf', () => {
    expect(isBinaryContent('Content-Type: application/pdf', '%PDF-1.4 content')).toBe(true);
  });

  it('returns false for text/plain content type', () => {
    const body = 'a'.repeat(200);
    expect(isBinaryContent('Content-Type: text/plain', body)).toBe(false);
  });

  it('returns false for short content regardless of non-printable characters', () => {
    // Under 100 chars the heuristic is skipped
    const binary = '\x00\x01\x02'.repeat(10);
    expect(isBinaryContent('Content-Type: text/plain', binary)).toBe(false);
  });

  it('returns true when >20% of characters are non-printable (long content)', () => {
    // 150 printable + 50 non-printable = 25% non-printable → binary
    const content = 'a'.repeat(150) + '\x00'.repeat(50);
    expect(isBinaryContent('', content)).toBe(true);
  });

  it('returns false when <=20% of characters are non-printable (long content)', () => {
    // 180 printable + 20 non-printable = ~10% → not binary
    const content = 'a'.repeat(180) + '\x01'.repeat(20);
    expect(isBinaryContent('', content)).toBe(false);
  });
});

describe('parseMultipartParts', () => {
  const BOUNDARY = 'TestBoundary';

  it('parses a single text field', () => {
    const body = [
      `--${BOUNDARY}`,
      'Content-Disposition: form-data; name="username"',
      '',
      'alice',
      `--${BOUNDARY}--`,
    ].join('\r\n');

    const parts = parseMultipartParts(body, BOUNDARY);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ name: 'username', value: 'alice' });
  });

  it('parses multiple text fields', () => {
    const body = [
      `--${BOUNDARY}`,
      'Content-Disposition: form-data; name="first"',
      '',
      'foo',
      `--${BOUNDARY}`,
      'Content-Disposition: form-data; name="second"',
      '',
      'bar',
      `--${BOUNDARY}--`,
    ].join('\r\n');

    const parts = parseMultipartParts(body, BOUNDARY);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ name: 'first', value: 'foo' });
    expect(parts[1]).toEqual({ name: 'second', value: 'bar' });
  });

  it('stores [binary data] for binary parts (image)', () => {
    const body = [
      `--${BOUNDARY}`,
      'Content-Disposition: form-data; name="avatar"; filename="photo.png"',
      'Content-Type: image/png',
      '',
      '\x89PNG\r\n\x1a\n',
      `--${BOUNDARY}--`,
    ].join('\r\n');

    const parts = parseMultipartParts(body, BOUNDARY);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ name: 'avatar', value: '[binary data]' });
  });

  it('skips segments without a blank line (malformed, no body separator)', () => {
    // No blank line between headers and body means headerBodySplit.length < 2
    const body = [
      `--${BOUNDARY}`,
      'Content-Disposition: form-data; name="broken"',
      `--${BOUNDARY}--`,
    ].join('\r\n');

    // The malformed part should be skipped
    const parts = parseMultipartParts(body, BOUNDARY);
    expect(parts).toHaveLength(0);
  });

  it('ignores terminating -- segment', () => {
    const body = [
      `--${BOUNDARY}`,
      'Content-Disposition: form-data; name="field"',
      '',
      'value',
      `--${BOUNDARY}--`,
    ].join('\r\n');

    const parts = parseMultipartParts(body, BOUNDARY);
    expect(parts).toHaveLength(1);
  });
});
