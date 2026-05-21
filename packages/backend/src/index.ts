/**
 * Backend plugin entry point for Parameter Inventory
 */

import type { Caido, Request } from "@caido/sdk-backend";
import type {
  Parameter,
  Domain,
  InventoryStats,
  InventoryFilters,
  ParameterLocation,
} from "@param-inventory/shared";
import {
  ValueType,
  Flag,
  SENSITIVE_NAME_PATTERNS,
  REDIRECT_NAME_PATTERNS,
  FILE_NAME_PATTERNS,
  AUTH_NAME_PATTERNS,
  NEW_PARAMETER_THRESHOLD_MS,
} from "@param-inventory/shared";

import { parseRequest } from "./parser.js";

const BUILD_TAG = "param-inventory backend build 2026-05-20b";

// In-memory store
const parameters = new Map<string, Parameter>();
const domains = new Map<string, number>();
let totalRequests = 0;

/**
 * Initialize the parameter inventory plugin
 */
export function init(sdk: Caido): void {
  console.log(`[param-inventory] init() — ${BUILD_TAG}`);

  registerRpc(sdk);

  sdk.events.onInterceptRequest((_s, req) => {
    ingest(sdk, req);
  });

  void runHistoricalScan(sdk);
}

/**
 * Ingest a request and update the parameter inventory
 */
function ingest(sdk: Caido, request: Request): void {
  try {
    const parsedRequest = parseRequest(request);
    const changedParameters: Parameter[] = [];

    totalRequests++;

    if (totalRequests <= 5 || totalRequests % 100 === 0) {
      console.log(
        `[param-inventory] ingest #${totalRequests} ` +
          `${parsedRequest.method} ${parsedRequest.domain}${parsedRequest.normalizedPath} ` +
          `params=${parsedRequest.parameters.length}`,
      );
    }
    
    // Update domain count
    const domainCount = domains.get(parsedRequest.domain) || 0;
    domains.set(parsedRequest.domain, domainCount + 1);
    
    // Process each parameter
    for (const parsedParam of parsedRequest.parameters) {
      const id = `${parsedRequest.domain}:${parsedRequest.method}:${parsedRequest.normalizedPath}:${parsedParam.location}:${parsedParam.name}`;
      
      let parameter = parameters.get(id);
      const now = parsedRequest.timestamp;
      
      if (!parameter) {
        // New parameter
        const valueType = classifyValue(parsedParam.value);
        const flags = computeFlags(parsedParam.name, parsedParam.value, now, valueType);
        
        parameter = {
          id,
          domain: parsedRequest.domain,
          method: parsedRequest.method,
          normalizedPath: parsedRequest.normalizedPath,
          location: parsedParam.location,
          name: parsedParam.name,
          valueTypes: [valueType],
          flags,
          count: 1,
          firstSeen: now,
          lastSeen: now,
        };
        
        parameters.set(id, parameter);
        changedParameters.push(parameter);
      } else {
        // Existing parameter - update it
        const valueType = classifyValue(parsedParam.value);
        const wasChanged = parameter.count === 1; // Track if this causes notable changes
        
        parameter.count++;
        parameter.lastSeen = now;
        
        // Add value type if not seen before
        if (!parameter.valueTypes.includes(valueType)) {
          parameter.valueTypes.push(valueType);
        }
        
        // Recompute flags (may have lost NEW flag)
        parameter.flags = computeFlags(parsedParam.name, parsedParam.value, parameter.firstSeen, valueType);
        
        if (wasChanged || parameter.count % 10 === 0) {
          changedParameters.push(parameter);
        }
      }
    }
    
    // Emit events for changed parameters
    for (const param of changedParameters) {
      sdk.api.send('inventory-updated', param);
    }
    
    // Emit stats update
    sdk.api.send('stats-updated', {
      totalRequests,
      uniqueParams: parameters.size,
      domains: domains.size,
    });
    
  } catch (error) {
    console.error("Error ingesting request:", error);
  }
}

/**
 * Classify a parameter value into a ValueType
 */
function classifyValue(value: string): ValueType {
  if (!value || value.length === 0) {
    return ValueType.EMPTY;
  }
  
  // Boolean
  if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
    return ValueType.BOOLEAN;
  }
  
  // Integer
  if (/^\d+$/.test(value)) {
    return ValueType.INTEGER;
  }
  
  // Decimal
  if (/^\d+\.\d+$/.test(value)) {
    return ValueType.DECIMAL;
  }
  
  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return ValueType.UUID;
  }
  
  // JWT (three base64 parts separated by dots)
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    return ValueType.JWT;
  }
  
  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return ValueType.EMAIL;
  }
  
  // URL
  if (/^https?:\/\//.test(value)) {
    return ValueType.URL;
  }
  
  // Hash (long hex string)
  if (/^[a-f0-9]{16,}$/i.test(value)) {
    return ValueType.HASH;
  }
  
  // Base64 (at least 8 chars, valid base64 chars, proper padding)
  if (value.length >= 8 && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0) {
    return ValueType.BASE64;
  }
  
  return ValueType.STRING;
}

/**
 * Compute flags for a parameter
 */
function computeFlags(name: string, value: string, firstSeen: Date, valueType: ValueType): Flag[] {
  const flags: Flag[] = [];
  
  // NEW flag - if first seen within threshold
  const age = Date.now() - firstSeen.getTime();
  if (age < NEW_PARAMETER_THRESHOLD_MS) {
    flags.push(Flag.NEW);
  }
  
  // Name-based flags
  if (SENSITIVE_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.SENSITIVE);
  }
  
  if (REDIRECT_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.REDIRECT);
  }
  
  if (FILE_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.FILE);
  }
  
  if (AUTH_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.AUTH);
  }
  
  // Value-based sensitive detection
  if (valueType === ValueType.JWT || (valueType === ValueType.HASH && value.length > 20)) {
    if (!flags.includes(Flag.SENSITIVE)) {
      flags.push(Flag.SENSITIVE);
    }
  }
  
  return flags;
}

/**
 * Run historical scan of existing requests
 */
async function runHistoricalScan(sdk: Caido): Promise<void> {
  console.log("[param-inventory] starting historical scan...");

  const startTime = Date.now();
  let processedCount = 0;

  try {
    sdk.api.send('scan-started', { total: 0 });
    
    // Page through requests using cursor-based pagination
    const batchSize = 100;
    let hasMore = true;
    let cursor: string | null = null;
    
    while (hasMore) {
      // Build query with cursor
      let query = sdk.requests.query().first(batchSize);
      if (cursor) {
        query = query.after(cursor);
      }
      
      // Execute query
      const connection = await query.execute();
      const requests = connection.items || [];
      
      if (requests.length === 0) {
        break;
      }
      
      // Process each request
      for (const item of requests) {
        try {
          ingest(sdk, item.request);
          processedCount++;
        } catch (error) {
          console.error("Error processing historical request:", error);
        }
      }
      
      // Check for next page
      const pageInfo = connection.pageInfo;
      if (pageInfo && pageInfo.hasNextPage && pageInfo.endCursor) {
        cursor = pageInfo.endCursor;
      } else {
        hasMore = false;
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(
      `[param-inventory] historical scan done: ${processedCount} requests, ` +
        `${parameters.size} unique params, ${domains.size} domains in ${duration}ms`,
    );
    
    // Emit scan completed
    sdk.api.send('scan-completed', { processed: processedCount, duration });
    
    // Final stats update
    sdk.api.send('stats-updated', {
      totalRequests,
      uniqueParams: parameters.size,
      domains: domains.size,
    });
    
  } catch (error) {
    console.error("Error during historical scan:", error);
  }
}

/**
 * Register RPC methods
 */
function registerRpc(sdk: Caido): void {
  // Get filtered inventory
  sdk.api.register('getInventory', async (sdk, rawFilters?: InventoryFilters | null) => {
    const filters: InventoryFilters | undefined =
      rawFilters && typeof rawFilters === 'object' ? rawFilters : undefined;

    let result = Array.from(parameters.values());

    if (filters) {
      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.domain.toLowerCase().includes(searchLower) ||
          p.normalizedPath.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply location filter
      if (filters.locations && filters.locations.length > 0) {
        result = result.filter(p => filters.locations!.includes(p.location));
      }
      
      // Apply flags filter
      if (filters.flags && filters.flags.length > 0) {
        result = result.filter(p => 
          filters.flags!.some(flag => p.flags.includes(flag))
        );
      }
      
      // Apply domains filter
      if (filters.domains && filters.domains.length > 0) {
        result = result.filter(p => filters.domains!.includes(p.domain));
      }
    }
    
    return result;
  });
  
  // Get all domains
  sdk.api.register('getDomains', async (sdk) => {
    const result: Domain[] = [];
    for (const [name, count] of domains.entries()) {
      result.push({ name, count });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  });
  
  // Get current stats
  sdk.api.register('getStats', async (sdk) => {
    return {
      totalRequests,
      uniqueParams: parameters.size,
      domains: domains.size,
    } as InventoryStats;
  });
}