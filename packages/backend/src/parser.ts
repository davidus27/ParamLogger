import type { Request } from '@caido/sdk-backend';
import { 
  ParsedParameter, 
  ParsedRequest,
  ParameterLocation, 
  ValueType,
  EXCLUDED_HEADERS,
  JSON_CONTENT_TYPES,
  FORM_CONTENT_TYPES,
  MULTIPART_CONTENT_TYPES,
  DEFAULT_REDACTION_PATTERNS
} from '@param-inventory/shared';

export class RequestParser {
  /**
   * Parse all parameters from a Caido request and return complete ParsedRequest object
   */
  public parseRequest(request: Request): ParsedRequest {
    const parameters: ParsedParameter[] = [];

    try {
      // Parse query parameters
      parameters.push(...this.parseQueryParameters(request));

      // Parse path parameters (dynamic segments)
      parameters.push(...this.parsePathParameters(request));

      // Parse headers
      parameters.push(...this.parseHeaders(request));

      // Parse cookies
      parameters.push(...this.parseCookies(request));

      // Parse body based on content type
      parameters.push(...this.parseBody(request));
    } catch (error) {
      // Log error but don't throw to avoid breaking the entire parsing flow
      console.error('Error parsing request:', error);
    }

    // Extract metadata from the request
    const host = request.getHost();
    const path = request.getPath();
    const method = request.getMethod();
    const timestamp = request.getCreatedAt();
    const requestId = request.getId();
    
    // Extract domain from host (remove port if present)
    const domain = host.split(':')[0];
    
    // Normalize path by replacing dynamic segments with placeholders
    const normalizedPath = this.normalizePath(path);
    
    return {
      domain,
      method,
      path,
      normalizedPath,
      requestId,
      timestamp,
      parameters
    };
  }

  /**
   * Parse query string parameters
   */
  private parseQueryParameters(request: Request): ParsedParameter[] {
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
          valueType: this.classifyValueType(value),
          isRedacted: this.shouldRedactValue(name, value),
        });
      }
    } catch (error) {
      console.error('Error parsing query parameters:', error);
    }

    return parameters;
  }

  /**
   * Parse path segments as potential parameters
   */
  private parsePathParameters(request: Request): ParsedParameter[] {
    const parameters: ParsedParameter[] = [];
    const path = request.getPath();

    if (!path || path === '/') {
      return parameters;
    }

    try {
      const segments = path.split('/').filter(segment => segment.length > 0);
      
      segments.forEach((segment, index) => {
        // Only treat segments as parameters if they look dynamic
        if (this.isDynamicSegment(segment)) {
          parameters.push({
            location: ParameterLocation.PATH,
            name: `{segment${index}}`, // Will be normalized later
            value: segment,
            valueType: this.classifyValueType(segment),
            isRedacted: false, // Path segments are rarely sensitive
          });
        }
      });
    } catch (error) {
      console.error('Error parsing path parameters:', error);
    }

    return parameters;
  }

  /**
   * Parse HTTP headers as parameters
   */
  private parseHeaders(request: Request): ParsedParameter[] {
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
            valueType: this.classifyValueType(value),
            isRedacted: this.shouldRedactValue(name, value),
          });
        }
      }
    } catch (error) {
      console.error('Error parsing headers:', error);
    }

    return parameters;
  }

  /**
   * Parse cookies as parameters
   */
  private parseCookies(request: Request): ParsedParameter[] {
    const parameters: ParsedParameter[] = [];
    const headers = request.getHeaders();
    const cookieHeader = headers['cookie'] || headers['Cookie'];

    if (!cookieHeader || cookieHeader.length === 0) {
      return parameters;
    }

    try {
      const cookieString = cookieHeader[0];
      const cookies = this.parseCookieString(cookieString);

      for (const [name, value] of Object.entries(cookies)) {
        parameters.push({
          location: ParameterLocation.COOKIE,
          name,
          value,
          valueType: this.classifyValueType(value),
          isRedacted: this.shouldRedactValue(name, value),
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
  private parseBody(request: Request): ParsedParameter[] {
    const body = request.getBody();
    if (!body) {
      return [];
    }

    const contentType = this.getContentType(request);
    
    if (JSON_CONTENT_TYPES.has(contentType)) {
      return this.parseJsonBody(body);
    } else if (FORM_CONTENT_TYPES.has(contentType)) {
      return this.parseFormBody(body);
    } else if (MULTIPART_CONTENT_TYPES.has(contentType)) {
      return this.parseMultipartBody(body);
    }

    return [];
  }

  /**
   * Parse JSON body with recursive flattening
   */
  private parseJsonBody(body: any): ParsedParameter[] {
    const parameters: ParsedParameter[] = [];

    try {
      const json = body.toJson(); // Now synchronous according to the real SDK
      const flattenedParams = this.flattenObject(json);

      for (const [name, value] of Object.entries(flattenedParams)) {
        const stringValue = this.valueToString(value);
        parameters.push({
          location: ParameterLocation.JSON,
          name,
          value: stringValue,
          valueType: this.classifyValueType(stringValue, value),
          isRedacted: this.shouldRedactValue(name, stringValue),
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
  private parseFormBody(body: any): ParsedParameter[] {
    const parameters: ParsedParameter[] = [];

    try {
      const formData = body.toText(); // Now synchronous according to the real SDK
      const searchParams = new URLSearchParams(formData);

      for (const [name, value] of searchParams.entries()) {
        parameters.push({
          location: ParameterLocation.FORM,
          name,
          value,
          valueType: this.classifyValueType(value),
          isRedacted: this.shouldRedactValue(name, value),
        });
      }
    } catch (error) {
      console.error('Error parsing form body:', error);
    }

    return parameters;
  }

  /**
   * Parse multipart body (basic field name extraction)
   */
  private parseMultipartBody(body: any): ParsedParameter[] {
    const parameters: ParsedParameter[] = [];

    try {
      const bodyText = body.toText(); // Now synchronous according to the real SDK
      // Basic multipart parsing - extract field names from Content-Disposition headers
      const fieldMatches = bodyText.match(/name="([^"]+)"/g);
      
      if (fieldMatches) {
        for (const match of fieldMatches) {
          const name = match.match(/name="([^"]+)"/)?.[1];
          if (name) {
            parameters.push({
              location: ParameterLocation.MULTIPART,
              name,
              value: '[multipart data]',
              valueType: ValueType.BINARY,
              isRedacted: false,
            });
          }
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
  private flattenObject(obj: any, prefix = '', result: Record<string, any> = {}): Record<string, any> {
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.flattenObject(value, newKey, result);
      } else if (Array.isArray(value)) {
        result[`${newKey}[]`] = value;
        // Also flatten array elements if they're objects
        value.forEach((item, index) => {
          if (item && typeof item === 'object') {
            this.flattenObject(item, `${newKey}[${index}]`, result);
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
  private valueToString(value: any): string {
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
   * Basic value type classification (will be enhanced in classifier.ts)
   */
  private classifyValueType(stringValue: string, originalValue?: any): ValueType {
    if (!stringValue || stringValue === '') return ValueType.EMPTY;
    if (stringValue === 'null' || stringValue === 'undefined') return ValueType.EMPTY;
    
    // Use original value type if available
    if (originalValue !== undefined) {
      if (typeof originalValue === 'boolean') return ValueType.BOOLEAN;
      if (typeof originalValue === 'number') {
        return Number.isInteger(originalValue) ? ValueType.INTEGER : ValueType.DECIMAL;
      }
      if (Array.isArray(originalValue)) return ValueType.ARRAY;
      if (typeof originalValue === 'object' && originalValue !== null) return ValueType.OBJECT;
    }

    // Basic string-based classification
    if (/^(true|false)$/i.test(stringValue)) return ValueType.BOOLEAN;
    if (/^\d+$/.test(stringValue)) return ValueType.INTEGER;
    if (/^\d+\.\d+$/.test(stringValue)) return ValueType.DECIMAL;

    return ValueType.STRING;
  }

  /**
   * Check if a path segment looks dynamic (will be enhanced in normalizer.ts)
   */
  private isDynamicSegment(segment: string): boolean {
    // Basic heuristics for dynamic segments
    if (/^\d+$/.test(segment)) return true; // Numeric ID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) return true; // UUID
    if (/^[a-f0-9]{16,64}$/i.test(segment)) return true; // Hash-like
    if (segment.length > 10 && /^[a-zA-Z0-9]+$/.test(segment)) return true; // Long alphanumeric
    
    return false;
  }

  /**
   * Check if a parameter value should be redacted
   */
  private shouldRedactValue(name: string, value: string): boolean {
    // Check if parameter name matches redaction patterns
    return DEFAULT_REDACTION_PATTERNS.some(pattern => pattern.test(name));
  }

  /**
   * Get content type from request headers
   */
  private getContentType(request: Request): string {
    const headers = request.getHeaders();
    const contentTypeHeader = headers['content-type'] || headers['Content-Type'];
    
    if (!contentTypeHeader || contentTypeHeader.length === 0) {
      return '';
    }

    // Return base content type without charset/boundary parameters
    return contentTypeHeader[0].split(';')[0].trim().toLowerCase();
  }

  /**
   * Parse cookie string into key-value pairs
   */
  private parseCookieString(cookieString: string): Record<string, string> {
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
  private normalizePath(path: string): string {
    if (!path || path === '/') {
      return '/';
    }

    // Split path into segments
    const segments = path.split('/').filter(segment => segment.length > 0);
    
    // Replace dynamic-looking segments with placeholders
    const normalizedSegments = segments.map(segment => {
      // Numeric ID
      if (/^\d+$/.test(segment)) return '{id}';
      
      // UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
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
}