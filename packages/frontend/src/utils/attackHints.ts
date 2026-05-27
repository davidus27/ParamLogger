import type { Parameter } from '@param-logger/shared';
import { Flag, ValueType, ParameterLocation } from '@param-logger/shared';

export interface AttackHint {
  icon: string;
  label: string;
  desc: string;
}

/**
 * Returns true when a ValueType is any UUID variant (generic or versioned).
 */
function isUUIDValueType(t: ValueType): boolean {
  return t === ValueType.UUID || (t as string).startsWith('uuid_');
}

/**
 * Generate context-aware attack surface hints based on parameter properties.
 */
export function getAttackHints(p: Parameter): AttackHint[] {
  const hints: AttackHint[] = [];
  const flags = p.flags;
  const types = p.valueTypes;
  const loc = p.location;

  // ── Flag-based hints ──

  if (flags.includes(Flag.REDIRECT)) {
    hints.push({
      icon: '↗',
      label: 'Open Redirect',
      desc: 'Controls a redirect target — try substituting an external URL.',
    });
  }

  if (flags.includes(Flag.FILE)) {
    hints.push({
      icon: '📁',
      label: 'Path Traversal / LFI',
      desc: 'References a file path — test for directory traversal sequences.',
    });
  }

  if (flags.includes(Flag.AUTH)) {
    hints.push({
      icon: '🔑',
      label: 'Auth Control',
      desc: 'Influences auth decisions — try empty, null, or elevated role values.',
    });
  }

  if (flags.includes(Flag.IDOR)) {
    hints.push({
      icon: '🎯',
      label: 'IDOR Candidate',
      desc: 'Auth-related name with numeric value — swap with another user\'s ID.',
    });
  }

  if (flags.includes(Flag.SSTI)) {
    hints.push({
      icon: '🧩',
      label: 'SSTI',
      desc: 'Name suggests template processing — probe with {{7*7}} or ${7*7}.',
    });
  }

  if (flags.includes(Flag.INJECTION)) {
    hints.push({
      icon: '💉',
      label: 'Injection',
      desc: 'Name suggests query/command input — test SQLi, NoSQLi, or OS command injection.',
    });
  }

  if (flags.includes(Flag.DEBUG)) {
    hints.push({
      icon: '🐛',
      label: 'Debug / Info Disclosure',
      desc: 'May toggle debug mode — try true, 1, verbose to surface internal state.',
    });
  }

  if (flags.includes(Flag.PROTO_POLLUTION)) {
    hints.push({
      icon: '🦠',
      label: 'Prototype Pollution',
      desc: 'Contains __proto__ or constructor — may pollute JS object prototypes.',
    });
  }

  // ── Value-type hints ──

  if (types.includes(ValueType.JWT)) {
    hints.push({
      icon: '🔐',
      label: 'JWT',
      desc: 'Carries a JWT — check for alg:none, weak secrets, and claim tampering.',
    });
  }

  if (flags.includes(Flag.SENSITIVE) && !types.includes(ValueType.JWT)) {
    hints.push({
      icon: '👁',
      label: 'Sensitive Value',
      desc: 'Looks like a credential or token — verify it isn\'t reflected or cached.',
    });
  }

  const hasUUID = types.some(isUUIDValueType);
  if (types.includes(ValueType.INTEGER) || hasUUID) {
    let desc = 'Contains a direct object ID — substitute with another user\'s value.';
    if (hasUUID) {
      if (types.includes(ValueType.UUID_V1) || types.includes(ValueType.UUID_V6)) {
        desc = 'UUID v1/v6 embeds timestamp + MAC — IDs may be predictable.';
      } else if (types.includes(ValueType.UUID_V7)) {
        desc = 'UUID v7 encodes a timestamp — nearby IDs can be brute-forced.';
      } else if (types.includes(ValueType.UUID_COMPOUND)) {
        desc = 'Compound UUID format — try tampering the timestamp suffix separately.';
      } else if (types.includes(ValueType.UUID_V3) || types.includes(ValueType.UUID_V5)) {
        desc = 'Deterministic UUID (v3/v5) — if namespace is known, IDs are predictable.';
      } else {
        desc = 'Contains a UUID identifier — try swapping with another account\'s UUID.';
      }
    }
    hints.push({
      icon: '🆔',
      label: 'IDOR',
      desc,
    });
  }

  if (types.includes(ValueType.URL)) {
    hints.push({
      icon: '🌐',
      label: 'SSRF',
      desc: 'Accepts a URL — test with internal addresses and cloud metadata endpoints.',
    });
  }

  if (types.includes(ValueType.BOOLEAN)) {
    hints.push({
      icon: '🔓',
      label: 'Boolean Bypass',
      desc: 'Boolean value may gate access — try flipping or omitting it.',
    });
  }

  if (types.includes(ValueType.EMAIL)) {
    hints.push({
      icon: '✉',
      label: 'User Enumeration',
      desc: 'Email field — compare responses for valid vs. invalid addresses.',
    });
  }

  if (types.includes(ValueType.BASE64)) {
    hints.push({
      icon: '📦',
      label: 'Encoded Payload',
      desc: 'Base64 value — decode and inspect for serialized objects or tokens.',
    });
  }

  if (types.includes(ValueType.HASH)) {
    hints.push({
      icon: '🔏',
      label: 'Hash / HMAC',
      desc: 'Contains a hash — check if you can recompute it after modifying data.',
    });
  }

  if (types.includes(ValueType.DECIMAL)) {
    hints.push({
      icon: '💰',
      label: 'Numeric Manipulation',
      desc: 'Decimal value — try negatives, zero, and large numbers for logic flaws.',
    });
  }

  // ── Location-based hints ──

  if (loc === ParameterLocation.QUERY || loc === ParameterLocation.FORM || loc === ParameterLocation.JSON) {
    hints.push({
      icon: '💉',
      label: `Injection (${loc.toUpperCase()})`,
      desc: 'User-controlled input in a common injection location — test SQLi, XSS, SSTI.',
    });
  }

  if (loc === ParameterLocation.HEADER) {
    hints.push({
      icon: '📋',
      label: 'Header Injection',
      desc: 'Request header — test CRLF injection and forwarded-header spoofing.',
    });
  }

  if (loc === ParameterLocation.COOKIE) {
    hints.push({
      icon: '🍪',
      label: 'Cookie Manipulation',
      desc: 'Cookie value — check attributes, session fixation, and decode the value.',
    });
  }

  if (loc === ParameterLocation.PATH) {
    hints.push({
      icon: '🗂',
      label: 'Path IDOR / Traversal',
      desc: 'Embedded in URL path — try ID substitution and encoded traversal.',
    });
  }

  if (loc === ParameterLocation.MULTIPART) {
    hints.push({
      icon: '📤',
      label: 'File Upload',
      desc: 'Multipart field — test extension bypass, content-type mismatch, and path traversal in filename.',
    });
  }

  return hints;
}