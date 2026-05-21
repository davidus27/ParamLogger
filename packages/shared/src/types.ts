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
  UUID = 'uuid',
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

// Events sent from backend to frontend
export type InventoryBackendEvents = {
  'inventory-batch': (parameters: Parameter[]) => void;
  'stats-updated': (stats: InventoryStats) => void;
  'scan-started': (data: { total: number }) => void;
  'scan-completed': (data: { 
    processed: number; 
    duration: number;
  }) => void;
  // Index signature to satisfy Caido BackendEvents constraint
  [key: string]: (...args: any[]) => void;
};

// RPC endpoints exposed by backend
export type InventoryBackendAPI = {
  getInventory: (filters?: InventoryFilters) => Promise<Parameter[]>;
  getDomains: () => Promise<Domain[]>;
  getStats: () => Promise<InventoryStats>;
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