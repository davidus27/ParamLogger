/**
 * Escape special regex characters
 */
export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract boundary string from Content-Type header string or multipart body.
 * The optional `contentTypeHeader` argument is the raw value of the
 * Content-Type header (e.g. "multipart/form-data; boundary=----abc").
 */
export function extractMultipartBoundary(bodyText: string, contentTypeHeader?: string): string | null {
  // First try to get boundary from the Content-Type header string
  if (contentTypeHeader) {
    const boundaryMatch = contentTypeHeader.match(/boundary=([^;\s]+)/i);
    if (boundaryMatch) {
      // Remove quotes if present
      return boundaryMatch[1].replace(/^["']|["']$/g, '');
    }
  }

  // Fallback: look for boundary in the body text itself (common pattern)
  const boundaryMatch = bodyText.match(/^--([^\r\n]+)/m);
  if (boundaryMatch) {
    return boundaryMatch[1];
  }

  return null;
}

/**
 * Check if multipart content is binary based on headers and content
 */
export function isBinaryContent(headers: string, content: string): boolean {
  // Check Content-Type header for binary types
  const contentTypeMatch = headers.match(/content-type\s*:\s*([^;\r\n]+)/i);
  if (contentTypeMatch) {
    const contentType = contentTypeMatch[1].trim().toLowerCase();

    // Common binary content types
    const binaryTypes = [
      'image/', 'video/', 'audio/', 'application/octet-stream',
      'application/pdf', 'application/zip', 'application/gzip',
      'application/x-', 'font/', 'model/'
    ];

    if (binaryTypes.some(type => contentType.startsWith(type))) {
      return true;
    }
  }

  // Heuristic: check if content contains lots of non-printable characters
  if (content.length > 100) {
    const nonPrintableCount = (content.match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g) || []).length;
    const nonPrintableRatio = nonPrintableCount / content.length;

    // If more than 20% non-printable characters, consider it binary
    if (nonPrintableRatio > 0.2) {
      return true;
    }
  }

  return false;
}

/**
 * Parse multipart parts from body text using boundary
 */
export function parseMultipartParts(bodyText: string, boundary: string): Array<{name: string | null, value: string | null}> {
  const parts: Array<{name: string | null, value: string | null}> = [];

  try {
    // Split by boundary (handle both --boundary and ----boundary patterns)
    const boundaryPattern = new RegExp(`--${escapeRegex(boundary)}(?:--)?`, 'g');
    const segments = bodyText.split(boundaryPattern);

    for (const segment of segments) {
      const trimmed = segment.trim();
      if (!trimmed) continue;

      // Split headers from body
      const headerBodySplit = trimmed.split(/\r?\n\r?\n/);
      if (headerBodySplit.length < 2) continue;

      const headers = headerBodySplit[0];
      const bodyContent = headerBodySplit.slice(1).join('\n\n');

      // Extract name from Content-Disposition header
      const nameMatch = headers.match(/name\s*=\s*"([^"]+)"/i);
      const name = nameMatch ? nameMatch[1] : null;

      if (!name) continue;

      // Check if this is binary content
      const isBinary = isBinaryContent(headers, bodyContent);

      if (isBinary) {
        // Skip binary content but still record the field name
        parts.push({ name, value: '[binary data]' });
      } else {
        // Extract text content
        const textValue = bodyContent.trim();
        parts.push({ name, value: textValue });
      }
    }
  } catch (error) {
    console.error('Error parsing multipart parts:', error);
  }

  return parts;
}
