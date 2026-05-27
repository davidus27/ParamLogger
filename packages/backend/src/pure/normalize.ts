/**
 * Normalize a path by replacing dynamic segments with placeholders
 */
export function normalizePath(path: string): string {
  if (!path || path === '/') {
    return '/';
  }

  // Split path into segments
  const segments = path.split('/').filter(segment => segment.length > 0);

  // Replace dynamic-looking segments with placeholders
  const normalizedSegments = segments.map(segment => {
    // Numeric ID
    if (/^\d+$/.test(segment)) return '{id}';

    // UUID (v1-v8 + RFC 4122 variant bits)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
      return '{uuid}';
    }

    // Hash-like (hex strings longer than 8 chars)
    if (/^[a-f0-9]{9,64}$/i.test(segment)) return '{hash}';

    // Long alphanumeric strings (likely IDs)
    if (segment.length > 10 && /^[a-zA-Z0-9]+$/.test(segment)) {
      return '{id}';
    }

    // Keep as-is
    return segment;
  });

  return '/' + normalizedSegments.join('/');
}
