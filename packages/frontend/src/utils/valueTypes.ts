import { ValueType } from '@param-logger/shared';

/**
 * Returns true when a ValueType is any UUID variant (generic or versioned).
 */
export function isUUIDValueType(t: ValueType): boolean {
  return t === ValueType.UUID || (t as string).startsWith('uuid_');
}

/**
 * Checks whether the parameter's value types satisfy the active filter set.
 * The generic UUID filter pill matches all versioned UUID types so users don't
 * have to toggle each variant individually.
 */
export function matchesValueTypeFilter(paramTypes: ValueType[], active: Set<ValueType>): boolean {
  if (active.size === 0) return true;
  for (const activeType of active) {
    if (activeType === ValueType.UUID) {
      if (paramTypes.some(isUUIDValueType)) return true;
    } else {
      if (paramTypes.includes(activeType)) return true;
    }
  }
  return false;
}