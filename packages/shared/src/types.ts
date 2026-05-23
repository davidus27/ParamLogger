// Domain data model
export interface Domain {
  name: string;
  count: number;
}

// Parameter data model
export interface Parameter {
  id: string;
  domain: string;
  method: string;
  normalizedPath: string;
  location: ParameterLocation;
  name: string;
  valueTypes: ValueType[];
  flags: Flag[];
  count: number;
  firstSeen: Date;
  lastSeen: Date;
}

// Parameter location enum
export enum ParameterLocation {
  QUERY = 'query',
  PATH = 'path',
  JSON = 'json',
  FORM = 'form',
  HEADER = 'header',
  COOKIE = 'cookie',
  MULTIPART = 'multipart',
}

// Value type classification
export enum ValueType {
  EMPTY = 'empty',
  BOOLEAN = 'boolean',
  INTEGER = 'integer',
  DECIMAL = 'decimal',
  STRING = 'string',
  EMAIL = 'email',
  URL = 'url',
  // Generic UUID fallback (v2/DCE or unrecognised version)
  UUID = 'uuid',
  // RFC 4122 / draft versions with strict per-version matching
  UUID_V1 = 'uuid_v1', // time-based, embeds MAC address
  UUID_V3 = 'uuid_v3', // name-based MD5
  UUID_V4 = 'uuid_v4', // cryptographically random
  UUID_V5 = 'uuid_v5', // name-based SHA-1
  UUID_V6 = 'uuid_v6', // reordered time (monotonic successor to v1)
  UUID_V7 = 'uuid_v7', // Unix epoch time-ordered (ms precision)
  UUID_V8 = 'uuid_v8', // vendor/custom layout
  // Composite format: <uuid>@<unix-timestamp-digits>
  UUID_COMPOUND = 'uuid_compound',
  JWT = 'jwt',
  BASE64 = 'base64',
  HASH = 'hash',
  UNKNOWN = 'unknown',
}

// Interesting parameter flags
export enum Flag {
  NEW = 'new',
  SENSITIVE = 'sensitive',
  REDIRECT = 'redirect',
  FILE = 'file',
  AUTH = 'auth',
}

// Inventory statistics
export interface InventoryStats {
  totalRequests: number;
  uniqueParams: number;
  domains: number;
}

// Inventory filters for backend queries
export interface InventoryFilters {
  search?: string;
  locations?: ParameterLocation[];
  flags?: Flag[];
  domains?: string[];
}

// Project info for project-aware events
export interface ProjectInfo {
  projectId: string | null;
  projectName: string | null;
}

// Events sent from backend to frontend
export type InventoryBackendEvents = {
  'inventory-batch': (parameters: Parameter[]) => void;
  'stats-updated': (stats: InventoryStats) => void;
  'scan-started': (data: { total: number }) => void;
  'scan-completed': (data: {
    processed: number;
    duration: number;
  }) => void;
  // Fired when Caido switches active project. Frontend should treat this as a
  // signal to discard cached inventory state and reload from the backend, since
  // the backend has just cleared its in-memory store and will re-emit
  // `inventory-batch` events as it rescans the new project's history.
  'project-changed': (data: ProjectInfo) => void;
  // Index signature to satisfy Caido BackendEvents constraint
  [key: string]: (...args: any[]) => void;
};

// RPC endpoints exposed by backend
export type InventoryBackendAPI = {
  getInventory: (filters?: InventoryFilters) => Promise<Parameter[]>;
  getDomains: () => Promise<Domain[]>;
  getStats: () => Promise<InventoryStats>;
  // Returns the currently selected Caido project, if any.
  getCurrentProject: () => Promise<ProjectInfo>;
  // Manually clear the inventory and re-scan history for the current project.
  resetAndRescan: () => Promise<{ ok: boolean }>;
  // Returns up to 10 real Caido request IDs (most recent first) for the given
  // parameter ID, so the frontend can send a request to Replay, create a
  // Finding, etc. Returns an empty array when only synthetic IDs are available.
  getRequestIdsForParam: (paramId: string) => Promise<string[]>;
  // Index signature to satisfy Caido BackendEndpoints constraint
  [key: string]: (...args: any[]) => any;
};

// Request parsing result
export interface ParsedParameter {
  location: ParameterLocation;
  name: string;
  value: string;
}

// Complete parsed request structure
export interface ParsedRequest {
  domain: string;
  method: string;
  normalizedPath: string;
  requestId: string;
  timestamp: Date;
  parameters: ParsedParameter[];
}