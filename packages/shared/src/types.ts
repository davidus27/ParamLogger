// Domain data model
export interface Domain {
  id: string;
  hostname: string;
  scheme: string;
  port: number;
  firstSeen: Date;
  lastSeen: Date;
  requestCount: number;
}

// Endpoint data model
export interface Endpoint {
  id: string;
  domainId: string;
  method: string;
  normalizedPath: string;
  rawPathExamples: string[];
  firstSeen: Date;
  lastSeen: Date;
  requestCount: number;
}

// Parameter data model
export interface Parameter {
  id: string;
  domainId: string;
  endpointId: string;
  method: string;
  location: ParameterLocation;
  name: string;
  normalizedName: string;
  valueTypes: ValueType[];
  interestingFlags: Flag[];
  dynamicConfidence: number;
  firstSeen: Date;
  lastSeen: Date;
  requestCount: number;
  uniqueValueCount: number;
  exampleRequestIds: string[];
  redactedExamples: string[];
}

// Observation data model (individual parameter instance)
export interface Observation {
  id: string;
  parameterId: string;
  requestId: string;
  rawName: string;
  rawValueRedacted: string;
  valueType: ValueType;
  observedAt: Date;
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

// Frontend data transfer objects
export interface ParameterInventoryData {
  domains: Domain[];
  endpoints: Endpoint[];
  parameters: Parameter[];
  stats: InventoryStats;
}

export interface InventoryStats {
  totalRequests: number;
  totalParameters: number;
  totalDomains: number;
  totalEndpoints: number;
  newParameters: number;
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

// Parameter detail for drawer
export interface ParameterDetail extends Parameter {
  domain: Domain;
  endpoint: Endpoint;
  exampleRequests: Array<{
    id: string;
    method: string;
    url: string;
    timestamp: Date;
  }>;
}

// Events sent from backend to frontend
export interface BackendEvents {
  'inventory-updated': (data: { 
    newParameters: Parameter[]; 
    updatedParameters: Parameter[];
    stats: InventoryStats;
  }) => void;
  'scan-progress': (data: { 
    processed: number; 
    total: number; 
    currentDomain?: string;
  }) => void;
  'scan-complete': (data: { 
    totalProcessed: number; 
    duration: number;
  }) => void;
}

// RPC endpoints exposed by backend
export interface BackendAPI {
  getInventory: (filters?: Partial<FilterOptions>) => Promise<ParameterInventoryData>;
  getParameterDetail: (parameterId: string) => Promise<ParameterDetail | null>;
  getStats: () => Promise<InventoryStats>;
  exportWordlist: (filters?: Partial<FilterOptions>) => Promise<string[]>;
  clearNewFlags: () => Promise<void>;
}

// Request parsing result
export interface ParsedParameter {
  location: ParameterLocation;
  name: string;
  value: string;
  valueType: ValueType;
  isRedacted: boolean;
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