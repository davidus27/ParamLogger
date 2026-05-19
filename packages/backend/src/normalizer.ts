import { PATH_SEGMENT_PATTERNS } from '@param-inventory/shared';

export interface NormalizedEndpoint {
  normalizedPath: string;
  pathParameters: Array<{
    name: string;
    value: string;
    type: string;
    position: number;
  }>;
}

export class EndpointNormalizer {
  /**
   * Normalize a path by replacing dynamic segments with typed placeholders
   */
  public normalizePath(path: string): NormalizedEndpoint {
    if (!path || path === '/') {
      return {
        normalizedPath: '/',
        pathParameters: [],
      };
    }

    const segments = path.split('/').filter(segment => segment.length > 0);
    const normalizedSegments: string[] = [];
    const pathParameters: Array<{
      name: string;
      value: string;
      type: string;
      position: number;
    }> = [];

    segments.forEach((segment, index) => {
      const segmentType = this.classifySegment(segment);
      
      if (segmentType) {
        const paramName = this.generateParameterName(segmentType, index);
        normalizedSegments.push(`{${paramName}}`);
        pathParameters.push({
          name: paramName,
          value: segment,
          type: segmentType,
          position: index,
        });
      } else {
        normalizedSegments.push(segment);
      }
    });

    return {
      normalizedPath: '/' + normalizedSegments.join('/'),
      pathParameters,
    };
  }

  /**
   * Classify a path segment to determine if it's dynamic and what type
   */
  private classifySegment(segment: string): string | null {
    // Check against known patterns
    if (PATH_SEGMENT_PATTERNS.UUID.test(segment)) {
      return 'uuid';
    }

    if (PATH_SEGMENT_PATTERNS.INTEGER.test(segment)) {
      // Distinguish between different types of integers
      if (PATH_SEGMENT_PATTERNS.TIMESTAMP.test(segment)) {
        return 'timestamp';
      }
      return 'id';
    }

    if (PATH_SEGMENT_PATTERNS.HASH.test(segment)) {
      // Classify by hash length
      if (segment.length === 32) return 'md5';
      if (segment.length === 40) return 'sha1';
      if (segment.length === 64) return 'sha256';
      return 'hash';
    }

    // Check for other patterns that suggest dynamic content
    if (this.isLikelyDynamic(segment)) {
      return this.inferDynamicType(segment);
    }

    return null; // Static segment
  }

  /**
   * Determine if a segment is likely dynamic based on heuristics
   */
  private isLikelyDynamic(segment: string): boolean {
    // Very short segments are usually static
    if (segment.length < 3) {
      return false;
    }

    // Very long alphanumeric strings are likely dynamic
    if (segment.length > 12 && PATH_SEGMENT_PATTERNS.ALPHANUMERIC.test(segment)) {
      return true;
    }

    // Base64-like strings
    if (this.isBase64Like(segment)) {
      return true;
    }

    // JWT tokens (simplified detection)
    if (segment.includes('.') && segment.split('.').length >= 2) {
      const parts = segment.split('.');
      if (parts.every(part => this.isBase64Like(part, false))) {
        return true;
      }
    }

    // Mixed case alphanumeric that's not obviously a word
    if (segment.length > 8 && /^[a-zA-Z0-9]+$/.test(segment) && this.hasRandomCharacteristics(segment)) {
      return true;
    }

    return false;
  }

  /**
   * Infer the type of a dynamic segment
   */
  private inferDynamicType(segment: string): string {
    if (this.isBase64Like(segment)) {
      return 'base64';
    }

    if (segment.includes('.')) {
      return 'token'; // Could be JWT or similar
    }

    if (segment.length > 20) {
      return 'key'; // Likely some kind of key or token
    }

    if (/^[0-9a-f]+$/i.test(segment)) {
      return 'hex';
    }

    return 'string';
  }

  /**
   * Check if a string looks like base64
   */
  private isBase64Like(segment: string, requirePadding = true): boolean {
    if (segment.length < 4) return false;
    
    const base64Regex = requirePadding 
      ? /^[A-Za-z0-9+/]+={0,2}$/
      : /^[A-Za-z0-9+/\-_]+$/; // Also allow URL-safe base64
    
    return base64Regex.test(segment) && segment.length % 4 === 0;
  }

  /**
   * Check if a string has characteristics of random/generated content
   */
  private hasRandomCharacteristics(segment: string): boolean {
    // Check for good entropy (mix of cases, numbers)
    const hasLower = /[a-z]/.test(segment);
    const hasUpper = /[A-Z]/.test(segment);
    const hasDigits = /\d/.test(segment);
    
    // Good entropy indicator
    const hasGoodEntropy = (hasLower && hasUpper) || (hasLower && hasDigits) || (hasUpper && hasDigits);
    
    // Check against common English words (simplified)
    const commonWords = [
      'admin', 'user', 'page', 'home', 'index', 'main', 'test', 'demo',
      'api', 'v1', 'v2', 'login', 'logout', 'register', 'profile', 'settings',
      'search', 'results', 'list', 'view', 'edit', 'create', 'delete', 'update'
    ];
    
    const isCommonWord = commonWords.includes(segment.toLowerCase());
    
    return hasGoodEntropy && !isCommonWord;
  }

  /**
   * Generate a parameter name based on type and position
   */
  private generateParameterName(type: string, position: number): string {
    switch (type) {
      case 'id':
      case 'integer':
        return position === 0 ? 'id' : `id${position}`;
      case 'uuid':
        return position === 0 ? 'uuid' : `uuid${position}`;
      case 'timestamp':
        return position === 0 ? 'timestamp' : `timestamp${position}`;
      case 'md5':
      case 'sha1':
      case 'sha256':
      case 'hash':
        return position === 0 ? 'hash' : `hash${position}`;
      case 'base64':
        return position === 0 ? 'token' : `token${position}`;
      case 'key':
        return position === 0 ? 'key' : `key${position}`;
      case 'hex':
        return position === 0 ? 'hex' : `hex${position}`;
      case 'token':
        return position === 0 ? 'token' : `token${position}`;
      default:
        return position === 0 ? 'param' : `param${position}`;
    }
  }

  /**
   * Check if two paths would normalize to the same pattern
   */
  public arePathsSimilar(path1: string, path2: string): boolean {
    const normalized1 = this.normalizePath(path1);
    const normalized2 = this.normalizePath(path2);
    return normalized1.normalizedPath === normalized2.normalizedPath;
  }

  /**
   * Generate a unique endpoint key for grouping
   */
  public generateEndpointKey(method: string, normalizedPath: string, domain: string): string {
    return `${domain}|${method}|${normalizedPath}`;
  }
}