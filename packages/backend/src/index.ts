/**
 * Backend plugin entry point for Param Logger
 */

import type { Caido, Request, Project } from "@caido/sdk-backend";
import type {
  Parameter,
  Domain,
  InventoryStats,
  InventoryFilters,
  ParameterLocation,
  ProjectInfo,
} from "@param-logger/shared";
import {
  ValueType,
  Flag,
  SENSITIVE_NAME_PATTERNS,
  REDIRECT_NAME_PATTERNS,
  FILE_NAME_PATTERNS,
  AUTH_NAME_PATTERNS,
  NEW_PARAMETER_THRESHOLD_MS,
} from "@param-logger/shared";

import { parseRequest } from "./parser.js";

const BUILD_TAG = "param-logger backend build 2026-05-20b";

// In-memory store. Cleared whenever the active Caido project changes so that
// parameters from a previous project never leak into a new project's view.
const parameters = new Map<string, Parameter>();
const domains = new Map<string, number>();
let totalRequests = 0;

// Coalescing state for batched events
const pendingParameterIds = new Set<string>();
let pendingStatsChange = false;
let flushTimer: NodeJS.Timeout | null = null;
let lastStats = { totalRequests: 0, uniqueParams: 0, domains: 0 };

// Tracks the currently selected Caido project. We compare against this on
// `onProjectChange` so we only reset state when the project actually changed.
let currentProjectId: string | null = null;

// Generation counter for in-flight historical scans. When the project changes
// while a scan is running, we bump this so the in-flight scan stops applying
// results from the previous project.
let scanGeneration = 0;

/**
 * Initialize the parameter inventory plugin
 */
export function init(sdk: Caido): void {
  console.log(`[param-logger] init() — ${BUILD_TAG}`);

  registerRpc(sdk);
  setupEventCoalescing(sdk);

  sdk.events.onInterceptRequest((_s, req) => {
    ingest(sdk, req);
  });

  // Subscribe to project changes so we can clear and rescan whenever the user
  // switches Caido projects. The frontend listens for the `project-changed`
  // event we emit and refreshes its UI accordingly.
  sdk.events.onProjectChange((s, project) => {
    void handleProjectChange(s, project);
  });

  // Bootstrap: capture the initial project id, then run the first historical
  // scan. We do this through `handleProjectChange` so the same code path is
  // exercised on startup and on subsequent project switches.
  void bootstrapInitialProject(sdk);
}

/**
 * Read the currently selected project (if any) and run the initial scan.
 */
async function bootstrapInitialProject(sdk: Caido): Promise<void> {
  try {
    const project = (await sdk.projects.getCurrent?.()) ?? null;
    await handleProjectChange(sdk, project);
  } catch (error) {
    console.error("[param-logger] failed to read initial project:", error);
    // Fall back to scanning whatever Caido currently exposes.
    await runHistoricalScan(sdk, ++scanGeneration);
  }
}

/**
 * Reset all in-memory inventory state. Called on project change.
 */
function resetState(): void {
  parameters.clear();
  domains.clear();
  totalRequests = 0;
  pendingParameterIds.clear();
  pendingStatsChange = false;
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  lastStats = { totalRequests: 0, uniqueParams: 0, domains: 0 };
}

/**
 * React to a Caido project change: wipe state, notify the frontend, and rescan
 * the new project's history.
 */
async function handleProjectChange(
  sdk: Caido,
  project: Project | null,
): Promise<void> {
  const projectId = project ? safeCall(() => project.getId(), null) : null;
  const projectName = project ? safeCall(() => project.getName(), null) : null;

  // Skip if this is just a redundant notification for the same project.
  if (projectId === currentProjectId && parameters.size > 0) {
    return;
  }
  currentProjectId = projectId;

  console.log(
    `[param-logger] project changed → ${projectName ?? "(none)"} (id=${projectId ?? "null"})`,
  );

  // Bump generation so any in-flight historical scan stops writing results.
  const generation = ++scanGeneration;

  resetState();

  const info: ProjectInfo = { projectId, projectName };
  try {
    sdk.api.send("project-changed", info);
  } catch (error) {
    console.error("[param-logger] failed to send project-changed event:", error);
  }

  // Always emit a zeroed stats update so the frontend immediately reflects the
  // empty state for the new project, even if the rescan hasn't produced
  // batches yet (or there is no project at all).
  try {
    sdk.api.send("stats-updated", {
      totalRequests: 0,
      uniqueParams: 0,
      domains: 0,
    });
    lastStats = { totalRequests: 0, uniqueParams: 0, domains: 0 };
  } catch (error) {
    console.error("[param-logger] failed to send stats reset:", error);
  }

  if (project) {
    await runHistoricalScan(sdk, generation);
  }
}

function safeCall<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Set up event coalescing with flush timer
 */
function setupEventCoalescing(sdk: Caido): void {
  const flushEvents = () => {
    flushTimer = null;

    // Send batched parameter updates
    if (pendingParameterIds.size > 0) {
      const batchParameters: Parameter[] = [];
      for (const id of pendingParameterIds) {
        const param = parameters.get(id);
        if (param) {
          batchParameters.push(param);
        }
      }
      
      if (batchParameters.length > 0) {
        sdk.api.send('inventory-batch', batchParameters);
      }
      pendingParameterIds.clear();
    }

    // Send stats update if changed
    if (pendingStatsChange) {
      const currentStats = {
        totalRequests,
        uniqueParams: parameters.size,
        domains: domains.size,
      };

      // Only send if stats actually changed
      if (
        currentStats.totalRequests !== lastStats.totalRequests ||
        currentStats.uniqueParams !== lastStats.uniqueParams ||
        currentStats.domains !== lastStats.domains
      ) {
        sdk.api.send('stats-updated', currentStats);
        lastStats = { ...currentStats };
      }
      pendingStatsChange = false;
    }
  };

  // Expose flush function for external use (e.g., scan completion)
  (globalThis as any).__flushParameterEvents = flushEvents;
}

/**
 * Schedule a flush if not already scheduled
 */
function scheduleFlush(): void {
  if (flushTimer === null) {
    flushTimer = setTimeout(() => {
      const flush = (globalThis as any).__flushParameterEvents;
      if (flush) flush();
    }, 250);
  }
}

/**
 * Ingest a request and update the parameter inventory
 */
function ingest(sdk: Caido, request: Request): void {
  try {
    const parsedRequest = parseRequest(request);

    totalRequests++;

    if (totalRequests <= 5 || totalRequests % 100 === 0) {
      console.log(
        `[param-logger] ingest #${totalRequests} ` +
          `${parsedRequest.method} ${parsedRequest.domain}${parsedRequest.normalizedPath} ` +
          `params=${parsedRequest.parameters.length}`,
      );
    }
    
    // Update domain count
    const domainCount = domains.get(parsedRequest.domain) || 0;
    domains.set(parsedRequest.domain, domainCount + 1);

    // Track which parameter ids have already been counted for THIS request so a
    // single request that repeats the same parameter (e.g. duplicate query keys
    // like `?id=1&id=2` or multi-value headers) only contributes `+1` to the
    // parameter's `count`. The displayed semantics is "number of requests where
    // this parameter was seen", which must match what the HTTP History filter
    // returns when the user clicks "View in HTTP History".
    const countedThisRequest = new Set<string>();

    // Process each parameter
    for (const parsedParam of parsedRequest.parameters) {
      const id = `${parsedRequest.domain}:${parsedRequest.method}:${parsedRequest.normalizedPath}:${parsedParam.location}:${parsedParam.name}`;
      const alreadyCountedThisRequest = countedThisRequest.has(id);
      countedThisRequest.add(id);

      let parameter = parameters.get(id);
      const now = parsedRequest.timestamp;

      if (!parameter) {
        // New parameter - compute static flags once
        const valueType = classifyValue(parsedParam.value);
        const staticFlags = computeStaticFlags(parsedParam.name, parsedParam.value, valueType);
        const flags = recomputeNewFlag(staticFlags, now);
        
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
        pendingParameterIds.add(id);
      } else {
        // Existing parameter - update it
        const valueType = classifyValue(parsedParam.value);
        const wasChanged = parameter.count === 1; // Track if this causes notable changes

        if (!alreadyCountedThisRequest) {
          parameter.count++;
        }
        parameter.lastSeen = now;

        // Add value type if not seen before
        if (!parameter.valueTypes.includes(valueType)) {
          parameter.valueTypes.push(valueType);
        }
        
        // Only recompute NEW flag (static flags don't change)
        parameter.flags = recomputeNewFlag(parameter.flags, parameter.firstSeen);
        
        if (wasChanged || parameter.count % 10 === 0) {
          pendingParameterIds.add(id);
        }
      }
    }
    
    // Mark stats as needing update
    pendingStatsChange = true;
    
    // Schedule coalesced flush
    scheduleFlush();
    
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
 * Compute static flags for a parameter (run once when parameter is created)
 */
function computeStaticFlags(name: string, value: string, valueType: ValueType): Flag[] {
  const flags: Flag[] = [];
  
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
 * Recompute only the NEW flag for an existing parameter
 */
function recomputeNewFlag(flags: Flag[], firstSeen: Date): Flag[] {
  // Remove existing NEW flag
  const filteredFlags = flags.filter(flag => flag !== Flag.NEW);
  
  // Add NEW flag if first seen within threshold
  const age = Date.now() - firstSeen.getTime();
  if (age < NEW_PARAMETER_THRESHOLD_MS) {
    filteredFlags.push(Flag.NEW);
  }
  
  return filteredFlags;
}

/**
 * Run historical scan of existing requests for the active project.
 *
 * `generation` is a token captured at the time the scan started. If the
 * project changes mid-scan, `scanGeneration` is bumped and we abort so we
 * don't ingest requests from the previous project into the new project's
 * inventory.
 */
async function runHistoricalScan(sdk: Caido, generation: number): Promise<void> {
  console.log(`[param-logger] starting historical scan (gen=${generation})...`);

  const startTime = Date.now();
  let processedCount = 0;

  try {
    sdk.api.send('scan-started', { total: 0 });

    // Page through requests using cursor-based pagination - smaller batch size for better responsiveness
    const batchSize = 50;
    let hasMore = true;
    let cursor: string | null = null;

    while (hasMore) {
      if (generation !== scanGeneration) {
        console.log(`[param-logger] aborting stale scan (gen=${generation}, current=${scanGeneration})`);
        return;
      }

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

      // If the project changed while we awaited the page, abort before
      // applying any results so they aren't attributed to the new project.
      if (generation !== scanGeneration) {
        console.log(`[param-logger] aborting stale scan after fetch (gen=${generation}, current=${scanGeneration})`);
        return;
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

      // Yield event loop between batches to keep Caido responsive
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check for next page
      const pageInfo = connection.pageInfo;
      if (pageInfo && pageInfo.hasNextPage && pageInfo.endCursor) {
        cursor = pageInfo.endCursor;
      } else {
        hasMore = false;
      }
    }

    if (generation !== scanGeneration) {
      // Project changed right before we completed; results are stale.
      return;
    }

    // Force flush any pending events before completion
    const flush = (globalThis as any).__flushParameterEvents;
    if (flush) flush();

    const duration = Date.now() - startTime;
    console.log(
      `[param-logger] historical scan done: ${processedCount} requests, ` +
        `${parameters.size} unique params, ${domains.size} domains in ${duration}ms`,
    );

    // Emit scan completed
    sdk.api.send('scan-completed', { processed: processedCount, duration });

    // Final stats update (direct send since scan is complete)
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

  // Return info about the currently selected Caido project. The frontend uses
  // this to display the active project name and to verify on startup that its
  // local state matches the backend's project context.
  sdk.api.register('getCurrentProject', async (sdk): Promise<ProjectInfo> => {
    try {
      const project = (await sdk.projects.getCurrent?.()) ?? null;
      return {
        projectId: project ? safeCall(() => project.getId(), null) : null,
        projectName: project ? safeCall(() => project.getName(), null) : null,
      };
    } catch (error) {
      console.error('[param-logger] getCurrentProject failed:', error);
      return { projectId: null, projectName: null };
    }
  });

  // Manually clear and rescan. Safe to call any time; useful as a recovery
  // path from the frontend if the user wants to force a refresh.
  sdk.api.register('resetAndRescan', async (sdk) => {
    try {
      const project = (await sdk.projects.getCurrent?.()) ?? null;
      const generation = ++scanGeneration;
      resetState();
      sdk.api.send('stats-updated', {
        totalRequests: 0,
        uniqueParams: 0,
        domains: 0,
      });
      lastStats = { totalRequests: 0, uniqueParams: 0, domains: 0 };
      if (project) {
        await runHistoricalScan(sdk, generation);
      }
      return { ok: true };
    } catch (error) {
      console.error('[param-logger] resetAndRescan failed:', error);
      return { ok: false };
    }
  });
}