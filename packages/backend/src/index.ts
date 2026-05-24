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
  ValueType,
  Flag,
  ParameterLocation,
  SENSITIVE_NAME_PATTERNS,
  REDIRECT_NAME_PATTERNS,
  FILE_NAME_PATTERNS,
  AUTH_NAME_PATTERNS,
  IDOR_NAME_PATTERNS,
  SSTI_NAME_PATTERNS,
  INJECTION_NAME_PATTERNS,
  DEBUG_NAME_PATTERNS,
  NEW_PARAMETER_THRESHOLD_MS,
} from "@param-logger/shared";

import { parseRequest } from "./parser.js";

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
// to match what "View in HTTP History" returns.
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
 * Parse a Set-Cookie header value into cookie name-value pairs
 */
function parseSetCookie(setCookieValue: string): Array<{ name: string; value: string }> {
  const cookies: Array<{ name: string; value: string }> = [];
  
  // Split on semicolon to separate the main cookie from attributes
  const parts = setCookieValue.split(';');
  if (parts.length === 0) {
    return cookies;
  }
  
  // Parse the main cookie (name=value)
  const mainCookie = parts[0].trim();
  const equalIndex = mainCookie.indexOf('=');
  
  if (equalIndex > 0) {
    const name = mainCookie.substring(0, equalIndex).trim();
    const value = mainCookie.substring(equalIndex + 1).trim();
    
    if (name) {
      cookies.push({ name, value });
    }
  }
  
  return cookies;
}

// ── UUID classification ───────────────────────────────────────────────────────
//
// Each pattern enforces the RFC 4122 variant bits ([89ab] in the 9th position)
// alongside the version nibble, giving very strong structural guarantees with
// negligible false-positive risk.

/** Per-version UUID patterns (fully anchored, case-insensitive). */
const UUID_VERSION_PATTERNS: Array<[ValueType, RegExp]> = [
  [ValueType.UUID_V1, /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V3, /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V4, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V5, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V6, /^[0-9a-f]{8}-[0-9a-f]{4}-6[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V7, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
  [ValueType.UUID_V8, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i],
];

/**
 * Fallback: catches v2 (DCE Security) and any future drafts that carry the
 * RFC 4122 variant but whose version nibble isn't in the list above.
 */
const UUID_GENERIC = /^[0-9a-f]{8}-[0-9a-f]{4}-[02][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Compound format: <standard-uuid>@<unix-timestamp in s/ms/µs>.
 * The timestamp group is restricted to 10–16 digits to tightly exclude email
 * addresses (letters after @) and other lookalikes.
 */
const UUID_COMPOUND_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})@(\d{10,16})$/i;

/**
 * Returns the UUID-related ValueType(s) for a value, or an empty array when
 * the value is not UUID-shaped.
 *
 * Compound values such as `<uuid>@<timestamp>` return two entries: the version
 * type (e.g. UUID_V7) and UUID_COMPOUND, so both characteristics are visible.
 */
function classifyUUID(value: string): ValueType[] {
  // Compound format first (uuid@digits)
  const compound = UUID_COMPOUND_RE.exec(value);
  if (compound) {
    const uuidPart = compound[1];
    const matched = UUID_VERSION_PATTERNS.find(([, re]) => re.test(uuidPart));
    const versionType = matched ? matched[0] : ValueType.UUID;
    return [versionType, ValueType.UUID_COMPOUND];
  }

  // Bare UUID — try each version
  for (const [type, re] of UUID_VERSION_PATTERNS) {
    if (re.test(value)) return [type];
  }

  // Fallback: valid UUID structure but uncategorised version (v2, future drafts)
  if (UUID_GENERIC.test(value)) return [ValueType.UUID];

  return [];
}

/**
 * Calculate Shannon entropy of a string in bits per character.
 * Higher values indicate more randomness/unpredictability.
 */
function calculateShannonEntropy(str: string): number {
  if (str.length === 0) return 0;
  
  const frequency = new Map<string, number>();
  
  // Count character frequencies
  for (const char of str) {
    frequency.set(char, (frequency.get(char) || 0) + 1);
  }
  
  // Calculate entropy
  let entropy = 0;
  const length = str.length;
  
  for (const count of frequency.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

/**
 * Classify a parameter value into one or more ValueTypes.
 * Returns an array so compound values (e.g. uuid_v7 + uuid_compound) can carry
 * multiple labels.
 */
function classifyValue(value: string): ValueType[] {
  if (!value || value.length === 0) {
    return [ValueType.EMPTY];
  }

  // Boolean
  if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
    return [ValueType.BOOLEAN];
  }

  // Integer
  if (/^\d+$/.test(value)) {
    return [ValueType.INTEGER];
  }

  // Decimal
  if (/^\d+\.\d+$/.test(value)) {
    return [ValueType.DECIMAL];
  }

  // UUID (version-aware, with compound support) — check before EMAIL because
  // the compound format uuid@digits would otherwise partially match the email
  // regex (which only requires letters/digits on both sides of @).
  const uuidTypes = classifyUUID(value);
  if (uuidTypes.length > 0) return uuidTypes;

  // JWT (three base64url parts separated by dots).
  // Require total length >= 50 and a signature segment >= 20 chars to avoid
  // matching short domain-like values such as "www.firmy.cz".
  if (value.length >= 50) {
    const jwtMatch = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.([A-Za-z0-9_-]{20,})$/.exec(value);
    if (jwtMatch) {
      return [ValueType.JWT];
    }
  }

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return [ValueType.EMAIL];
  }

  // URL
  if (/^https?:\/\//.test(value)) {
    return [ValueType.URL];
  }

  // Hash (long hex string)
  if (/^[a-f0-9]{16,}$/i.test(value)) {
    return [ValueType.HASH];
  }

  // Base64 (at least 8 chars, valid base64 chars, proper padding)
  if (value.length >= 8 && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0) {
    return [ValueType.BASE64];
  }

  // Timestamp detection
  // 10-digit (seconds), 13-digit (milliseconds), 16-digit (microseconds) integers
  if (/^\d{10}$/.test(value) || /^\d{13}$/.test(value) || /^\d{16}$/.test(value)) {
    return [ValueType.TIMESTAMP];
  }
  
  // ISO 8601 strings (basic pattern)
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return [ValueType.TIMESTAMP];
  }

  // IP address detection
  // IPv4 dotted-quad
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    // Validate each octet is 0-255
    const octets = value.split('.');
    if (octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    })) {
      return [ValueType.IP];
    }
  }
  
  // IPv6 (simplified pattern for compressed notation)
  if (/^[0-9a-f]*:+[0-9a-f:]*$/i.test(value) && value.includes(':')) {
    return [ValueType.IP];
  }

  // Serialized object detection
  // PHP serialization patterns
  if (/^[OoAaSs]:\d+:/.test(value)) {
    return [ValueType.SERIALIZED];
  }
  
  // Java serialization (hex or base64 with aced prefix)
  if (/^aced/i.test(value)) {
    return [ValueType.SERIALIZED];
  }

  return [ValueType.STRING];
}

/**
 * Compute static flags for a parameter (run once when parameter is created)
 */
function computeStaticFlags(name: string, value: string, valueTypes: ValueType[]): Flag[] {
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

  // IDOR detection: auth name pattern AND integer value type
  if (IDOR_NAME_PATTERNS.some(pattern => pattern.test(name)) && valueTypes.includes(ValueType.INTEGER)) {
    flags.push(Flag.IDOR);
  }

  // SSTI detection
  if (SSTI_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.SSTI);
  }

  // Injection detection
  if (INJECTION_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.INJECTION);
  }

  // Debug detection
  if (DEBUG_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    flags.push(Flag.DEBUG);
  }

  // Proto pollution detection: exact substring match in name
  if (name.includes('__proto__') || name.includes('constructor') || name.includes('prototype')) {
    flags.push(Flag.PROTO_POLLUTION);
  }

  // Value-based sensitive detection
  if (
    valueTypes.includes(ValueType.JWT) ||
    (valueTypes.includes(ValueType.HASH) && value.length > 20)
  ) {
    if (!flags.includes(Flag.SENSITIVE)) {
      flags.push(Flag.SENSITIVE);
    }
  }

  // AWS/PEM credential detection
  if (/^AKIA[0-9A-Z]{16}$/.test(value)) {
    if (!flags.includes(Flag.SENSITIVE)) {
      flags.push(Flag.SENSITIVE);
    }
  }

  if (/-----BEGIN .+ KEY-----|-----BEGIN CERTIFICATE-----/.test(value)) {
    if (!flags.includes(Flag.SENSITIVE)) {
      flags.push(Flag.SENSITIVE);
    }
  }

  // Entropy-based sensitive detection
  // For string values with high entropy (> 4.5 bits/char) that don't match known formats
  if (valueTypes.includes(ValueType.STRING) && value.length >= 8) {
    const entropy = calculateShannonEntropy(value);
    if (entropy > 4.5) {
      // Check if this matches any known structured format (to avoid false positives)
      const hasKnownFormat = valueTypes.some(type => 
        type !== ValueType.STRING && type !== ValueType.UNKNOWN
      );
      
      if (!hasKnownFormat && !flags.includes(Flag.SENSITIVE)) {
        flags.push(Flag.SENSITIVE);
      }
    }
  }

  return flags;
}

/**
 * Recompute only the NEW flag for an existing parameter
 */
function recomputeNewFlag(flags: Flag[], firstSeen: Date): Flag[] {
  // Remove existing NEW flag
  const filteredFlags: Flag[] = flags.filter(flag => flag !== Flag.NEW);
  
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
  // Finding without first going through HTTP History.
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