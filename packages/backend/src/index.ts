/**
 * Backend plugin entry point for Param Logger
 */

import type { Caido, Request, Response, Project } from "@caido/sdk-backend";
import type {
  Parameter,
  Domain,
  InventoryStats,
  InventoryFilters,
  ProjectInfo,
  ParsedRequest,
} from "@param-logger/shared";
import {
  Flag,
  ParameterLocation,
} from "@param-logger/shared";

import { parseRequest } from "./parser.js";
import { parseSetCookie } from "./pure/cookies.js";
import { classifyValue } from "./pure/classify.js";
import { computeStaticFlags, recomputeNewFlag } from "./pure/flags.js";

const BUILD_TAG = "param-logger backend build 2026-05-20b";

// In-memory store. Cleared whenever the active Caido project changes so that
// parameters from a previous project never leak into a new project's view.
const parameters = new Map<string, Parameter>();
const domains = new Map<string, number>();
let totalRequests = 0;

// Set of request ids we've already ingested for the current project. Both
// `onInterceptRequest` (live traffic) and `runHistoricalScan` (paging through
// stored requests) feed into `ingest`, so a request that hits the proxy while
// a scan is in flight is otherwise observed by both paths and double-counted.
// Keying off the request id ensures every request contributes exactly once,
// which is what the displayed `count` ("N requests") must mean for the number
// to match what "View in Search" returns.
const ingestedRequestIds = new Set<string>();

// Per-parameter set of request keys (id when available, synthetic when not).
// `parameter.count` is derived from `paramRequestKeys.get(id).size`, so the
// displayed count is *by construction* equal to the number of distinct
// requests that contributed to it. Even if `ingest` is somehow invoked
// multiple times for the same request (Caido SDK quirks, race between
// intercept and the historical scan, etc.), the count is correct because
// `Set.add(sameValue)` is a no-op. This is the canonical defence against
// the over-counting bug — the outer dedup at function entry is now just a
// performance optimisation.
const paramRequestKeys = new Map<string, Set<string>>();

// Counter for synthetic request keys when `request.getId()` doesn't return a
// usable id. We can't dedupe such requests safely, so we just give each one a
// unique key — that preserves their data without falsely merging different
// requests together. Reset alongside the rest of the project state.
let syntheticRequestSeq = 0;

// Diagnostic counters so we can verify the dedup is doing its job after the
// next rescan. Logged periodically from `ingest` and at scan completion.
let ingestCalls = 0;
let ingestDedupHits = 0;
let ingestMissingIds = 0;

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

  sdk.events.onInterceptResponse((s, req, resp) => {
    handleResponseAnalysis(s, req, resp);
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
  ingestedRequestIds.clear();
  paramRequestKeys.clear();
  syntheticRequestSeq = 0;
  ingestCalls = 0;
  ingestDedupHits = 0;
  ingestMissingIds = 0;
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
    ingestCalls++;

    // Compute a stable per-request key. We prefer the Caido request id
    // (coerced to string so a `Set` keyed off it isn't confused by a
    // number-vs-string mismatch between SDK paths), and fall back to a
    // synthetic key when the SDK doesn't surface one. Synthetic keys are
    // unique per call so we never merge two physically different requests
    // — we simply lose the dedup safety net for those.
    const rawId = safeCall<unknown>(() => request.getId(), undefined);
    const hasUsableId =
      rawId !== undefined && rawId !== null && rawId !== "";
    const requestKey = hasUsableId
      ? `id:${String(rawId)}`
      : `syn:${++syntheticRequestSeq}`;

    if (!hasUsableId) {
      ingestMissingIds++;
      if (ingestMissingIds <= 3) {
        console.warn(
          `[param-logger] ingest: request has no id, using synthetic key ` +
            `(missing-id count=${ingestMissingIds})`,
        );
      }
    } else if (ingestedRequestIds.has(requestKey)) {
      // Outer dedup: skip re-parsing a request we've already processed.
      // This is a performance optimisation; the canonical correctness
      // guarantee for `count` lives in `paramRequestKeys` below.
      ingestDedupHits++;
      if (ingestDedupHits <= 5 || ingestDedupHits % 100 === 0) {
        console.log(
          `[param-logger] ingest: skip duplicate request key=${requestKey} ` +
            `(total dedup hits=${ingestDedupHits})`,
        );
      }
      return;
    } else {
      ingestedRequestIds.add(requestKey);
    }

    const parsedRequest = parseRequest(request);

    totalRequests++;

    if (totalRequests <= 5 || totalRequests % 100 === 0) {
      console.log(
        `[param-logger] ingest #${totalRequests} ` +
          `${parsedRequest.method} ${parsedRequest.domain}${parsedRequest.normalizedPath} ` +
          `params=${parsedRequest.parameters.length} key=${requestKey}`,
      );
    }

    // Update domain count
    const domainCount = domains.get(parsedRequest.domain) || 0;
    domains.set(parsedRequest.domain, domainCount + 1);

    // Process each parameter. We track the set of request keys per parameter
    // and derive `count = set.size`, so an over-eager ingest path can never
    // make `count` exceed the number of distinct requests that produced it.
    for (const parsedParam of parsedRequest.parameters) {
      const id = `${parsedRequest.domain}:${parsedRequest.method}:${parsedRequest.normalizedPath}:${parsedParam.location}:${parsedParam.name}`;
      const now = parsedRequest.timestamp;

      let keys = paramRequestKeys.get(id);
      if (!keys) {
        keys = new Set<string>();
        paramRequestKeys.set(id, keys);
      }
      const sizeBefore = keys.size;
      keys.add(requestKey);
      const countIncreased = keys.size !== sizeBefore;

      let parameter = parameters.get(id);

      if (!parameter) {
        // New parameter - compute static flags once
        const valueTypes = classifyValue(parsedParam.value);
        const staticFlags = computeStaticFlags(parsedParam.name, parsedParam.value, valueTypes);
        const flags = recomputeNewFlag(staticFlags, now);

        parameter = {
          id,
          domain: parsedRequest.domain,
          method: parsedRequest.method,
          normalizedPath: parsedRequest.normalizedPath,
          location: parsedParam.location,
          name: parsedParam.name,
          valueTypes,
          flags,
          count: keys.size,
          firstSeen: now,
          lastSeen: now,
        };

        parameters.set(id, parameter);
        pendingParameterIds.add(id);
      } else {
        // Existing parameter - update it
        const newTypes = classifyValue(parsedParam.value);
        const previousCount = parameter.count;

        // Canonical: count is the number of distinct request keys carrying
        // this parameter. `Set.add` is idempotent, so this is safe to
        // recompute on every ingest.
        parameter.count = keys.size;
        parameter.lastSeen = now;

        // Accumulate any value types not seen before
        for (const t of newTypes) {
          if (!parameter.valueTypes.includes(t)) {
            parameter.valueTypes.push(t);
          }
        }

        // Only recompute NEW flag (static flags don't change)
        parameter.flags = recomputeNewFlag(parameter.flags, parameter.firstSeen);

        // Emit on count changes (notable: first follow-up sighting, or every
        // 10 thereafter) so the UI sees the updated count without flooding.
        if (countIncreased && (previousCount === 1 || parameter.count % 10 === 0)) {
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
 * Handle response analysis for reflection detection and Set-Cookie extraction
 */
function handleResponseAnalysis(_sdk: Caido, request: Request, response: Response): void {
  try {
    // Parse request parameters for reflection analysis
    const parsedRequest = parseRequest(request);
    
    // Get response body for reflection detection
    const responseBody = response.getBody()?.toText();
    if (responseBody) {
      detectReflection(parsedRequest, responseBody);
    }
    
    // Extract Set-Cookie headers
    extractSetCookies(parsedRequest, response);
    
  } catch (error) {
    console.error("Error analyzing response:", error);
  }
}

/**
 * Detect parameter reflection in response body
 */
function detectReflection(parsedRequest: ParsedRequest, responseBody: string): void {
  const updatedParams: string[] = [];
  
  for (const parsedParam of parsedRequest.parameters) {
    // Only check non-empty values that are at least 5 characters long
    if (parsedParam.value && parsedParam.value.length >= 5) {
      // Check if the parameter value appears verbatim in the response body
      if (responseBody.includes(parsedParam.value)) {
        const id = `${parsedRequest.domain}:${parsedRequest.method}:${parsedRequest.normalizedPath}:${parsedParam.location}:${parsedParam.name}`;
        const parameter = parameters.get(id);
        
        if (parameter && !parameter.flags.includes(Flag.REFLECTED)) {
          // Add REFLECTED flag
          parameter.flags.push(Flag.REFLECTED);
          updatedParams.push(id);
        }
      }
    }
  }
  
  // Batch update reflected parameters
  if (updatedParams.length > 0) {
    for (const id of updatedParams) {
      pendingParameterIds.add(id);
    }
    scheduleFlush();
  }
}

/**
 * Extract Set-Cookie headers and ingest them as cookie parameters
 */
function extractSetCookies(parsedRequest: ParsedRequest, response: Response): void {
  const headers = response.getHeaders();
  
  // Look for Set-Cookie headers (case-insensitive)
  let setCookieHeaders: string[] = [];
  for (const [headerName, headerValues] of Object.entries(headers)) {
    if (headerName.toLowerCase() === 'set-cookie') {
      setCookieHeaders = Array.isArray(headerValues) ? headerValues : [String(headerValues)];
      break;
    }
  }
  
  if (setCookieHeaders.length === 0) {
    return;
  }
  
  // Parse each Set-Cookie header
  for (const setCookieValue of setCookieHeaders) {
    const cookieParams = parseSetCookie(setCookieValue);
    
    for (const cookieParam of cookieParams) {
      // Create a synthetic request with the cookie parameter
      const syntheticRequestKey = `cookie:${++syntheticRequestSeq}`;
      const now = new Date();
      
      const id = `${parsedRequest.domain}:${parsedRequest.method}:${parsedRequest.normalizedPath}:${ParameterLocation.COOKIE}:${cookieParam.name}`;
      
      let keys = paramRequestKeys.get(id);
      if (!keys) {
        keys = new Set<string>();
        paramRequestKeys.set(id, keys);
      }
      const sizeBefore = keys.size;
      keys.add(syntheticRequestKey);
      const countIncreased = keys.size !== sizeBefore;
      
      let parameter = parameters.get(id);
      
      if (!parameter) {
        // New cookie parameter - compute static flags
        const valueTypes = classifyValue(cookieParam.value);
        const staticFlags = computeStaticFlags(cookieParam.name, cookieParam.value, valueTypes);
        const flags = recomputeNewFlag(staticFlags, now);
        
        parameter = {
          id,
          domain: parsedRequest.domain,
          method: parsedRequest.method,
          normalizedPath: parsedRequest.normalizedPath,
          location: ParameterLocation.COOKIE,
          name: cookieParam.name,
          valueTypes,
          flags,
          count: keys.size,
          firstSeen: now,
          lastSeen: now,
        };
        
        parameters.set(id, parameter);
        pendingParameterIds.add(id);
      } else {
        // Existing cookie parameter - update it
        const newTypes = classifyValue(cookieParam.value);
        const previousCount = parameter.count;
        
        parameter.count = keys.size;
        parameter.lastSeen = now;
        
        // Accumulate any value types not seen before
        for (const t of newTypes) {
          if (!parameter.valueTypes.includes(t)) {
            parameter.valueTypes.push(t);
          }
        }
        
        // Only recompute NEW flag (static flags don't change)
        parameter.flags = recomputeNewFlag(parameter.flags, parameter.firstSeen);
        
        // Emit on count changes
        if (countIncreased && (previousCount === 1 || parameter.count % 10 === 0)) {
          pendingParameterIds.add(id);
        }
      }
    }
  }
  
  // Schedule flush for cookie parameters
  if (setCookieHeaders.length > 0) {
    pendingStatsChange = true;
    scheduleFlush();
  }
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

    let paramKeyTotal = 0;
    let paramKeyMax = 0;
    for (const set of paramRequestKeys.values()) {
      paramKeyTotal += set.size;
      if (set.size > paramKeyMax) paramKeyMax = set.size;
    }

    const duration = Date.now() - startTime;
    console.log(
      `[param-logger] historical scan done: pages-processed=${processedCount} requests, ` +
        `ingest-calls=${ingestCalls} dedup-hits=${ingestDedupHits} ` +
        `missing-ids=${ingestMissingIds} unique-ids-tracked=${ingestedRequestIds.size} ` +
        `unique-params=${parameters.size} domains=${domains.size} ` +
        `param-key-entries=${paramKeyTotal} max-keys-per-param=${paramKeyMax} ` +
        `in ${duration}ms`,
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

  // Return up to 10 real Caido request IDs for a given parameter (most recent
  // first). The frontend uses these to send the request to Replay or create a
  // Finding without first going through Search.
  sdk.api.register('getRequestIdsForParam', async (_sdk: Caido, paramId: string) => {
    const keys = paramRequestKeys.get(paramId);
    if (!keys || keys.size === 0) return [];

    // The Set preserves insertion order; newer requests are at the end.
    // Filter out synthetic keys (prefix "syn:") and strip the "id:" prefix.
    const realIds: string[] = [];
    for (const key of keys) {
      if (key.startsWith('id:')) {
        realIds.push(key.slice(3));
      }
    }
    // Reverse so the most recent ID comes first, cap at 10.
    return realIds.reverse().slice(0, 10);
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