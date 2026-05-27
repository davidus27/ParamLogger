import {
  ValueType,
  Flag,
  SENSITIVE_NAME_PATTERNS,
  REDIRECT_NAME_PATTERNS,
  FILE_NAME_PATTERNS,
  AUTH_NAME_PATTERNS,
  IDOR_NAME_PATTERNS,
  SSTI_NAME_PATTERNS,
  INJECTION_NAME_PATTERNS,
  DEBUG_NAME_PATTERNS,
  NEW_PARAMETER_THRESHOLD_MS,
} from '@param-logger/shared';
import { calculateShannonEntropy } from './classify.js';

/**
 * Compute static flags for a parameter (run once when parameter is created)
 */
export function computeStaticFlags(name: string, value: string, valueTypes: ValueType[]): Flag[] {
  const flags: Flag[] = [];

  // Name-based flags
  if (SENSITIVE_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.SENSITIVE);
  }

  if (REDIRECT_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.REDIRECT);
  }

  if (FILE_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.FILE);
  }

  if (AUTH_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.AUTH);
  }

  // IDOR detection: auth name pattern AND integer value type
  if (IDOR_NAME_PATTERNS.some(pattern => pattern.test(name)) && valueTypes.includes(ValueType.INTEGER)) {
    flags.push(Flag.IDOR);
  }

  // SSTI detection
  if (SSTI_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.SSTI);
  }

  // Injection detection
  if (INJECTION_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.INJECTION);
  }

  // Debug detection
  if (DEBUG_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.DEBUG);
  }

  // Proto pollution detection: exact substring match in name
  if (name.includes('__proto__') || name.includes('constructor') || name.includes('prototype')) {
    flags.push(Flag.PROTO_POLLUTION);
  }

  // Value-based sensitive detection
  if (
    valueTypes.includes(ValueType.JWT) ||
    (valueTypes.includes(ValueType.HASH) && value.length > 20)
  ) {
    if (!flags.includes(Flag.SENSITIVE)) {
      flags.push(Flag.SENSITIVE);
    }
  }

  // AWS/PEM credential detection
  if (/^AKIA[0-9A-Z]{16}$/.test(value)) {
    if (!flags.includes(Flag.SENSITIVE)) {
      flags.push(Flag.SENSITIVE);
    }
  }

  if (/-----BEGIN .+ KEY-----|-----BEGIN CERTIFICATE-----/.test(value)) {
    if (!flags.includes(Flag.SENSITIVE)) {
      flags.push(Flag.SENSITIVE);
    }
  }

  // Entropy-based sensitive detection
  // For string values with high entropy (> 4.5 bits/char) that don't match known formats
  if (valueTypes.includes(ValueType.STRING) && value.length >= 8) {
    const entropy = calculateShannonEntropy(value);
    if (entropy > 4.5) {
      // Check if this matches any known structured format (to avoid false positives)
      const hasKnownFormat = valueTypes.some(type =>
        type !== ValueType.STRING && type !== ValueType.UNKNOWN
      );

      if (!hasKnownFormat && !flags.includes(Flag.SENSITIVE)) {
        flags.push(Flag.SENSITIVE);
      }
    }
  }

  return flags;
}

/**
 * Recompute only the NEW flag for an existing parameter
 */
export function recomputeNewFlag(flags: Flag[], firstSeen: Date): Flag[] {
  // Remove existing NEW flag
  const filteredFlags: Flag[] = flags.filter(flag => flag !== Flag.NEW);

  // Add NEW flag if first seen within threshold
  const age = Date.now() - firstSeen.getTime();
  if (age < NEW_PARAMETER_THRESHOLD_MS) {
    filteredFlags.push(Flag.NEW);
  }

  return filteredFlags;
}
