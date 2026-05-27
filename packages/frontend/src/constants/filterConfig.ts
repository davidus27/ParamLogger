import { ParameterLocation, ValueType } from '@param-logger/shared';

export const locationFilters: Array<{ value: 'all' | ParameterLocation; label: string }> = [
  { value: 'all', label: 'All' },
  { value: ParameterLocation.QUERY, label: 'Query' },
  { value: ParameterLocation.JSON, label: 'JSON' },
  { value: ParameterLocation.FORM, label: 'Form' },
  { value: ParameterLocation.HEADER, label: 'Header' },
  { value: ParameterLocation.COOKIE, label: 'Cookie' },
  { value: ParameterLocation.PATH, label: 'Path' },
];

export const FILTER_FLAGS = [
  { flag: 'file', label: 'file' },
  { flag: 'sensitive', label: 'sensitive' },
  { flag: 'auth', label: 'auth' },
  { flag: 'redirect', label: 'redirect' },
  { flag: 'new', label: 'new' },
  { flag: 'idor', label: 'idor' },
  { flag: 'ssti', label: 'ssti' },
  { flag: 'injection', label: 'injection' },
  { flag: 'debug', label: 'debug' },
  { flag: 'proto', label: 'proto' },
];

export const FILTER_VALUE_TYPES = [
  { valueType: ValueType.JWT, label: 'jwt' },
  { valueType: ValueType.URL, label: 'url' },
  { valueType: ValueType.EMAIL, label: 'email' },
  { valueType: ValueType.UUID, label: 'uuid' },
  { valueType: ValueType.BASE64, label: 'base64' },
  { valueType: ValueType.HASH, label: 'hash' },
  { valueType: ValueType.INTEGER, label: 'integer' },
  { valueType: ValueType.BOOLEAN, label: 'boolean' },
  { valueType: ValueType.TIMESTAMP, label: 'timestamp' },
  { valueType: ValueType.IP, label: 'ip' },
  { valueType: ValueType.SERIALIZED, label: 'serialized' },
];