/**
 * Backend plugin entry point for Parameter Inventory
 */

import type { Caido, Request, Body } from "caido:plugin";
import type { PluginConfig, InventoryFilters, BackendEvents, ParsedRequest } from "@param-inventory/shared";
import { DEFAULT_CONFIG, DEFAULT_REDACTION_PATTERNS, SENSITIVE_VALUE_PATTERNS, REDACTION_MODE, REDACTED_TEXT } from "@param-inventory/shared";

import { ParameterStore } from "./store.js";
import { RequestParser } from "./parser.js";
import { classifyParameter } from "./classifier.js";
import { assignFlags } from "./flagger.js";

const parser = new RequestParser();

// Global plugin state
let store: ParameterStore;
let config: PluginConfig;
let sdk: Caido;
let isHistoricalScanRunning = false;
let historicalScanAborted = false;

/**
 * Initialize the parameter inventory plugin
 */
export function init(pluginSDK: Caido): void {
  console.log("Parameter Inventory plugin loaded");
  
  // Initialize global state
  sdk = pluginSDK;
  store = new ParameterStore();
  config = { ...DEFAULT_CONFIG };
  
  // Register RPC methods for frontend communication
  registerRpcMethods();
  
  // Set up live request interception
  setupRequestInterception();
  
  // Start historical scan if configured
  if (config.autoScanHistoryOnInit) {
    triggerHistoricalScan();
  }
}

/**
 * Set up live request interception hooks
 */
function setupRequestInterception(): void {
  console.log("Setting up request interception...");
  
  // Intercept all incoming requests for live parsing
  sdk.events.onInterceptRequest(async (sdk, request: Request) => {
    try {
      await processRequest(request);
    } catch (error) {
      console.error("Error processing intercepted request:", error);
    }
  });
  
  console.log("Request interception hooks registered");
}

/**
 * Check if request is in Caido scope
 */
function isRequestInScope(request: Request): boolean {
  try {
    // Check if SDK provides scope checking
    if (sdk.requests && typeof sdk.requests.inScope === 'function') {
      return sdk.requests.inScope(request);
    }
    
    // Fallback: check if scope awareness is enabled in config
    if (!config.respectScope) {
      return true; // Process all requests if scope is disabled
    }
    
    // Basic heuristics if no scope API available
    const url = `${request.getHost()}${request.getPath()}`;
    
    // Skip common out-of-scope URLs
    const outOfScopePatterns = [
      /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$/i,
      /\/favicon\.ico$/i,
      /\/(assets|static|public)\//i,
      /\/api\/(health|ping|status)$/i,
    ];
    
    return !outOfScopePatterns.some(pattern => pattern.test(url));
  } catch (error) {
    console.warn('Error checking request scope, defaulting to in-scope:', error);
    return true;
  }
}


/**
 * Process a single request and update the inventory
 */
async function processRequest(request: Request): Promise<void> {
  try {
    // Check if request is in scope before processing
    if (!isRequestInScope(request)) {
      console.debug('Skipping out-of-scope request:', `${request.getHost()}${request.getPath()}`);
      return;
    }
    
    // Parse the request to extract parameters and metadata
    const parsedRequest = parser.parseRequest(request);
    
    // Process each parameter through the full pipeline
    for (const parsedParam of parsedRequest.parameters) {
      // Generate parameter ID
      const parameterId = `${parsedRequest.domain}:${parsedRequest.method}:${parsedRequest.normalizedPath}:${parsedParam.location}:${parsedParam.name}`;
      
      // Classify the parameter value
      const classification = classifyParameter(parameterId, parsedParam.value, parsedParam.location);
      
      // Create redacted value for display using appropriate redaction mode
      const redactionMode = getRedactionMode(parsedParam.name, parsedParam.location, config);
      const redactedValue = redactSensitiveValue(parsedParam.value, parsedParam.name, redactionMode);
      
      // Determine flags for the parameter
      const flags = assignFlags(
        parsedParam.name,
        parsedParam.value,
        classification.valueType,
        parsedParam.location,
        parsedRequest.timestamp,
        classification.dynamicConfidence,
        parsedParam.contextPath
      );
      
      // Add observation to store
      const observation = store.addObservation(
        parameterId,
        parsedRequest.requestId,
        parsedParam.value,
        redactedValue,
        classification.valueType,
        parsedRequest.timestamp,
        parsedParam.contextPath
      );
      
      // Update parameter metrics
      store.updateParameterMetrics(observation.parameterId, classification.valueType, classification.dynamicConfidence);
      
      // Add flags
      if (flags.length > 0) {
        store.addParameterFlags(observation.parameterId, flags);
      }
      
      // Add redacted example
      store.addRedactedExample(observation.parameterId, redactedValue);
      
      // Notify frontend about the new observation
      sdk.api.send('observation-added', observation);
    }
    
    // Upsert the request and get updated parameters
    const updatedParameters = store.upsertRequest(parsedRequest);
    
    // Notify frontend about updated parameters
    for (const parameter of updatedParameters) {
      sdk.api.send('inventory-updated', parameter);
    }
    
    // Send updated stats
    sdk.api.send('stats-updated', store.getStats());
    
  } catch (error) {
    console.error("Error processing request:", error);
  }
}

/**
 * Register all RPC methods for frontend communication
 */
function registerRpcMethods(): void {
  console.log("Registering RPC methods...");
  
  // Get filtered inventory
  sdk.api.register('getInventory', async (sdk, filters?: InventoryFilters) => {
    return store.getParameters(filters);
  });
  
  // Get all domains
  sdk.api.register('getDomains', async (sdk) => {
    return store.getDomains();
  });
  
  // Get parameter detail
  sdk.api.register('getParameterDetail', async (sdk, id: string) => {
    return store.getParameter(id);
  });
  
  // Get parameter observations
  sdk.api.register('getParameterObservations', async (sdk, id: string, limit?: number) => {
    return store.getParameterObservations(id, limit);
  });
  
  // Get current stats
  sdk.api.register('getStats', async (sdk) => {
    return store.getStats();
  });
  
  // Export wordlist
  sdk.api.register('exportWordlist', async (sdk, filters?: InventoryFilters) => {
    return store.exportWordlist(filters);
  });
  
  // Clear inventory
  sdk.api.register('clearInventory', async (sdk) => {
    store.clear();
    sdk.api.send('stats-updated', store.getStats());
    return;
  });
  
  // Trigger historical scan
  sdk.api.register('triggerHistoricalScan', async (sdk) => {
    if (!isHistoricalScanRunning) {
      triggerHistoricalScan();
    }
    return;
  });
  
  console.log("RPC methods registered");
}

/**
 * Trigger a historical scan of all requests in Caido's database
 */
async function triggerHistoricalScan(): Promise<void> {
  if (isHistoricalScanRunning) {
    console.log("Historical scan already running, skipping");
    return;
  }
  
  console.log("Starting historical scan...");
  isHistoricalScanRunning = true;
  historicalScanAborted = false;
  
  const startTime = Date.now();
  let processedCount = 0;
  let totalCount = 0;
  
  try {
    // Notify frontend that scan has started (with unknown total initially)
    sdk.api.send('scan-started', { total: 0 });
    store.updateScanProgress(0, 0, false);
    sdk.api.send('scan-progress', { processed: 0, total: 0, isComplete: false });
    
    // Process requests in batches using cursor-based pagination
    const batchSize = 100;
    let hasMoreRequests = true;
    let cursor: string | null = null;
    
    while (hasMoreRequests && !historicalScanAborted) {
      // Build query with cursor for pagination
      let query = sdk.requests.query().first(batchSize);
      if (cursor) {
        query = query.after(cursor);
      }
      
      // Execute query and get RequestsConnection
      const requestsConnection = await query.execute();
      
      // Extract items from the connection
      const requests = requestsConnection.items || [];
      
      if (requests.length === 0) {
        hasMoreRequests = false;
        break;
      }
      
      // Process each request in the batch
      for (const requestItem of requests) {
        if (historicalScanAborted) {
          break;
        }
        
        try {
          // Extract the actual request from the connection item
          const request = requestItem.request;
          await processRequest(request);
          processedCount++;
          
          // Update progress every 10 requests
          if (processedCount % 10 === 0) {
            store.updateScanProgress(processedCount, 0, false);
            sdk.api.send('scan-progress', { 
              processed: processedCount, 
              total: 0, // We don't know the total until we finish
              isComplete: false 
            });
          }
        } catch (error) {
          console.error("Error processing historical request:", error);
          // Continue with next request even if one fails
        }
      }
      
      // Check if there are more pages using pageInfo
      const pageInfo = requestsConnection.pageInfo;
      if (pageInfo && pageInfo.hasNextPage && pageInfo.endCursor) {
        cursor = pageInfo.endCursor;
      } else {
        hasMoreRequests = false;
      }
      
      // If we didn't get a full batch and no explicit hasNextPage info,
      // assume we've reached the end
      if (requests.length < batchSize && (!pageInfo || !pageInfo.hasNextPage)) {
        hasMoreRequests = false;
      }
    }
    
    const duration = Date.now() - startTime;
    
    if (historicalScanAborted) {
      console.log(`Historical scan aborted after processing ${processedCount} requests in ${duration}ms`);
    } else {
      console.log(`Historical scan completed: processed ${processedCount} requests in ${duration}ms`);
      
      // Mark scan as complete with final counts
      store.updateScanProgress(processedCount, processedCount, true);
      sdk.api.send('scan-progress', { processed: processedCount, total: processedCount, isComplete: true });
      sdk.api.send('scan-completed', { processed: processedCount, duration });
    }
    
  } catch (error) {
    console.error("Error during historical scan:", error);
  } finally {
    isHistoricalScanRunning = false;
    
    // Send final stats update
    sdk.api.send('stats-updated', store.getStats());
  }
}

/**
 * Abort the currently running historical scan
 */
export function abortHistoricalScan(): void {
  if (isHistoricalScanRunning) {
    console.log("Aborting historical scan...");
    historicalScanAborted = true;
  }
}

/**
 * Advanced redaction logic for sensitive values
 */
export function redactSensitiveValue(
  value: string, 
  paramName: string, 
  mode: string = REDACTION_MODE.FULL
): string {
  if (!value || value.length === 0) {
    return value;
  }
  
  // Check if parameter name suggests sensitive data
  const nameIndicatesSensitive = DEFAULT_REDACTION_PATTERNS.some(pattern => pattern.test(paramName));
  
  // Check if value itself looks sensitive regardless of parameter name
  const valueIndicatesSensitive = SENSITIVE_VALUE_PATTERNS.some(pattern => pattern.test(value));
  
  const isSensitive = nameIndicatesSensitive || valueIndicatesSensitive;
  
  if (isSensitive) {
    switch (mode) {
      case REDACTION_MODE.FULL:
        return REDACTED_TEXT;
        
      case REDACTION_MODE.PARTIAL:
        if (value.length <= 4) {
          return REDACTED_TEXT;
        } else if (value.length <= 8) {
          return value.charAt(0) + '***' + value.charAt(value.length - 1);
        } else {
          const start = value.substring(0, 2);
          const end = value.substring(value.length - 2);
          return `${start}${'*'.repeat(Math.min(8, value.length - 4))}${end}`;
        }
        
      case REDACTION_MODE.HASH:
        // Simple hash of the value for identification
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
          const char = value.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return `[HASH:${Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()}]`;
        
      case REDACTION_MODE.LENGTH:
        return `[${value.length} chars]`;
        
      default:
        return REDACTED_TEXT;
    }
  }
  
  // For non-sensitive parameters, just truncate if too long
  if (value.length > 100) {
    return value.substring(0, 97) + "...";
  }
  
  return value;
}

/**
 * Get redaction mode based on context and configuration
 */
export function getRedactionMode(paramName: string, location: string, config: any): string {
  // More sensitive parameters get full redaction
  const highSensitivityPatterns = [
    /password/i, /secret/i, /token/i, /key/i, /authorization/i
  ];
  
  if (highSensitivityPatterns.some(pattern => pattern.test(paramName))) {
    return REDACTION_MODE.FULL;
  }
  
  // Configuration-based redaction mode
  if (config.redactionMode) {
    return config.redactionMode;
  }
  
  // Default to partial for development, full for production
  return config.developmentMode ? REDACTION_MODE.PARTIAL : REDACTION_MODE.FULL;
}