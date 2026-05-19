/**
 * Flag engine for identifying sensitive, redirect, file, auth, and new parameters
 */

import { ParameterFlag, ValueType, ParameterLocation } from "../../shared/dist/types.js";
import { 
  FLAG_PATTERNS,
  NEW_PARAMETER_THRESHOLD_MS,
  INTERESTING_DYNAMIC_THRESHOLD
} from "../../shared/dist/constants.js";

/**
 * Configuration for flagging behavior
 */
interface FlaggerConfig {
  enableValueBasedFlagging: boolean;
  sensitiveValueThreshold: number;
  newParameterThresholdMs: number;
  dynamicConfidenceThreshold: number;
}

/**
 * Default flagger configuration
 */
const DEFAULT_CONFIG: FlaggerConfig = {
  enableValueBasedFlagging: true,
  sensitiveValueThreshold: 0.8,
  newParameterThresholdMs: NEW_PARAMETER_THRESHOLD_MS,
  dynamicConfidenceThreshold: INTERESTING_DYNAMIC_THRESHOLD,
};

/**
 * Current configuration (can be updated at runtime)
 */
let config: FlaggerConfig = { ...DEFAULT_CONFIG };

/**
 * Cache for flag analysis results to improve performance
 */
const flagCache = new Map<string, ParameterFlag[]>();

/**
 * Statistics tracking for flag assignment
 */
interface FlagStats {
  totalParameters: number;
  flaggedParameters: Map<ParameterFlag, number>;
  nameBasedFlags: number;
  valueBasedFlags: number;
  timeBasedFlags: number;
}

const flagStats: FlagStats = {
  totalParameters: 0,
  flaggedParameters: new Map(),
  nameBasedFlags: 0,
  valueBasedFlags: 0,
  timeBasedFlags: 0,
};

/**
 * Assigns flags to a parameter based on name patterns, value analysis, and metadata
 */
export function assignFlags(
  name: string,
  value: string,
  valueType: ValueType,
  location: ParameterLocation,
  firstSeen: Date,
  _dynamicConfidence?: number,
  contextPath?: string
): ParameterFlag[] {
  const flags: ParameterFlag[] = [];
  
  // Generate cache key for this parameter context
  const cacheKey = `${name}:${location}:${valueType}:${contextPath || ''}`;
  
  // Check cache first for name-based flags (value-independent)
  let cachedFlags = flagCache.get(cacheKey);
  if (cachedFlags) {
    flags.push(...cachedFlags);
  } else {
    // Analyze name-based flags
    const nameFlags = assignNameBasedFlags(name, location, contextPath);
    flags.push(...nameFlags);
    
    // Cache the name-based flags
    flagCache.set(cacheKey, [...nameFlags]);
    flagStats.nameBasedFlags += nameFlags.length;
  }
  
  // Value-based flag analysis (not cached as values change)
  if (config.enableValueBasedFlagging) {
    const valueFlags = assignValueBasedFlags(value, valueType, location);
    flags.push(...valueFlags);
    flagStats.valueBasedFlags += valueFlags.length;
  }
  
  // Time-based flags (NEW)
  const timeFlags = assignTimeBasedFlags(firstSeen);
  flags.push(...timeFlags);
  flagStats.timeBasedFlags += timeFlags.length;
  
  // Remove duplicates
  const uniqueFlags = [...new Set(flags)];
  
  // Update statistics
  flagStats.totalParameters++;
  for (const flag of uniqueFlags) {
    const currentCount = flagStats.flaggedParameters.get(flag) || 0;
    flagStats.flaggedParameters.set(flag, currentCount + 1);
  }
  
  return uniqueFlags;
}

/**
 * Assigns flags based on parameter name patterns
 */
function assignNameBasedFlags(
  name: string,
  location: ParameterLocation,
  contextPath?: string
): ParameterFlag[] {
  const flags: ParameterFlag[] = [];
  
  // Full parameter name to check (including context path for JSON parameters)
  const fullName = contextPath ? `${contextPath}.${name}` : name;
  
  // Check each flag pattern type
  for (const [flag, patterns] of Object.entries(FLAG_PATTERNS)) {
    if (flag === ParameterFlag.NEW) continue; // NEW is time-based, not pattern-based
    
    for (const pattern of patterns) {
      if (pattern.test(fullName) || pattern.test(name)) {
        flags.push(flag as ParameterFlag);
        break; // Don't add the same flag multiple times
      }
    }
  }
  
  // Location-specific flag logic
  flags.push(...getLocationSpecificFlags(name, location, contextPath));
  
  return flags;
}

/**
 * Assigns location-specific flags based on context
 */
function getLocationSpecificFlags(
  name: string,
  location: ParameterLocation,
  contextPath?: string
): ParameterFlag[] {
  const flags: ParameterFlag[] = [];
  
  switch (location) {
    case ParameterLocation.HEADER:
      // Authorization headers are always auth-related
      if (name.toLowerCase().includes('authorization') || 
          name.toLowerCase().includes('auth')) {
        flags.push(ParameterFlag.AUTH);
      }
      // Security headers often contain sensitive info
      if (name.toLowerCase().includes('token') ||
          name.toLowerCase().includes('key') ||
          name.toLowerCase().includes('signature')) {
        flags.push(ParameterFlag.SENSITIVE);
      }
      break;
      
    case ParameterLocation.COOKIE:
      // Session cookies are auth-related
      if (name.toLowerCase().includes('session') ||
          name.toLowerCase().includes('auth') ||
          name.toLowerCase().includes('login') ||
          name.toLowerCase().includes('user')) {
        flags.push(ParameterFlag.AUTH);
      }
      // CSRF tokens are sensitive
      if (name.toLowerCase().includes('csrf') ||
          name.toLowerCase().includes('xsrf') ||
          name.toLowerCase().includes('token')) {
        flags.push(ParameterFlag.SENSITIVE);
      }
      break;
      
    case ParameterLocation.PATH:
      // Path segments that look like files
      if (name.includes('.') || 
          /\.(js|css|html|pdf|doc|zip|png|jpg|gif)$/i.test(name)) {
        flags.push(ParameterFlag.FILE);
      }
      break;
      
    case ParameterLocation.JSON:
      // Nested JSON paths can reveal sensitive information
      if (contextPath) {
        // Check for nested sensitive patterns
        if (/user.*password|auth.*token|session.*key/i.test(contextPath)) {
          flags.push(ParameterFlag.SENSITIVE);
        }
        // File upload objects
        if (/file|upload|document|attachment/i.test(contextPath)) {
          flags.push(ParameterFlag.FILE);
        }
      }
      break;
  }
  
  return flags;
}

/**
 * Assigns flags based on parameter values and their characteristics
 */
function assignValueBasedFlags(
  value: string,
  valueType: ValueType,
  location: ParameterLocation
): ParameterFlag[] {
  const flags: ParameterFlag[] = [];
  
  // High-entropy value types that often indicate sensitive data
  const sensitiveValueTypes = [
    ValueType.JWT,
    ValueType.BASE64,
    ValueType.HASH,
    ValueType.UUID
  ];
  
  if (sensitiveValueTypes.includes(valueType)) {
    // Additional checks for JWT and Base64 to confirm sensitivity
    if (valueType === ValueType.JWT) {
      flags.push(ParameterFlag.SENSITIVE);
    } else if (valueType === ValueType.BASE64 && value.length >= 20) {
      // Long base64 strings are often tokens or keys
      flags.push(ParameterFlag.SENSITIVE);
    } else if (valueType === ValueType.HASH && value.length >= 32) {
      // Hash values are often sensitive (password hashes, checksums)
      flags.push(ParameterFlag.SENSITIVE);
    }
  }
  
  // URL detection for redirect parameters
  if (valueType === ValueType.URL || isURLLike(value)) {
    flags.push(ParameterFlag.REDIRECT);
  }
  
  // File path detection
  if (isFilePath(value)) {
    flags.push(ParameterFlag.FILE);
  }
  
  // Email addresses in auth contexts
  if (valueType === ValueType.EMAIL && 
      (location === ParameterLocation.JSON || 
       location === ParameterLocation.FORM)) {
    flags.push(ParameterFlag.AUTH);
  }
  
  return flags;
}

/**
 * Assigns time-based flags (currently just NEW)
 */
function assignTimeBasedFlags(firstSeen: Date): ParameterFlag[] {
  const flags: ParameterFlag[] = [];
  
  const now = new Date();
  const timeSinceFirstSeen = now.getTime() - firstSeen.getTime();
  
  if (timeSinceFirstSeen <= config.newParameterThresholdMs) {
    flags.push(ParameterFlag.NEW);
  }
  
  return flags;
}

/**
 * Checks if a value looks like a URL (more flexible than strict URL regex)
 */
function isURLLike(value: string): boolean {
  // Check for URL-like patterns that might not be caught by strict regex
  const urlIndicators = [
    /^https?:\/\//i,
    /^\/\/[a-z0-9.-]+/i,
    /^\/[a-z0-9._\-~!$&'()*+,;=:@/?]+/i, // Relative URLs
    /[a-z0-9.-]+\.[a-z]{2,}/i, // Domain-like patterns
  ];
  
  return urlIndicators.some(pattern => pattern.test(value));
}

/**
 * Checks if a value looks like a file path
 */
function isFilePath(value: string): boolean {
  const fileIndicators = [
    /\.[a-z0-9]{2,4}$/i, // File extensions
    /^[a-z]:\\/i, // Windows paths (C:\)
    /^\/[a-z0-9._\-\/]+/i, // Unix-like paths
    /\.\.?\//i, // Relative paths with ../ or ./
    /[\/\\][a-z0-9._\-]+\.[a-z0-9]{2,4}$/i, // Ends with filename.ext
  ];
  
  return fileIndicators.some(pattern => pattern.test(value));
}

/**
 * Determines if a parameter should be flagged as "interesting" based on various criteria
 */
export function isParameterInteresting(
  flags: ParameterFlag[],
  dynamicConfidence: number,
  valueTypes: ValueType[]
): boolean {
  // Has any flags (except NEW which alone isn't very interesting)
  const nonNewFlags = flags.filter(flag => flag !== ParameterFlag.NEW);
  if (nonNewFlags.length > 0) {
    return true;
  }
  
  // High dynamic confidence indicates varying values
  if (dynamicConfidence >= config.dynamicConfidenceThreshold) {
    return true;
  }
  
  // Multiple value types indicate complex parameter behavior
  if (valueTypes.length >= 3) {
    return true;
  }
  
  // High-entropy value types are inherently interesting
  const interestingTypes = [ValueType.JWT, ValueType.UUID, ValueType.HASH, ValueType.BASE64];
  if (valueTypes.some(type => interestingTypes.includes(type))) {
    return true;
  }
  
  return false;
}

/**
 * Batch flag assignment for multiple parameters (more efficient)
 */
export function assignFlagsBatch(
  parameters: Array<{
    name: string;
    value: string;
    valueType: ValueType;
    location: ParameterLocation;
    firstSeen: Date;
    dynamicConfidence?: number;
    contextPath?: string;
  }>
): Array<ParameterFlag[]> {
  return parameters.map(param => 
    assignFlags(
      param.name,
      param.value,
      param.valueType,
      param.location,
      param.firstSeen,
      param.dynamicConfidence,
      param.contextPath
    )
  );
}

/**
 * Updates the flagger configuration
 */
export function updateConfig(newConfig: Partial<FlaggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Gets the current flagger configuration
 */
export function getConfig(): FlaggerConfig {
  return { ...config };
}

/**
 * Clears the flag cache (useful when patterns change)
 */
export function clearCache(): void {
  flagCache.clear();
}

/**
 * Gets flag assignment statistics
 */
export function getFlagStats(): FlagStats {
  return {
    ...flagStats,
    flaggedParameters: new Map(flagStats.flaggedParameters)
  };
}

/**
 * Resets flag statistics
 */
export function resetFlagStats(): void {
  flagStats.totalParameters = 0;
  flagStats.flaggedParameters.clear();
  flagStats.nameBasedFlags = 0;
  flagStats.valueBasedFlags = 0;
  flagStats.timeBasedFlags = 0;
}

/**
 * Analyzes a parameter name to predict likely flags (without seeing values)
 * Useful for pre-filtering or UI hints
 */
export function predictFlags(
  name: string,
  location: ParameterLocation,
  contextPath?: string
): ParameterFlag[] {
  // Use name-based flagging only (no values available)
  return assignNameBasedFlags(name, location, contextPath);
}

/**
 * Validates that a flag should be assigned based on additional context
 * Can be used to implement more sophisticated flagging logic
 */
export function validateFlag(
  flag: ParameterFlag,
  name: string,
  value: string,
  location: ParameterLocation,
  additionalContext?: {
    endpoint: string;
    method: string;
    headers?: Record<string, string>;
  }
): boolean {
  switch (flag) {
    case ParameterFlag.SENSITIVE:
      // Extra validation for sensitive parameters
      return validateSensitiveFlag(name, value, location, additionalContext);
      
    case ParameterFlag.REDIRECT:
      // Validate redirect parameters
      return validateRedirectFlag(name, value, location);
      
    case ParameterFlag.FILE:
      // Validate file parameters
      return validateFileFlag(name, value, location);
      
    case ParameterFlag.AUTH:
      // Validate auth parameters
      return validateAuthFlag(name, value, location, additionalContext);
      
    case ParameterFlag.NEW:
      // NEW flag is always valid if assigned
      return true;
      
    default:
      return true;
  }
}

/**
 * Validates sensitive flag assignment
 */
function validateSensitiveFlag(
  _name: string,
  value: string,
  _location: ParameterLocation,
  context?: { endpoint: string; method: string; headers?: Record<string, string> }
): boolean {
  // False positive reduction for common non-sensitive patterns
  const nonSensitivePatterns = [
    /^(true|false|0|1)$/i, // Simple booleans
    /^[0-9]{1,3}$/, // Small numbers (likely not sensitive IDs)
    /^(get|post|put|delete|patch)$/i, // HTTP methods
  ];
  
  // Don't flag obviously non-sensitive values
  if (nonSensitivePatterns.some(pattern => pattern.test(value))) {
    return false;
  }
  
  // Additional context-based validation
  if (context) {
    // Don't flag debug/test parameters in obvious test endpoints
    if (context.endpoint.includes('/test') || context.endpoint.includes('/debug')) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validates redirect flag assignment
 */
function validateRedirectFlag(
  _name: string,
  value: string,
  _location: ParameterLocation
): boolean {
  // Must look like a URL or path
  return isURLLike(value) || value.startsWith('/');
}

/**
 * Validates file flag assignment
 */
function validateFileFlag(
  _name: string,
  value: string,
  _location: ParameterLocation
): boolean {
  // Must look like a file path or have file-related context
  return isFilePath(value) || /\.(js|css|html|pdf|doc|zip|png|jpg|gif|txt|json|xml)$/i.test(value);
}

/**
 * Validates auth flag assignment
 */
function validateAuthFlag(
  _name: string,
  _value: string,
  _location: ParameterLocation,
  context?: { endpoint: string; method: string; headers?: Record<string, string> }
): boolean {
  // Auth parameters should be in relevant contexts
  const authEndpoints = ['/login', '/auth', '/signin', '/signup', '/register', '/profile', '/user'];
  
  if (context && !authEndpoints.some(ep => context.endpoint.includes(ep))) {
    // Not in an obvious auth context, be more strict
    // Need stronger evidence for auth flag outside auth endpoints
    return false; // Will be reconsidered based on value patterns
  }
  
  return true;
}