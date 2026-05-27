import { describe, it, expect } from 'vitest';
import { flattenObject, valueToString } from '../flatten';

describe('flattenObject', () => {
  it('returns a flat copy for a flat object', () => {
    expect(flattenObject({ a: 1, b: 'two' })).toEqual({ a: 1, b: 'two' });
  });

  it('flattens a nested object with dot notation', () => {
    expect(flattenObject({ user: { name: 'Alice', age: 30 } })).toEqual({
      'user.name': 'Alice',
      'user.age': 30,
    });
  });

  it('prepends a prefix when supplied', () => {
    expect(flattenObject({ id: '1' }, 'variables')).toEqual({ 'variables.id': '1' });
  });

  it('stores an array of primitives under key[] and individual indices', () => {
    const result = flattenObject({ tags: ['a', 'b', 'c'] });
    // The whole array is stored under key[]
    expect(result['tags[]']).toEqual(['a', 'b', 'c']);
    // Primitive items (non-objects) are NOT expanded further
  });

  it('expands an array of objects with indexed dot notation', () => {
    const result = flattenObject({ items: [{ id: 1 }, { id: 2 }] });
    expect(result['items[0].id']).toBe(1);
    expect(result['items[1].id']).toBe(2);
  });

  it('handles null values', () => {
    expect(flattenObject({ x: null })).toEqual({ x: null });
  });

  it('handles undefined values', () => {
    expect(flattenObject({ x: undefined })).toEqual({ x: undefined });
  });

  it('handles deeply nested structures', () => {
    const result = flattenObject({ a: { b: { c: 42 } } });
    expect(result['a.b.c']).toBe(42);
  });

  it('handles mixed flat and nested keys', () => {
    const result = flattenObject({ top: 'val', nested: { inner: true } });
    expect(result['top']).toBe('val');
    expect(result['nested.inner']).toBe(true);
  });
});

describe('valueToString', () => {
  it('returns "null" for null', () => {
    expect(valueToString(null)).toBe('null');
  });

  it('returns "undefined" for undefined', () => {
    expect(valueToString(undefined)).toBe('undefined');
  });

  it('returns the string as-is', () => {
    expect(valueToString('hello')).toBe('hello');
  });

  it('converts a number to string', () => {
    expect(valueToString(42)).toBe('42');
    expect(valueToString(3.14)).toBe('3.14');
  });

  it('converts a boolean to string', () => {
    expect(valueToString(true)).toBe('true');
    expect(valueToString(false)).toBe('false');
  });

  it('JSON-serialises an array', () => {
    expect(valueToString([1, 2, 3])).toBe('[1,2,3]');
  });

  it('JSON-serialises a plain object', () => {
    expect(valueToString({ a: 1 })).toBe('{"a":1}');
  });

  it('falls back to String() for a symbol', () => {
    const sym = Symbol('test');
    expect(valueToString(sym)).toBe(sym.toString());
  });
});
