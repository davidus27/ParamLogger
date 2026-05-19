import { Flag, ParameterLocation } from './types.js';

// Flag detection patterns
export const FLAG_PATTERNS = {
  [Flag.SENSITIVE]: [
    // Case-insensitive patterns for sensitive parameters
    /password/i,
    /passwd/i,
    /pwd/i,
    /secret/i,
    /token/i,
    /key/i,
    /api[_-]?key/i,
    /apikey/i,
    /auth/i,
    /session/i,
    /sess/i,
    /credential/i,
    /private/i,
    /admin/i,
    /debug/i,
    /internal/i,
    /test/i,
    /_test/i,
  ],

  [Flag.REDIRECT]: [
    /redirect/i,
    /return/i,
    /callback/i,
    /next/i,
    /continue/i,
    /goto/i,
    /url/i,
    /uri/i,
    /link/i,
    /target/i,
    /destination/i,
  ],

  [Flag.FILE]: [
    /file/i,
    /path/i,
    /dir/i,
    /directory/i,
    /folder/i,
    /template/i,
    /include/i,
    /require/i,
    /load/i,
    /upload/i,
    /download/i,
  ],

  [Flag.AUTH]: [
    /user/i,
    /username/i,
    /userid/i,
    /user[_-]?id/i,
    /account/i,
    /account[_-]?id/i,
    /tenant/i,
    /tenant[_-]?id/i,
    /org/i,
    /org[_-]?id/i,
    /organization/i,
    /role/i,
    /permission/i,
    /access/i,
    /scope/i,
    /group/i,
    /team/i,
  ],
} as const;

// Value type detection patterns
export const VALUE_TYPE_PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  JWT: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/[^\s]+$/,
  BASE64: /^[A-Za-z0-9+/]{4,}={0,2}$/,
  HASH_MD5: /^[a-f0-9]{32}$/i,
  HASH_SHA1: /^[a-f0-9]{40}$/i,
  HASH_SHA256: /^[a-f0-9]{64}$/i,
  INTEGER: /^-?\d+$/,
  DECIMAL: /^-?\d+\.\d+$/,
  BOOLEAN: /^(true|false|0|1)$/i,
  TIMESTAMP_UNIX: /^\d{10}$/,
  TIMESTAMP_UNIX_MS: /^\d{13}$/,
  ISO_DATE: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
} as const;

// Path segment patterns for normalization
export const PATH_SEGMENT_PATTERNS = {
  INTEGER: /^\d+$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  HASH: /^[a-f0-9]{16,64}$/i,
  TIMESTAMP: /^\d{10,13}$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]{8,}$/,
} as const;

// Headers to exclude from parameter extraction
export const EXCLUDED_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'host',
  'pragma',
  'user-agent',
  'upgrade-insecure-requests',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
]);

// Parameter names that should be redacted by default
export const DEFAULT_REDACTION_PATTERNS = [
  /password/i,
  /passwd/i,
  /pwd/i,
  /secret/i,
  /token/i,
  /key/i,
  /api[_-]?key/i,
  /apikey/i,
  /authorization/i,
  /auth/i,
  /bearer/i,
  /cookie/i,
  /session/i,
  /sess/i,
  /csrf/i,
  /xsrf/i,
  /nonce/i,
  /private/i,
  /credential/i,
  /login/i,
  /signin/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /id[_-]?token/i,
  /jwt/i,
  /signature/i,
  /hash/i,
  /salt/i,
  /pepper/i,
  /mac/i,
  /hmac/i,
  /otp/i,
  /pin/i,
  /ssn/i,
  /social[_-]?security/i,
  /credit[_-]?card/i,
  /card[_-]?number/i,
  /cvv/i,
  /cvc/i,
  /expiry/i,
  /exp[_-]?date/i,
] as const;

// Value patterns that indicate sensitive content regardless of parameter name
export const SENSITIVE_VALUE_PATTERNS = [
  // JWT tokens
  /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
  // Bearer tokens
  /^bearer\s+[a-zA-Z0-9\-_+/=]+$/i,
  // API keys (various formats)
  /^[a-z0-9]{32,}$/i,
  /^[A-Z0-9]{16,}$/,
  /^sk_[a-zA-Z0-9]+$/,
  /^pk_[a-zA-Z0-9]+$/,
  // Credit card numbers (basic pattern)
  /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
  // Social Security Numbers
  /^\d{3}-\d{2}-\d{4}$/,
  // Potential passwords (heuristics)
  /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/,
] as const;

// Redaction modes
export const REDACTION_MODE = {
  FULL: 'full',           // Replace entire value with [REDACTED]
  PARTIAL: 'partial',     // Show first/last characters with middle redacted
  HASH: 'hash',          // Show hash of the value
  LENGTH: 'length',      // Show only value length info
} as const;

export const REDACTED_TEXT = '[REDACTED]';

// Default plugin configuration
export const DEFAULT_CONFIG = {
  maxParametersInMemory: 10000,
  maxRedactedExamples: 5,
  maxExampleRequests: 10,
  autoScanHistoryOnInit: true,
  developmentMode: false,
  respectScope: true,
  redactionMode: 'full',
  customRedactionPatterns: [],
  enableKeyboardShortcuts: true,
} as const;

// Default frontend settings
export const DEFAULT_FRONTEND_SETTINGS = {
  filters: {
    location: 'all',
    flags: {
      interesting: false,
      new: false,
    },
    search: '',
  },
  tableColumnWidths: {},
  drawerWidth: 380,
  treePanelWidth: 280,
  autoRefresh: true,
  refreshInterval: 5000,
  defaultRedactionMode: 'partial',
} as const;

// Content types that indicate JSON body
export const JSON_CONTENT_TYPES = new Set([
  'application/json',
  'application/vnd.api+json',
  'text/json',
]);

// Content types that indicate form body
export const FORM_CONTENT_TYPES = new Set([
  'application/x-www-form-urlencoded',
]);

// Content types that indicate multipart body
export const MULTIPART_CONTENT_TYPES = new Set([
  'multipart/form-data',
]);

// Dynamic confidence thresholds
export const DYNAMIC_CONFIDENCE = {
  LOW_THRESHOLD: 0.3,
  MEDIUM_THRESHOLD: 0.7,
  HIGH_THRESHOLD: 0.9,
} as const;

// UI constants
export const UI_CONSTANTS = {
  MAX_REDACTED_EXAMPLES: 5,
  MAX_EXAMPLE_REQUESTS: 10,
  DEFAULT_PAGE_SIZE: 100,
  TREE_FILTER_DEBOUNCE: 300,
  GLOBAL_SEARCH_DEBOUNCE: 500,
} as const;

// Location display names and colors for UI
export const LOCATION_CONFIG = {
  [ParameterLocation.QUERY]: {
    label: 'Query',
    color: 'bg-accent/10 text-accent',
  },
  [ParameterLocation.JSON]: {
    label: 'JSON',
    color: 'bg-green/10 text-green',
  },
  [ParameterLocation.FORM]: {
    label: 'Form',
    color: 'bg-pink/10 text-pink',
  },
  [ParameterLocation.HEADER]: {
    label: 'Header',
    color: 'bg-purple/10 text-purple',
  },
  [ParameterLocation.COOKIE]: {
    label: 'Cookie',
    color: 'bg-orange/10 text-orange',
  },
  [ParameterLocation.PATH]: {
    label: 'Path',
    color: 'bg-yellow/10 text-yellow',
  },
  [ParameterLocation.MULTIPART]: {
    label: 'Multipart',
    color: 'bg-cyan/10 text-cyan',
  },
} as const;

// Flag display names and colors for UI
export const FLAG_CONFIG = {
  [Flag.NEW]: {
    label: 'NEW',
    color: 'bg-accent/15 text-accent',
  },
  [Flag.SENSITIVE]: {
    label: 'sensitive',
    color: 'bg-red/12 text-red',
  },
  [Flag.REDIRECT]: {
    label: 'redirect',
    color: 'bg-orange/12 text-orange',
  },
  [Flag.FILE]: {
    label: 'file',
    color: 'bg-yellow/12 text-yellow',
  },
  [Flag.AUTH]: {
    label: 'auth',
    color: 'bg-purple/12 text-purple',
  },
  [Flag.DYNAMIC]: {
    label: 'dynamic',
    color: 'bg-green/10 text-green',
  },
} as const;