/**
 * Mock Caido SDK for frontend development
 */

import type { Caido } from '@caido/sdk-frontend';
import type { InventoryBackendAPI, InventoryBackendEvents, Parameter, Domain, InventoryStats } from '@param-logger/shared';
import { ParameterLocation, ValueType, Flag } from '@param-logger/shared';

// Mock implementations of the backend API methods
const MOCK_PARAMETERS: Parameter[] = [
  // ─── auth.example.com / OAuth ───
  { id: 'a1', domain: 'auth.example.com', method: 'POST', normalizedPath: '/oauth/authorize',
    location: ParameterLocation.QUERY, name: 'redirect_uri',
    valueTypes: [ValueType.URL], flags: [Flag.REDIRECT, Flag.SENSITIVE], count: 89,
    firstSeen: new Date('2026-04-01'), lastSeen: new Date() },
  { id: 'a2', domain: 'auth.example.com', method: 'POST', normalizedPath: '/oauth/authorize',
    location: ParameterLocation.QUERY, name: 'response_type',
    valueTypes: [ValueType.STRING], flags: [], count: 89,
    firstSeen: new Date('2026-04-01'), lastSeen: new Date() },
  { id: 'a3', domain: 'auth.example.com', method: 'POST', normalizedPath: '/oauth/authorize',
    location: ParameterLocation.QUERY, name: 'client_id',
    valueTypes: [ValueType.STRING], flags: [Flag.AUTH], count: 89,
    firstSeen: new Date('2026-04-01'), lastSeen: new Date() },
  { id: 'a4', domain: 'auth.example.com', method: 'POST', normalizedPath: '/oauth/authorize',
    location: ParameterLocation.QUERY, name: 'state',
    valueTypes: [ValueType.HASH], flags: [Flag.SENSITIVE], count: 89,
    firstSeen: new Date('2026-04-01'), lastSeen: new Date() },
  { id: 'a5', domain: 'auth.example.com', method: 'POST', normalizedPath: '/oauth/token',
    location: ParameterLocation.FORM, name: 'grant_type',
    valueTypes: [ValueType.STRING], flags: [], count: 67,
    firstSeen: new Date('2026-04-02'), lastSeen: new Date() },
  { id: 'a6', domain: 'auth.example.com', method: 'POST', normalizedPath: '/oauth/token',
    location: ParameterLocation.FORM, name: 'code',
    valueTypes: [ValueType.HASH], flags: [Flag.SENSITIVE], count: 67,
    firstSeen: new Date('2026-04-02'), lastSeen: new Date() },

  // ─── api.example.com ───
  { id: 'b1', domain: 'api.example.com', method: 'GET', normalizedPath: '/api/v1/users/{id}',
    location: ParameterLocation.HEADER, name: 'Authorization',
    valueTypes: [ValueType.JWT], flags: [Flag.SENSITIVE], count: 87,
    firstSeen: new Date('2026-03-15'), lastSeen: new Date() },
  { id: 'b2', domain: 'api.example.com', method: 'GET', normalizedPath: '/api/v1/users/{id}',
    location: ParameterLocation.HEADER, name: 'X-Tenant-ID',
    valueTypes: [ValueType.UUID], flags: [Flag.AUTH], count: 87,
    firstSeen: new Date('2026-03-15'), lastSeen: new Date() },
  { id: 'b3', domain: 'api.example.com', method: 'GET', normalizedPath: '/api/v1/users/{id}',
    location: ParameterLocation.PATH, name: '{id}',
    valueTypes: [ValueType.INTEGER], flags: [], count: 87,
    firstSeen: new Date('2026-03-15'), lastSeen: new Date() },
  { id: 'b4', domain: 'api.example.com', method: 'POST', normalizedPath: '/api/v1/users',
    location: ParameterLocation.JSON, name: 'user.email',
    valueTypes: [ValueType.EMAIL], flags: [], count: 34,
    firstSeen: new Date('2026-03-20'), lastSeen: new Date() },
  { id: 'b5', domain: 'api.example.com', method: 'POST', normalizedPath: '/api/v1/users',
    location: ParameterLocation.JSON, name: 'user.role',
    valueTypes: [ValueType.STRING], flags: [Flag.AUTH, Flag.SENSITIVE], count: 34,
    firstSeen: new Date('2026-03-20'), lastSeen: new Date() },
  { id: 'b6', domain: 'api.example.com', method: 'POST', normalizedPath: '/api/v1/users',
    location: ParameterLocation.JSON, name: 'user.password',
    valueTypes: [ValueType.STRING], flags: [Flag.SENSITIVE], count: 34,
    firstSeen: new Date('2026-03-20'), lastSeen: new Date() },
  { id: 'b7', domain: 'api.example.com', method: 'POST', normalizedPath: '/api/v1/users',
    location: ParameterLocation.JSON, name: 'user.isAdmin',
    valueTypes: [ValueType.BOOLEAN], flags: [Flag.AUTH, Flag.SENSITIVE, Flag.NEW], count: 5,
    firstSeen: new Date(), lastSeen: new Date() },
  { id: 'b8', domain: 'api.example.com', method: 'GET', normalizedPath: '/api/v1/search',
    location: ParameterLocation.QUERY, name: 'q',
    valueTypes: [ValueType.STRING], flags: [], count: 203,
    firstSeen: new Date('2026-03-10'), lastSeen: new Date() },
  { id: 'b9', domain: 'api.example.com', method: 'GET', normalizedPath: '/api/v1/search',
    location: ParameterLocation.QUERY, name: 'page',
    valueTypes: [ValueType.INTEGER], flags: [], count: 203,
    firstSeen: new Date('2026-03-10'), lastSeen: new Date() },
  { id: 'b10', domain: 'api.example.com', method: 'POST', normalizedPath: '/api/v1/upload',
    location: ParameterLocation.MULTIPART, name: 'file',
    valueTypes: [ValueType.STRING], flags: [Flag.FILE], count: 18,
    firstSeen: new Date('2026-04-05'), lastSeen: new Date() },
  { id: 'b11', domain: 'api.example.com', method: 'GET', normalizedPath: '/api/v1/reports/{id}/export',
    location: ParameterLocation.QUERY, name: 'template',
    valueTypes: [ValueType.STRING], flags: [Flag.FILE], count: 28,
    firstSeen: new Date('2026-04-08'), lastSeen: new Date() },

  // ─── app.example.com ───
  { id: 'c1', domain: 'app.example.com', method: 'GET', normalizedPath: '/app/dashboard',
    location: ParameterLocation.COOKIE, name: 'session',
    valueTypes: [ValueType.HASH], flags: [Flag.SENSITIVE], count: 112,
    firstSeen: new Date('2026-03-01'), lastSeen: new Date() },
  { id: 'c2', domain: 'app.example.com', method: 'GET', normalizedPath: '/app/dashboard',
    location: ParameterLocation.QUERY, name: 'tab',
    valueTypes: [ValueType.STRING], flags: [], count: 112,
    firstSeen: new Date('2026-03-01'), lastSeen: new Date() },
  { id: 'c3', domain: 'app.example.com', method: 'POST', normalizedPath: '/app/invite',
    location: ParameterLocation.QUERY, name: 'return_url',
    valueTypes: [ValueType.URL], flags: [Flag.REDIRECT, Flag.NEW], count: 11,
    firstSeen: new Date(), lastSeen: new Date() },
  { id: 'c4', domain: 'app.example.com', method: 'POST', normalizedPath: '/app/invite',
    location: ParameterLocation.JSON, name: 'invitee_email',
    valueTypes: [ValueType.EMAIL], flags: [Flag.NEW], count: 11,
    firstSeen: new Date(), lastSeen: new Date() },

  // ─── admin.example.com ───
  { id: 'd1', domain: 'admin.example.com', method: 'GET', normalizedPath: '/admin/users',
    location: ParameterLocation.QUERY, name: 'debug',
    valueTypes: [ValueType.BOOLEAN], flags: [Flag.SENSITIVE, Flag.NEW], count: 3,
    firstSeen: new Date(), lastSeen: new Date() },
  { id: 'd2', domain: 'admin.example.com', method: 'GET', normalizedPath: '/admin/users',
    location: ParameterLocation.QUERY, name: 'role_filter',
    valueTypes: [ValueType.STRING], flags: [Flag.AUTH, Flag.NEW], count: 45,
    firstSeen: new Date(), lastSeen: new Date() },
];

const mockBackendAPI: InventoryBackendAPI = {
  async getInventory(filters) {
    console.log('Mock: getInventory called with filters:', filters);
    return MOCK_PARAMETERS;
  },

  async getDomains() {
    console.log('Mock: getDomains called');
    const counts = new Map<string, number>();
    for (const p of MOCK_PARAMETERS) {
      counts.set(p.domain, (counts.get(p.domain) ?? 0) + p.count);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count })) as Domain[];
  },

  async getStats() {
    console.log('Mock: getStats called');
    const domains = new Set(MOCK_PARAMETERS.map((p) => p.domain));
    const totalRequests = MOCK_PARAMETERS.reduce((s, p) => s + p.count, 0);
    return {
      totalRequests,
      uniqueParams: MOCK_PARAMETERS.length,
      domains: domains.size,
    } as InventoryStats;
  },

  async getCurrentProject() {
    const project = currentProjectId ? MOCK_PROJECTS[currentProjectId] : null;
    return {
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
    };
  },

  async resetAndRescan() {
    console.log('Mock: resetAndRescan called');
    // The mock has no real "rescan" — just re-emit the same canned data.
    setTimeout(() => {
      const listeners = eventListeners.get('inventory-batch') || [];
      listeners.forEach((cb) => cb(MOCK_PARAMETERS));
    }, 50);
    return { ok: true };
  },
};

// Mock scopes used by the simulated `caido.scopes` API.
const MOCK_SCOPES = [
  { id: '1', name: 'API targets', allowlist: ['*api.example.com'], denylist: [] },
  { id: '2', name: 'Admin only', allowlist: ['admin.example.com'], denylist: [] },
];

// Mock projects used by the simulated `caido.projects` API. The mock backend
// doesn't actually segregate parameters by project — switching projects in
// dev mode simply exercises the refresh flow.
const MOCK_PROJECTS: Record<string, { id: string; name: string }> = {
  'proj-acme': { id: 'proj-acme', name: 'Acme Bug Bounty' },
  'proj-internal': { id: 'proj-internal', name: 'Internal Pentest' },
};

// Event simulation for testing
let eventListeners = new Map<string, Function[]>();

export const mockCaido: Caido<InventoryBackendAPI, InventoryBackendEvents> = {
  // Backend SDK with proper RPC methods and event handling
  backend: {
    ...mockBackendAPI,
    onEvent: (event: any, callback: any) => {
      console.log('Mock: Registering event listener for', event);
      
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event)!.push(callback);
      
      // Simulate some batch events for testing the new system
      if (event === 'inventory-batch') {
        setTimeout(() => {
          // Simulate a batch update with some new parameters
          const newParams = [
            { ...MOCK_PARAMETERS[0], count: MOCK_PARAMETERS[0].count + 1, lastSeen: new Date() },
            { 
              id: 'test-new-1',
              domain: 'test.example.com', 
              method: 'GET', 
              normalizedPath: '/api/test',
              location: ParameterLocation.QUERY, 
              name: 'test_param',
              valueTypes: [ValueType.STRING], 
              flags: [Flag.NEW], 
              count: 1,
              firstSeen: new Date(), 
              lastSeen: new Date() 
            }
          ];
          callback(newParams);
          console.log('Mock: Sent batch update with', newParams.length, 'parameters');
        }, 2000);
      }
      
      return { stop: () => {
        const listeners = eventListeners.get(event) || [];
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
        console.log('Mock: Stopped listening to', event);
      }};
    }
  },

  navigation: {
    goTo: (route: any) => {
      console.log('Mock: Navigating to', route);
    },
    addPage: (path: string, options: any) => {
      console.log('Mock: Adding page', path, options);
    },
    onPageChange: (callback: any) => {
      console.log('Mock: Registering page change listener');
      return { stop: () => console.log('Mock: Stopped page change listener') };
    }
  },

  sidebar: {
    registerItem: (name: string, path: string, options?: any) => {
      console.log('Mock: Registering sidebar item', name, path, options);
      return { id: 'mock-item' } as any;
    }
  },

  storage: {
    get: async (key: string) => {
      console.log('Mock: Getting storage value for key', key);
      return localStorage.getItem(`caido-param-logger-${key}`);
    },
    set: async (key: string, value: any) => {
      console.log('Mock: Setting storage value for key', key, value);
      localStorage.setItem(`caido-param-logger-${key}`, JSON.stringify(value));
    },
    delete: async (key: string) => {
      console.log('Mock: Deleting storage value for key', key);
      localStorage.removeItem(`caido-param-logger-${key}`);
    },
    getKeys: async () => {
      console.log('Mock: Getting all storage keys');
      return Object.keys(localStorage).filter(k => k.startsWith('caido-param-logger-'));
    }
  },

  // Add other required SDK properties with minimal mock implementations
  graphql: {} as any,
  ui: {} as any,
  ai: {} as any,
  scopes: {
    getScopes: () => MOCK_SCOPES,
    getCurrentScope: () => MOCK_SCOPES.find((s) => s.id === currentScopeId),
    onCurrentScopeChange: (_cb: any) => ({ stop: () => {} }),
    createScope: () => {},
    deleteScope: () => {},
    updateScope: () => {},
  },
  findings: {} as any,
  commands: {} as any,
  menu: {} as any,
  projects: {
    onCurrentProjectChange: (_cb: any) => ({ stop: () => {} }),
  } as any,
  window: {} as any,
  assets: {} as any,
  shortcuts: {} as any,
  commandPalette: {} as any,
  replay: {} as any,
  search: {
    setQuery: (query: any) => {
      console.log('Mock: search.setQuery', query);
    },
    getQuery: () => '' as any,
    getScopeId: () => undefined,
    setScope: async () => {},
    addRequestEditorExtension: () => {},
    addResponseEditorExtension: () => {},
    addRequestViewMode: () => {},
    addResponseViewMode: () => {},
    scrollTo: () => {},
    addToSlot: (() => {}) as any,
  } as any,
  httpHistory: {} as any,
  automate: {} as any,
  files: {} as any,
  filters: {} as any,
  matchReplace: {} as any,
  env: {} as any,
  sitemap: {} as any,
  intercept: {} as any,
  runtime: {} as any,
  workflows: {} as any,
  footer: {} as any,
  log: {
    info: (message: string, ...args: any[]) => console.log(`[Mock] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[Mock] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[Mock] ${message}`, ...args),
    debug: (message: string, ...args: any[]) => console.debug(`[Mock] ${message}`, ...args)
  },
  settings: {} as any,
  _analytics: {} as any
};

// Helper function for testing batch updates
export function simulateBatchUpdate() {
  const listeners = eventListeners.get('inventory-batch') || [];
  const testParams = [
    { 
      id: 'batch-test-1',
      domain: 'batch.example.com', 
      method: 'POST', 
      normalizedPath: '/batch/test',
      location: ParameterLocation.JSON, 
      name: 'batch_param',
      valueTypes: [ValueType.STRING], 
      flags: [Flag.NEW], 
      count: 1,
      firstSeen: new Date(), 
      lastSeen: new Date() 
    },
    { 
      id: 'batch-test-2',
      domain: 'batch.example.com', 
      method: 'POST', 
      normalizedPath: '/batch/test',
      location: ParameterLocation.JSON, 
      name: 'another_param',
      valueTypes: [ValueType.INTEGER], 
      flags: [], 
      count: 1,
      firstSeen: new Date(), 
      lastSeen: new Date() 
    }
  ];
  
  listeners.forEach(callback => callback(testParams));
  console.log('Mock: Manual batch update sent with', testParams.length, 'parameters');
}

// Helper function for testing scope changes
let scopeChangeListeners: Function[] = [];

export function simulateScopeChange(scopeId?: string) {
  console.log('Mock: Simulating scope change to', scopeId || 'no scope');
  
  // Update the current scope ID
  currentScopeId = scopeId;
  
  // Notify all scope change listeners
  scopeChangeListeners.forEach(callback => {
    callback({ scopeId });
  });
  
  console.log('Mock: Notified', scopeChangeListeners.length, 'scope change listeners');
}

// Update the mock scope implementation to track listeners
mockCaido.scopes.onCurrentScopeChange = (callback: any) => {
  console.log('Mock: Registering scope change listener');
  scopeChangeListeners.push(callback);
  
  return { 
    stop: () => {
      const index = scopeChangeListeners.indexOf(callback);
      if (index > -1) {
        scopeChangeListeners.splice(index, 1);
      }
      console.log('Mock: Stopped listening to scope changes');
    }
  };
};

// Store current scope ID for getCurrentScope
let currentScopeId: string | undefined = undefined;

// ─── Project simulation ───
// Track project change listeners and the current project id. Mirrors the scope
// simulation so dev-mode users can exercise the project refresh flow.
let projectChangeListeners: Function[] = [];
let currentProjectId: string | undefined = undefined;

mockCaido.projects.onCurrentProjectChange = (callback: any) => {
  console.log('Mock: Registering project change listener');
  projectChangeListeners.push(callback);
  return {
    stop: () => {
      const index = projectChangeListeners.indexOf(callback);
      if (index > -1) {
        projectChangeListeners.splice(index, 1);
      }
      console.log('Mock: Stopped listening to project changes');
    },
  };
};

export function simulateProjectChange(projectId?: string): void {
  console.log('Mock: Simulating project change to', projectId || 'no project');
  currentProjectId = projectId;

  // Notify the frontend SDK listener (`caido.projects.onCurrentProjectChange`)
  projectChangeListeners.forEach((cb) => cb({ projectId }));

  // Also emit the backend `project-changed` event so the full reset+reload
  // pipeline runs end-to-end in dev mode.
  const project = projectId ? MOCK_PROJECTS[projectId] : null;
  const info = {
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
  };
  const listeners = eventListeners.get('project-changed') || [];
  listeners.forEach((cb) => cb(info));

  console.log(
    'Mock: Notified',
    projectChangeListeners.length,
    'frontend project listeners and',
    listeners.length,
    'backend project-changed listeners',
  );
}