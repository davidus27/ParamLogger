import { ValueType } from '@param-logger/shared';

// ── UUID classification ───────────────────────────────────────────────────────
//
// Each pattern enforces the RFC 4122 variant bits ([89ab] in the 9th position)
// alongside the version nibble, giving very strong structural guarantees with
// negligible false-positive risk.

/** Per-version UUID patterns (fully anchored, case-insensitive). */
export const UUID_VERSION_PATTERNS: Array<[ValueType, RegExp]> = [
  [ValueType.UUID_V1, /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V3, /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V4, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V5, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V6, /^[0-9a-f]{8}-[0-9a-f]{4}-6[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V7, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V8, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
];

/**
 * Fallback: catches v2 (DCE Security) and any future drafts that carry the
 * RFC 4122 variant but whose version nibble isn't in the list above.
 */
export const UUID_GENERIC = /^[0-9a-f]{8}-[0-9a-f]{4}-[02][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Compound format: <standard-uuid>@<unix-timestamp in s/ms/µs>.
 * The timestamp group is restricted to 10–16 digits to tightly exclude email
 * addresses (letters after @) and other lookalikes.
 */
export const UUID_COMPOUND_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})@(\d{10,16})$/i;

/**
 * Returns the UUID-related ValueType(s) for a value, or an empty array when
 * the value is not UUID-shaped.
 *
 * Compound values such as `<uuid>@<timestamp>` return two entries: the version
 * type (e.g. UUID_V7) and UUID_COMPOUND, so both characteristics are visible.
 */
export function classifyUUID(value: string): ValueType[] {
  // Compound format first (uuid@digits)
  const compound = UUID_COMPOUND_RE.exec(value);
  if (compound) {
    const uuidPart = compound[1];
    const matched = UUID_VERSION_PATTERNS.find(([, re]) => re.test(uuidPart));
    const versionType = matched ? matched[0] : ValueType.UUID;
    return [versionType, ValueType.UUID_COMPOUND];
  }

  // Bare UUID — try each version
  for (const [type, re] of UUID_VERSION_PATTERNS) {
    if (re.test(value)) return [type];
  }

  // Fallback: valid UUID structure but uncategorised version (v2, future drafts)
  if (UUID_GENERIC.test(value)) return [ValueType.UUID];

  return [];
}

/**
 * Calculate Shannon entropy of a string in bits per character.
 * Higher values indicate more randomness/unpredictability.
 */
export function calculateShannonEntropy(str: string): number {
  if (str.length === 0) return 0;

  const frequency = new Map<string, number>();

  // Count character frequencies
  for (const char of str) {
    frequency.set(char, (frequency.get(char) || 0) + 1);
  }

  // Calculate entropy
  let entropy = 0;
  const length = str.length;

  for (const count of frequency.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Classify a parameter value into one or more ValueTypes.
 * Returns an array so compound values (e.g. uuid_v7 + uuid_compound) can carry
 * multiple labels.
 */
export function classifyValue(value: string): ValueType[] {
  if (!value || value.length === 0) {
    return [ValueType.EMPTY];
  }

  // Boolean
  if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
    return [ValueType.BOOLEAN];
  }

  // Integer
  if (/^\d+$/.test(value)) {
    return [ValueType.INTEGER];
  }

  // Decimal
  if (/^\d+\.\d+$/.test(value)) {
    return [ValueType.DECIMAL];
  }

  // UUID (version-aware, with compound support) — check before EMAIL because
  // the compound format uuid@digits would otherwise partially match the email
  // regex (which only requires letters/digits on both sides of @).
  const uuidTypes = classifyUUID(value);
  if (uuidTypes.length > 0) return uuidTypes;

  // JWT (three base64url parts separated by dots).
  // Require total length >= 50 and a signature segment >= 20 chars to avoid
  // matching short domain-like values such as "www.firmy.cz".
  if (value.length >= 50) {
    const jwtMatch = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.([A-Za-z0-9_-]{20,})$/.exec(value);
    if (jwtMatch) {
      return [ValueType.JWT];
    }
  }

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return [ValueType.EMAIL];
  }

  // URL
  if (/^https?:\/\//.test(value)) {
    return [ValueType.URL];
  }

  // Hash (long hex string)
  if (/^[a-f0-9]{16,}$/i.test(value)) {
    return [ValueType.HASH];
  }

  // Base64 (at least 8 chars, valid base64 chars, proper padding)
  if (value.length >= 8 && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0) {
    return [ValueType.BASE64];
  }

  // Timestamp detection
  // 10-digit (seconds), 13-digit (milliseconds), 16-digit (microseconds) integers
  if (/^\d{10}$/.test(value) || /^\d{13}$/.test(value) || /^\d{16}$/.test(value)) {
    return [ValueType.TIMESTAMP];
  }

  // ISO 8601 strings (basic pattern)
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return [ValueType.TIMESTAMP];
  }

  // IP address detection
  // IPv4 dotted-quad
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    // Validate each octet is 0-255
    const octets = value.split('.');
    if (octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    })) {
      return [ValueType.IP];
    }
  }

  // IPv6 (simplified pattern for compressed notation)
  if (/^[0-9a-f]*:+[0-9a-f:]*$/i.test(value) && value.includes(':')) {
    return [ValueType.IP];
  }

  // Serialized object detection
  // PHP serialization patterns
  if (/^[OoAaSs]:\d+:/.test(value)) {
    return [ValueType.SERIALIZED];
  }

  // Java serialization (hex or base64 with aced prefix)
  if (/^aced/i.test(value)) {
    return [ValueType.SERIALIZED];
  }

  return [ValueType.STRING];
}
