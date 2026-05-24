// Sensitive parameter name patterns
export const SENSITIVE_NAME_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /auth/i,
  /key/i,
  /session/i,
  /cookie/i,
  /csrf/i,
  /jwt/i,
] as const;

// Redirect parameter name patterns  
export const REDIRECT_NAME_PATTERNS = [
  /redirect/i,
  /return/i,
  /callback/i,
  /next/i,
  /continue/i,
  /goto/i,
  /url/i,
  /uri/i,
] as const;

// File parameter name patterns
export const FILE_NAME_PATTERNS = [
  /file/i,
  /path/i,
  /dir/i,
  /directory/i,
  /folder/i,
  /template/i,
  /include/i,
  /upload/i,
] as const;

// Auth parameter name patterns
export const AUTH_NAME_PATTERNS = [
  /user/i,
  /username/i,
  /userid/i,
  /user[_-]?id/i,
  /account/i,
  /role/i,
  /permission/i,
  /access/i,
] as const;

// IDOR parameter name patterns
export const IDOR_NAME_PATTERNS = [
  /auth/i,
] as const;

// SSTI parameter name patterns
export const SSTI_NAME_PATTERNS = [
  /template/i,
  /theme/i,
  /render/i,
  /layout/i,
  /view/i,
  /format/i,
] as const;

// Injection parameter name patterns
export const INJECTION_NAME_PATTERNS = [
  /query/i,
  /search/i,
  /filter/i,
  /where/i,
  /sql/i,
  /expr/i,
  /cmd/i,
] as const;

// Debug parameter name patterns
export const DEBUG_NAME_PATTERNS = [
  /debug/i,
  /verbose/i,
  /dev/i,
  /admin/i,
  /trace/i,
  /test/i,
] as const;

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

// Time thresholds
export const NEW_PARAMETER_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours