import { describe, it, expect } from 'vitest';
import { ValueType } from '@param-logger/shared';
import { isUUIDValueType, matchesValueTypeFilter } from '../valueTypes';

// ────────────────────────────────────────────────────────────────────────────
// isUUIDValueType
// ────────────────────────────────────────────────────────────────────────────

describe('isUUIDValueType', () => {
  it('returns true for generic UUID', () => {
    expect(isUUIDValueType(ValueType.UUID)).toBe(true);
  });

  it('returns true for all versioned UUID variants', () => {
    const uuidVariants: ValueType[] = [
      ValueType.UUID_V1,
      ValueType.UUID_V3,
      ValueType.UUID_V4,
      ValueType.UUID_V5,
      ValueType.UUID_V6,
      ValueType.UUID_V7,
      ValueType.UUID_V8,
      ValueType.UUID_COMPOUND,
    ];
    for (const variant of uuidVariants) {
      expect(isUUIDValueType(variant)).toBe(true);
    }
  });

  it('returns false for non-UUID types', () => {
    const nonUUIDTypes: ValueType[] = [
      ValueType.EMPTY,
      ValueType.BOOLEAN,
      ValueType.INTEGER,
      ValueType.DECIMAL,
      ValueType.STRING,
      ValueType.EMAIL,
      ValueType.URL,
      ValueType.JWT,
      ValueType.BASE64,
      ValueType.HASH,
      ValueType.TIMESTAMP,
      ValueType.IP,
      ValueType.SERIALIZED,
      ValueType.UNKNOWN,
    ];
    for (const t of nonUUIDTypes) {
      expect(isUUIDValueType(t)).toBe(false);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// matchesValueTypeFilter
// ────────────────────────────────────────────────────────────────────────────

describe('matchesValueTypeFilter', () => {
  it('returns true when active set is empty (no filter active)', () => {
    expect(matchesValueTypeFilter([], new Set())).toBe(true);
    expect(matchesValueTypeFilter([ValueType.INTEGER], new Set())).toBe(true);
  });

  it('returns true for exact match between param types and active filter', () => {
    expect(
      matchesValueTypeFilter([ValueType.EMAIL], new Set([ValueType.EMAIL])),
    ).toBe(true);
  });

  it('returns false when param has no types that match the active filter', () => {
    expect(
      matchesValueTypeFilter([ValueType.INTEGER], new Set([ValueType.EMAIL])),
    ).toBe(false);
  });

  it('returns false when param has no types at all and active filter is non-empty', () => {
    expect(matchesValueTypeFilter([], new Set([ValueType.JWT]))).toBe(false);
  });

  it('OR semantics: returns true if any param type matches any active filter', () => {
    expect(
      matchesValueTypeFilter(
        [ValueType.EMAIL, ValueType.INTEGER],
        new Set([ValueType.URL, ValueType.EMAIL]),
      ),
    ).toBe(true);
  });

  it('generic UUID in active set matches UUID_V1', () => {
    expect(
      matchesValueTypeFilter([ValueType.UUID_V1], new Set([ValueType.UUID])),
    ).toBe(true);
  });

  it('generic UUID in active set matches UUID_V4', () => {
    expect(
      matchesValueTypeFilter([ValueType.UUID_V4], new Set([ValueType.UUID])),
    ).toBe(true);
  });

  it('generic UUID in active set matches all uuid_ variants', () => {
    const allVariants: ValueType[] = [
      ValueType.UUID,
      ValueType.UUID_V1,
      ValueType.UUID_V3,
      ValueType.UUID_V4,
      ValueType.UUID_V5,
      ValueType.UUID_V6,
      ValueType.UUID_V7,
      ValueType.UUID_V8,
      ValueType.UUID_COMPOUND,
    ];
    for (const v of allVariants) {
      expect(
        matchesValueTypeFilter([v], new Set([ValueType.UUID])),
      ).toBe(true);
    }
  });

  it('generic UUID in active set does NOT match non-UUID types', () => {
    expect(
      matchesValueTypeFilter([ValueType.INTEGER], new Set([ValueType.UUID])),
    ).toBe(false);
    expect(
      matchesValueTypeFilter([ValueType.STRING], new Set([ValueType.UUID])),
    ).toBe(false);
  });

  it('specific UUID version in active set only matches that version (not via generic)', () => {
    // UUID_V1 filter should match UUID_V1 but not UUID_V4
    expect(
      matchesValueTypeFilter([ValueType.UUID_V1], new Set([ValueType.UUID_V1])),
    ).toBe(true);
    expect(
      matchesValueTypeFilter([ValueType.UUID_V4], new Set([ValueType.UUID_V1])),
    ).toBe(false);
  });

  it('multiple active filters: returns true if any one matches', () => {
    expect(
      matchesValueTypeFilter(
        [ValueType.HASH],
        new Set([ValueType.JWT, ValueType.HASH, ValueType.IP]),
      ),
    ).toBe(true);
  });
});
