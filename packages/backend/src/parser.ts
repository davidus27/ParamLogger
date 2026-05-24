import type { Request } from '@caido/sdk-backend';
import type { ParsedParameter, ParsedRequest } from '@param-logger/shared';
import {
  ParameterLocation,
  EXCLUDED_HEADERS,
  JSON_CONTENT_TYPES,
  FORM_CONTENT_TYPES,
  MULTIPART_CONTENT_TYPES,
} from '@param-logger/shared';

/**
 * Parse all parameters from a Caido request and return complete ParsedRequest object
 */
export function parseRequest(request: Request): ParsedRequest {
  const parameters: ParsedParameter[] = [];

  try {
    parameters.push(...parseQueryParameters(request));
    parameters.push(...parseHeaders(request));
    parameters.push(...parseCookies(request));
    parameters.push(...parseBody(request));
  } catch (error) {
    console.error('Error parsing request parts:', error);
  }

  const host = safeCall(() => request.getHost(), '');
  const path = safeCall(() => request.getPath(), '/');
  const method = safeCall(() => request.getMethod(), 'GET');
  const requestId = safeCall(() => request.getId(), '');

  // getCreatedAt may return a Date, an ISO string, or undefined depending
  // on runtime version. Coerce to a real Date so downstream date math works.
  const rawTimestamp = safeCall<unknown>(() => request.getCreatedAt(), undefined);
  const timestamp = toDate(rawTimestamp);

  const domain = (host || '').split(':')[0] || 'unknown';
  const normalizedPath = normalizePath(path);

  return {
    domain,
    method,
    normalizedPath,
    requestId,
    timestamp,
    parameters,
  };
}

function safeCall<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function toDate(value: unknown): Date {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Parse query string parameters
 */
function parseQueryParameters(request: Request): ParsedParameter[] {
  const parameters: ParsedParameter[] = [];
  const query = request.getQuery();

  if (!query) {
    return parameters;
  }

  try {
    const searchParams = new URLSearchParams(query);
    
    for (const [name, value] of searchParams.entries()) {
      parameters.push({
        location: ParameterLocation.QUERY,
        name,
        value,
      });
    }
  } catch (error) {
    console.error('Error parsing query parameters:', error);
  }

  return parameters;
}

/**
 * Parse HTTP headers as parameters
 */
function parseHeaders(request: Request): ParsedParameter[] {
  const parameters: ParsedParameter[] = [];
  const headers = request.getHeaders();

  try {
    for (const [name, values] of Object.entries(headers)) {
      const lowerName = name.toLowerCase();
      
      // Skip standard/boring headers
      if (EXCLUDED_HEADERS.has(lowerName)) {
        continue;
      }

      // Handle multi-value headers (SDK returns string[] for header values)
      const headerValues = Array.isArray(values) ? values : [values];
      for (const value of headerValues) {
        parameters.push({
          location: ParameterLocation.HEADER,
          name,
          value,
        });
      }
    }
  } catch (error) {
    console.error('Error parsing headers:', error);
  }

  return parameters;
}

/**
 * Look up a header value case-insensitively. Caido may normalize header
 * casing (e.g. "Content-Type"), so naive lowercase lookups can miss values.
 */
function getHeaderValue(headers: Record<string, string[]>, name: string): string[] | undefined {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return v;
  }
  return undefined;
}

/**
 * Parse cookies as parameters
 */
function parseCookies(request: Request): ParsedParameter[] {
  const parameters: ParsedParameter[] = [];
  const headers = request.getHeaders();
  const cookieHeader = getHeaderValue(headers, 'cookie');

  if (!cookieHeader || cookieHeader.length === 0) {
    return parameters;
  }

  try {
    const cookieString = cookieHeader[0];
    const cookies = parseCookieString(cookieString);

    for (const [name, value] of Object.entries(cookies)) {
      parameters.push({
        location: ParameterLocation.COOKIE,
        name,
        value,
      });
    }
  } catch (error) {
    console.error('Error parsing cookies:', error);
  }

  return parameters;
}

/**
 * Parse request body based on content type
 */
function parseBody(request: Request): ParsedParameter[] {
  const body = request.getBody();
  if (!body) {
    return [];
  }

  const contentType = getContentType(request);
  
  if (JSON_CONTENT_TYPES.has(contentType)) {
    return parseJsonBody(body);
  } else if (FORM_CONTENT_TYPES.has(contentType)) {
    return parseFormBody(body);
  } else if (MULTIPART_CONTENT_TYPES.has(contentType)) {
    return parseMultipartBody(body, request);
  }

  return [];
}

/**
 * Check if a JSON object is a GraphQL request
 */
function isGraphQL(json: any): boolean {
  return typeof json?.query === 'string' &&
    /^\s*(query|mutation|subscription)[\s({]/.test(json.query);
}

/**
 * Parse GraphQL body and extract operation name, field names, and variables
 */
function parseGraphQLBody(json: any): ParsedParameter[] {
  const parameters: ParsedParameter[] = [];

  try {
    // Extract operation name if present
    if (json.operationName && typeof json.operationName === 'string') {
      parameters.push({
        location: ParameterLocation.GRAPHQL,
        name: 'operationName',
        value: json.operationName,
      });
    }

    // Extract field names from the query using regex
    if (json.query && typeof json.query === 'string') {
      const fieldNames = extractGraphQLFieldNames(json.query);
      for (const fieldName of fieldNames) {
        parameters.push({
          location: ParameterLocation.GRAPHQL,
          name: `field.${fieldName}`,
          value: fieldName,
        });
      }
    }

    // Extract variables if present
    if (json.variables && typeof json.variables === 'object') {
      const flattenedVariables = flattenObject(json.variables, 'variables');
      for (const [name, value] of Object.entries(flattenedVariables)) {
        parameters.push({
          location: ParameterLocation.GRAPHQL,
          name,
          value: valueToString(value),
        });
      }
    }
  } catch (error) {
    console.error('Error parsing GraphQL body:', error);
  }

  return parameters;
}

/**
 * Extract field names from GraphQL query string using lightweight regex
 */
function extractGraphQLFieldNames(query: string): string[] {
  const fieldNames: string[] = [];
  
  try {
    // Remove comments, strings, and normalize whitespace
    const cleanQuery = query
      .replace(/#.*$/gm, '')  // Remove comments
      .replace(/"[^"]*"/g, '""')  // Replace string literals
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();

    // Find selection sets (content between { and })
    const selectionSetMatches = cleanQuery.match(/\{[^{}]*\}/g);
    
    if (selectionSetMatches) {
      for (const selectionSet of selectionSetMatches) {
        // Extract field names from selection set
        const content = selectionSet.slice(1, -1).trim(); // Remove { and }
        const fields = content.split(/[,\s]+/).filter(field => field.length > 0);
        
        for (const field of fields) {
          // Extract just the field name (before any arguments or aliases)
          const fieldMatch = field.match(/^(\w+)/);
          if (fieldMatch) {
            const fieldName = fieldMatch[1];
            if (!fieldNames.includes(fieldName)) {
              fieldNames.push(fieldName);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error extracting GraphQL field names:', error);
  }

  return fieldNames;
}

/**
 * Parse JSON body with recursive flattening
 */
function parseJsonBody(body: any): ParsedParameter[] {
  const parameters: ParsedParameter[] = [];

  try {
    const json = body.toJson();
    
    // Check if this is a GraphQL request
    if (isGraphQL(json)) {
      return parseGraphQLBody(json);
    }
    
    const flattenedParams = flattenObject(json);

    for (const [name, value] of Object.entries(flattenedParams)) {
      const stringValue = valueToString(value);
      parameters.push({
        location: ParameterLocation.JSON,
        name,
        value: stringValue,
      });
    }
  } catch (error) {
    console.error('Error parsing JSON body:', error);
  }

  return parameters;
}

/**
 * Parse form-urlencoded body
 */
function parseFormBody(body: any): ParsedParameter[] {
  const parameters: ParsedParameter[] = [];

  try {
    const formData = body.toText();
    const searchParams = new URLSearchParams(formData);

    for (const [name, value] of searchParams.entries()) {
      parameters.push({
        location: ParameterLocation.FORM,
        name,
        value,
      });
    }
  } catch (error) {
    console.error('Error parsing form body:', error);
  }

  return parameters;
}

/**
 * Extract boundary string from Content-Type header or multipart body
 */
function extractMultipartBoundary(bodyText: string, request?: Request): string | null {
  // First try to get boundary from Content-Type header if request is available
  if (request) {
    const headers = request.getHeaders();
    const contentTypeHeader = getHeaderValue(headers, 'content-type');
    if (contentTypeHeader && contentTypeHeader.length > 0) {
      const boundaryMatch = contentTypeHeader[0].match(/boundary=([^;\s]+)/i);
      if (boundaryMatch) {
        // Remove quotes if present
        return boundaryMatch[1].replace(/^["']|["']$/g, '');
      }
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
 * Parse multipart parts from body text using boundary
 */
function parseMultipartParts(bodyText: string, boundary: string): Array<{name: string | null, value: string | null}> {
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

/**
 * Check if multipart content is binary based on headers and content
 */
function isBinaryContent(headers: string, content: string): boolean {
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
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse multipart body and extract actual text values
 */
function parseMultipartBody(body: any, request?: Request): ParsedParameter[] {
  const parameters: ParsedParameter[] = [];

  try {
    const bodyText = body.toText();
    const boundary = extractMultipartBoundary(bodyText, request);
    
    if (!boundary) {
      // Fallback to basic parsing if no boundary found
      const fieldMatches = bodyText.match(/name="([^"]+)"/g);
      if (fieldMatches) {
        for (const match of fieldMatches) {
          const name = match.match(/name="([^"]+)"/)?.[1];
          if (name) {
            parameters.push({
              location: ParameterLocation.MULTIPART,
              name,
              value: '[multipart data]',
            });
          }
        }
      }
      return parameters;
    }

    const parts = parseMultipartParts(bodyText, boundary);
    
    for (const part of parts) {
      if (part.name && part.value !== null) {
        parameters.push({
          location: ParameterLocation.MULTIPART,
          name: part.name,
          value: part.value,
        });
      }
    }
  } catch (error) {
    console.error('Error parsing multipart body:', error);
  }

  return parameters;
}

/**
 * Flatten nested object into dot-notation keys
 */
function flattenObject(obj: any, prefix = '', result: Record<string, any> = {}): Record<string, any> {
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
function valueToString(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') return value.toString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Get content type from request headers
 */
function getContentType(request: Request): string {
  const headers = request.getHeaders();
  const contentTypeHeader = getHeaderValue(headers, 'content-type');

  if (!contentTypeHeader || contentTypeHeader.length === 0) {
    return '';
  }

  // Return base content type without charset/boundary parameters
  return contentTypeHeader[0].split(';')[0].trim().toLowerCase();
}

/**
 * Parse cookie string into key-value pairs
 */
function parseCookieString(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  if (!cookieString) return cookies;

  const pairs = cookieString.split(';');
  for (const pair of pairs) {
    const [name, ...valueParts] = pair.split('=');
    if (name && name.trim()) {
      const trimmedName = name.trim();
      const value = valueParts.join('=').trim();
      cookies[trimmedName] = value || '';
    }
  }

  return cookies;
}

/**
 * Normalize a path by replacing dynamic segments with placeholders
 */
function normalizePath(path: string): string {
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