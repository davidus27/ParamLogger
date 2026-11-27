import { describe, it, expect } from 'vitest';
import { Flag, ValueType } from '@param-logger/shared';
import type { Parameter } from '@param-logger/shared';
import {
  computeRiskScore,
  getRiskScore,
  sortByRisk,
  getRiskClass,
  FLAG_WEIGHTS,
  VALUE_TYPE_WEIGHTS,
} from '../riskScore';

function makeParam(overrides: Partial<Parameter> = {}): Parameter {
  return {
    id: 'test-id',
    domain: 'example.com',
    method: 'GET',
    normalizedPath: '/api/test',
    location: 'query' as any,
    name: 'testParam',
    valueTypes: [],
    flags: [],
    count: 1,
    firstSeen: new Date(),
    lastSeen: new Date(),
    ...overrides,
  };
}

/** A parameter whose `count` getter records its reads; computeRiskScore reads it once per call. */
function countedParam(count: number, overrides: Partial<Parameter> = {}) {
  const reads = { n: 0 };
  const param = makeParam(overrides);
  Object.defineProperty(param, 'count', {
    get: () => {
      reads.n++;
      return count;
    },
  });
  return { param, reads };
}

/** An inventory with many equal scores: flags, value types and counts cycle at different rates. */
function mixedInventory(size: number): Parameter[] {
  const flagSets = [[], [Flag.DEBUG], [Flag.IDOR], [Flag.AUTH, Flag.SENSITIVE], [Flag.REFLECTED, Flag.INJECTION]];
  const typeSets = [[], [ValueType.JWT], [ValueType.BASE64], [ValueType.URL, ValueType.HASH]];
  return Array.from({ length: size }, (_, i) => makeParam({
    id: `p${i}`,
    flags: flagSets[(i * 7) % flagSets.length],
    valueTypes: typeSets[(i * 3) % typeSets.length],
    count: 1 + ((i * 13) % 50),
  }));
}

describe('FLAG_WEIGHTS', () => {
  it('has weights for all security-relevant flags', () => {
    expect(FLAG_WEIGHTS[Flag.REFLECTED]).toBe(30);
    expect(FLAG_WEIGHTS[Flag.IDOR]).toBe(25);
    expect(FLAG_WEIGHTS[Flag.INJECTION]).toBe(20);
    expect(FLAG_WEIGHTS[Flag.SSTI]).toBe(20);
    expect(FLAG_WEIGHTS[Flag.PROTO_POLLUTION]).toBe(20);
    expect(FLAG_WEIGHTS[Flag.FILE]).toBe(15);
    expect(FLAG_WEIGHTS[Flag.REDIRECT]).toBe(15);
    expect(FLAG_WEIGHTS[Flag.SENSITIVE]).toBe(10);
    expect(FLAG_WEIGHTS[Flag.AUTH]).toBe(10);
    expect(FLAG_WEIGHTS[Flag.DEBUG]).toBe(5);
  });
});

describe('VALUE_TYPE_WEIGHTS', () => {
  it('has weights for high-risk value types', () => {
    expect(VALUE_TYPE_WEIGHTS[ValueType.JWT]).toBe(15);
    expect(VALUE_TYPE_WEIGHTS[ValueType.SERIALIZED]).toBe(15);
    expect(VALUE_TYPE_WEIGHTS[ValueType.IP]).toBe(10);
    expect(VALUE_TYPE_WEIGHTS[ValueType.URL]).toBe(10);
    expect(VALUE_TYPE_WEIGHTS[ValueType.HASH]).toBe(8);
    expect(VALUE_TYPE_WEIGHTS[ValueType.BASE64]).toBe(5);
  });
});

describe('computeRiskScore', () => {
  it('returns 0 for a parameter with no flags, no value types, and count=1', () => {
    const p = makeParam({ flags: [], valueTypes: [], count: 1 });
    expect(computeRiskScore(p)).toBe(0);
  });

  it('adds flag scores correctly for a single flag', () => {
    const p = makeParam({ flags: [Flag.DEBUG], valueTypes: [], count: 1 });
    // DEBUG=5, countBonus=log2(1)*3=0
    expect(computeRiskScore(p)).toBe(5);
  });

  it('adds count bonus: log2(count) * 3 capped at 20', () => {
    // count=2 → log2(2)=1 → bonus=3
    expect(computeRiskScore(makeParam({ count: 2 }))).toBe(3);
    // count=4 → log2(4)=2 → bonus=6
    expect(computeRiskScore(makeParam({ count: 4 }))).toBe(6);
    // count=1024 → log2(1024)=10 → bonus=30 → capped at 20
    expect(computeRiskScore(makeParam({ count: 1024 }))).toBe(20);
  });

  it('caps flag score at 60', () => {
    // REFLECTED(30) + IDOR(25) + INJECTION(20) = 75 → capped at 60
    const p = makeParam({
      flags: [Flag.REFLECTED, Flag.IDOR, Flag.INJECTION],
      valueTypes: [],
      count: 1,
    });
    expect(computeRiskScore(p)).toBe(60);
  });

  it('caps value type score at 20', () => {
    // JWT(15) + SERIALIZED(15) = 30 → capped at 20
    const p = makeParam({
      flags: [],
      valueTypes: [ValueType.JWT, ValueType.SERIALIZED],
      count: 1,
    });
    expect(computeRiskScore(p)).toBe(20);
  });

  it('combines all three components correctly', () => {
    // SENSITIVE(10) = 10 flag score
    // JWT(15) = 15 value type score
    // count=2 → 3 bonus
    const p = makeParam({
      flags: [Flag.SENSITIVE],
      valueTypes: [ValueType.JWT],
      count: 2,
    });
    expect(computeRiskScore(p)).toBe(28);
  });

  it('caps total score at 100', () => {
    // REFLECTED(30)+IDOR(25)+INJECTION(20) → flag capped at 60
    // JWT(15)+SERIALIZED(15) → value type capped at 20
    // count=1024 → count capped at 20
    // total = 60 + 20 + 20 = 100
    const p = makeParam({
      flags: [Flag.REFLECTED, Flag.IDOR, Flag.INJECTION],
      valueTypes: [ValueType.JWT, ValueType.SERIALIZED],
      count: 1024,
    });
    expect(computeRiskScore(p)).toBe(100);
  });

  it('rounds the score to the nearest integer', () => {
    // count=3 → log2(3)*3 ≈ 4.755 → rounds to 5
    const p = makeParam({ flags: [], valueTypes: [], count: 3 });
    const score = computeRiskScore(p);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBe(5);
  });

  it('handles unknown flags gracefully (weight = 0)', () => {
    const p = makeParam({ flags: ['unknown_flag' as Flag], count: 1 });
    expect(computeRiskScore(p)).toBe(0);
  });

  it('handles unknown value types gracefully (weight = 0)', () => {
    const p = makeParam({ valueTypes: ['unknown_type' as ValueType], count: 1 });
    expect(computeRiskScore(p)).toBe(0);
  });

  it('treats count=0 as count=1 for log2 (Math.max guard)', () => {
    const p0 = makeParam({ count: 0 });
    const p1 = makeParam({ count: 1 });
    expect(computeRiskScore(p0)).toBe(computeRiskScore(p1));
  });
});

describe('getRiskScore', () => {
  it('returns the same score as computeRiskScore', () => {
    for (const p of mixedInventory(50)) {
      expect(getRiskScore(p)).toBe(computeRiskScore(p));
    }
  });

  it('computes the score once per object, however often it is asked', () => {
    const { param, reads } = countedParam(4, { flags: [Flag.IDOR] });
    expect(getRiskScore(param)).toBe(31);
    expect(getRiskScore(param)).toBe(31);
    expect(getRiskScore(param)).toBe(31);
    expect(reads.n).toBe(1);
  });

  it('scores a new object for the same parameter afresh', () => {
    const before = makeParam({ id: 'same', count: 2 });
    const after = makeParam({ id: 'same', count: 8 });
    expect(getRiskScore(before)).toBe(3);
    expect(getRiskScore(after)).toBe(9);
    expect(getRiskScore(before)).toBe(3);
  });
});

describe('sortByRisk', () => {
  it('puts higher scores first', () => {
    const low = makeParam({ id: 'low' });
    const mid = makeParam({ id: 'mid', flags: [Flag.DEBUG] });
    const high = makeParam({ id: 'high', flags: [Flag.REFLECTED, Flag.IDOR] });
    expect(sortByRisk([low, high, mid]).map(p => p.id)).toEqual(['high', 'mid', 'low']);
  });

  it('keeps the input order for equal scores', () => {
    const params = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
      makeParam({ id, flags: i % 2 === 0 ? [Flag.AUTH] : [Flag.SENSITIVE] }));
    expect(sortByRisk(params).map(p => p.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('matches the old comparator, ties included', () => {
    const params = mixedInventory(300);
    const scores = new Set(params.map(computeRiskScore));
    expect(scores.size).toBeLessThan(params.length / 4);

    const expected = params.slice().sort((a, b) => computeRiskScore(b) - computeRiskScore(a));
    expect(sortByRisk(params).map(p => p.id)).toEqual(expected.map(p => p.id));
  });

  it('returns a new array and leaves its input as it was', () => {
    const params = mixedInventory(20);
    const ids = params.map(p => p.id);
    const sorted = sortByRisk(params);
    expect(sorted).not.toBe(params);
    expect(params.map(p => p.id)).toEqual(ids);
  });

  it('scores each parameter once across sorts', () => {
    const counted = [1, 4, 2, 16, 4].map(count => countedParam(count));
    const params = counted.map(c => c.param);
    sortByRisk(params);
    sortByRisk(params.slice().reverse());
    expect(counted.map(c => c.reads.n)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe('getRiskClass', () => {
  it('returns risk-low for score < 35', () => {
    expect(getRiskClass(0)).toBe('risk-low');
    expect(getRiskClass(34)).toBe('risk-low');
  });

  it('returns risk-mid for score 35–69', () => {
    expect(getRiskClass(35)).toBe('risk-mid');
    expect(getRiskClass(69)).toBe('risk-mid');
  });

  it('returns risk-high for score >= 70', () => {
    expect(getRiskClass(70)).toBe('risk-high');
    expect(getRiskClass(100)).toBe('risk-high');
  });

  it('boundary: 34 is low, 35 is mid', () => {
    expect(getRiskClass(34)).toBe('risk-low');
    expect(getRiskClass(35)).toBe('risk-mid');
  });

  it('boundary: 69 is mid, 70 is high', () => {
    expect(getRiskClass(69)).toBe('risk-mid');
    expect(getRiskClass(70)).toBe('risk-high');
  });
});
