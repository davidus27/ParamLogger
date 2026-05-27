import type { Request } from '@caido/sdk-backend';
import type { ParsedParameter, ParsedRequest } from '@param-logger/shared';
import {
  ParameterLocation,
  EXCLUDED_HEADERS,
  JSON_CONTENT_TYPES,
  FORM_CONTENT_TYPES,
  MULTIPART_CONTENT_TYPES,
} from '@param-logger/shared';

import { normalizePath } from './pure/normalize.js';
import { parseCookieString } from './pure/cookies.js';
import { extractMultipartBoundary, parseMultipartParts } from './pure/multipart.js';
import { isGraphQL, parseGraphQLBody } from './pure/graphql.js';
import { flattenObject, valueToString } from './pure/flatten.js';

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
 * Parse multipart body and extract actual text values
 */
function parseMultipartBody(body: any, request?: Request): ParsedParameter[] {
  const parameters: ParsedParameter[] = [];

  try {
    const bodyText = body.toText();
    const contentTypeHeaderValues = request
      ? getHeaderValue(request.getHeaders(), 'content-type')
      : undefined;
    const contentTypeHeader = contentTypeHeaderValues && contentTypeHeaderValues.length > 0
      ? contentTypeHeaderValues[0]
      : undefined;
    const boundary = extractMultipartBoundary(bodyText, contentTypeHeader);
    
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
