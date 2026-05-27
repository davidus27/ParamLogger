import { describe, it, expect } from 'vitest';
import { parseCookieString, parseSetCookie } from '../cookies';

describe('parseCookieString', () => {
  it('returns empty object for empty string', () => {
    expect(parseCookieString('')).toEqual({});
  });

  it('parses a single name=value pair', () => {
    expect(parseCookieString('session=abc123')).toEqual({ session: 'abc123' });
  });

  it('parses multiple name=value pairs separated by semicolons', () => {
    expect(parseCookieString('a=1; b=2; c=3')).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('trims whitespace around names and values', () => {
    expect(parseCookieString('  foo  =  bar  ')).toEqual({ foo: 'bar' });
  });

  it('handles a key-only pair (no = sign) as empty string value', () => {
    expect(parseCookieString('flagonly')).toEqual({ flagonly: '' });
  });

  it('handles a value containing = signs', () => {
    expect(parseCookieString('token=abc=def=ghi')).toEqual({ token: 'abc=def=ghi' });
  });

  it('handles a trailing semicolon', () => {
    expect(parseCookieString('x=1;')).toEqual({ x: '1' });
  });

  it('handles multiple pairs with trailing semicolon', () => {
    expect(parseCookieString('a=1; b=2;')).toEqual({ a: '1', b: '2' });
  });
});

describe('parseSetCookie', () => {
  it('returns empty array for empty string', () => {
    expect(parseSetCookie('')).toEqual([]);
  });

  it('parses a plain k=v cookie', () => {
    expect(parseSetCookie('session=xyz')).toEqual([{ name: 'session', value: 'xyz' }]);
  });

  it('parses cookie with Path attribute', () => {
    expect(parseSetCookie('id=42; Path=/')).toEqual([{ name: 'id', value: '42' }]);
  });

  it('parses cookie with HttpOnly attribute', () => {
    expect(parseSetCookie('token=abc; HttpOnly')).toEqual([{ name: 'token', value: 'abc' }]);
  });

  it('parses cookie with Max-Age attribute', () => {
    expect(parseSetCookie('pref=dark; Max-Age=3600; Path=/')).toEqual([{ name: 'pref', value: 'dark' }]);
  });

  it('returns empty array when there is no = in the main part', () => {
    // equalIndex is not > 0 when there is no '='
    expect(parseSetCookie('justflag; HttpOnly')).toEqual([]);
  });

  it('returns empty array when = is the first character (empty name)', () => {
    expect(parseSetCookie('=value')).toEqual([]);
  });

  it('handles multiple semicolons (extra attributes)', () => {
    expect(parseSetCookie('csrf=tok; Path=/; Secure; SameSite=Strict')).toEqual([
      { name: 'csrf', value: 'tok' },
    ]);
  });

  it('handles value containing =', () => {
    expect(parseSetCookie('data=a=b=c; Path=/')).toEqual([{ name: 'data', value: 'a=b=c' }]);
  });
});
