import type { Parameter } from '@param-logger/shared';
import { Flag, ValueType } from '@param-logger/shared';

// Flag weights (sum capped at 60 points)
export const FLAG_WEIGHTS: Record<string, number> = {
  [Flag.REFLECTED]: 30,
  [Flag.IDOR]: 25,
  [Flag.INJECTION]: 20,
  [Flag.SSTI]: 20,
  [Flag.PROTO_POLLUTION]: 20,
  [Flag.FILE]: 15,
  [Flag.REDIRECT]: 15,
  [Flag.SENSITIVE]: 10,
  [Flag.AUTH]: 10,
  [Flag.DEBUG]: 5,
};

// Value type risk weights (sum capped at 20 points)
export const VALUE_TYPE_WEIGHTS: Partial<Record<ValueType, number>> = {
  [ValueType.JWT]: 15,
  [ValueType.SERIALIZED]: 15,
  [ValueType.IP]: 10,
  [ValueType.URL]: 10,
  [ValueType.HASH]: 8,
  [ValueType.BASE64]: 5,
};

/**
 * Computes a security risk score (0-100) for a parameter based on flags, value types, and count spread.
 * Higher scores indicate higher potential security risk.
 */
export function computeRiskScore(param: Parameter): number {
  let score = 0;
  
  let flagScore = 0;
  for (const flag of param.flags) {
    flagScore += FLAG_WEIGHTS[flag] || 0;
  }
  score += Math.min(flagScore, 60);
  
  let valueTypeScore = 0;
  for (const valueType of param.valueTypes) {
    valueTypeScore += VALUE_TYPE_WEIGHTS[valueType as ValueType] || 0;
  }
  score += Math.min(valueTypeScore, 20);
  
  // Count spread bonus (log2(count) * 3, capped at 20 points)
  const countBonus = Math.log2(Math.max(1, param.count)) * 3;
  score += Math.min(countBonus, 20);
  
  return Math.min(Math.round(score), 100);
}

/**
 * Returns CSS class for risk visualization based on score.
 */
export function getRiskClass(score: number): string {
  if (score >= 70) return 'risk-high';
  if (score >= 35) return 'risk-mid';
  return 'risk-low';
}