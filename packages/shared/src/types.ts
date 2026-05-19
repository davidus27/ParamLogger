// Domain data model
export interface Domain {
  name: string;
  endpoints: Endpoint[];
  totalParams: number;
  lastSeen: Date;
}

// Endpoint data model
export interface Endpoint {
  method: string;
  path: string;
  normalizedPath: string;
  parameters: Parameter[];
  requestCount: number;
  firstSeen: Date;
  lastSeen: Date;
}

// Parameter data model
export interface Parameter {
  id: string;
  domain: string;
  method: string;
  path: string;
  normalizedPath: string;
  location: ParameterLocation;
  name: string;
  valueTypes: ValueType[];
  dynamicConfidence: number;
  flags: Flag[];
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  redactedExamples: string[];
  exampleRequestIds: string[];
}

// Observation data model (individual parameter instance)
export interface Observation {
  id: string;
  parameterId: string;
  requestId: string;
  value: string;
  redactedValue: string;
  valueType: ValueType;
  timestamp: Date;
  contextPath?: string;
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
  UUID = 'uuid',
  JWT = 'jwt',
  BASE64 = 'base64',
  HASH = 'hash',
  TIMESTAMP = 'timestamp',
  DATE = 'date',
  ARRAY = 'array',
  OBJECT = 'object',
  BINARY = 'binary',
  UNKNOWN = 'unknown',
}

// Interesting parameter flags
export enum Flag {
  NEW = 'new',
  SENSITIVE = 'sensitive',
  REDIRECT = 'redirect',
  FILE = 'file',
  AUTH = 'auth',
  DYNAMIC = 'dynamic',
}

// Alias for backwards compatibility
export const ParameterFlag = Flag;

// Frontend data transfer objects
export interface ParameterInventoryData {
  parameters: Parameter[];
  domains: Domain[];
  stats: InventoryStats;
}

export interface InventoryStats {
  totalRequests: number;
  totalParams: number;
  uniqueParams: number;
  domains: number;
  endpoints: number;
}

// Filter options for frontend
export interface FilterOptions {
  location: ParameterLocation | 'all';
  flags: {
    interesting: boolean;
    new: boolean;
  };
  search: string;
  selectedScope?: {
    domain?: string;
    endpoint?: string;
    method?: string;
  };
}

// Inventory filters for backend queries
export interface InventoryFilters {
  domains?: string[];
  methods?: string[];
  locations?: ParameterLocation[];
  flags?: Flag[];
  search?: string;
  limit?: number;
  offset?: number;
}

// Parameter detail for drawer
export interface ParameterDetail extends Parameter {
  domainInfo: Domain;
  endpointInfo: Endpoint;
  exampleRequests: Array<{
    id: string;
    method: string;
    url: string;
    timestamp: Date;
  }>;
}

// Events sent from backend to frontend
export type InventoryBackendEvents = {
  'inventory-updated': (parameter: Parameter) => void;
  'observation-added': (observation: Observation) => void;
  'scan-progress': (progress: { 
    processed: number; 
    total: number; 
    isComplete: boolean;
  }) => void;
  'stats-updated': (stats: InventoryStats) => void;
  'scan-started': (data: { total: number }) => void;
  'scan-completed': (data: { 
    processed: number; 
    duration: number;
  }) => void;
  // Index signature to satisfy Caido BackendEvents constraint
  [key: string]: (...args: any[]) => void;
};

// Alias for backwards compatibility
export type BackendEvents = InventoryBackendEvents;

// RPC endpoints exposed by backend
export type InventoryBackendAPI = {
  getInventory: (filters?: InventoryFilters) => Promise<Parameter[]>;
  getDomains: () => Promise<Domain[]>;
  getParameterDetail: (parameterId: string) => Promise<Parameter | null>;
  getParameterObservations: (parameterId: string, limit?: number) => Promise<Observation[]>;
  getStats: () => Promise<InventoryStats>;
  exportWordlist: (filters?: InventoryFilters) => Promise<string[]>;
  clearInventory: () => Promise<void>;
  triggerHistoricalScan: () => Promise<void>;
  // Index signature to satisfy Caido BackendEndpoints constraint
  [key: string]: (...args: any[]) => any;
};

// Alias for backwards compatibility
export type BackendAPI = InventoryBackendAPI;

// Request parsing result
export interface ParsedParameter {
  location: ParameterLocation;
  name: string;
  value: string;
  valueType: ValueType;
  isRedacted: boolean;
  contextPath?: string; // Optional context path for nested parameters
}

// Complete parsed request structure
export interface ParsedRequest {
  domain: string;
  method: string;
  path: string;
  normalizedPath: string;
  requestId: string;
  timestamp: Date;
  parameters: ParsedParameter[];
}

// Classification result for parameter value analysis
export interface ClassificationResult {
  valueType: ValueType;
  dynamicConfidence: number;
}

// Plugin configuration
export interface PluginConfig {
  maxParametersInMemory: number;
  maxRedactedExamples: number;
  maxExampleRequests: number;
  autoScanHistoryOnInit: boolean;
  developmentMode: boolean;
  respectScope: boolean;
  redactionMode: 'full' | 'partial' | 'hash' | 'length';
  customRedactionPatterns: RegExp[];
  enableKeyboardShortcuts: boolean;
}

// Frontend settings that persist across sessions
export interface FrontendSettings {
  filters: Partial<FilterOptions>;
  tableColumnWidths: Record<string, number>;
  drawerWidth: number;
  treePanelWidth: number;
  autoRefresh: boolean;
  refreshInterval: number;
  defaultRedactionMode: 'full' | 'partial' | 'hash' | 'length';
}