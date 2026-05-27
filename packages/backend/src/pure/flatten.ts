/**
 * Flatten nested object into dot-notation keys
 */
export function flattenObject(obj: any, prefix = '', result: Record<string, any> = {}): Record<string, any> {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, newKey, result);
    } else if (Array.isArray(value)) {
      result[`${newKey}[]`] = value;
      // Also flatten array elements if they're objects
      value.forEach((item, index) => {
        if (item && typeof item === 'object') {
          flattenObject(item, `${newKey}[${index}]`, result);
        }
      });
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Convert any value to string representation
 */
export function valueToString(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') return value.toString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
