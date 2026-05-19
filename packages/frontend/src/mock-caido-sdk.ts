/**
 * Mock Caido SDK for frontend development
 */

import type { Caido } from '@caido/sdk-frontend';
import type { InventoryBackendAPI, InventoryBackendEvents, Parameter, Domain, InventoryStats, Observation } from '@param-inventory/shared';
import { ParameterLocation, ValueType } from '@param-inventory/shared';

// Mock implementations of the backend API methods
const mockBackendAPI: InventoryBackendAPI = {
  async getInventory(filters) {
    console.log('Mock: getInventory called with filters:', filters);
    // Return some mock parameters
    return [
      {
        id: '1',
        domain: 'example.com',
        method: 'POST',
        path: '/api/login',
        normalizedPath: '/api/login',
        location: ParameterLocation.JSON,
        name: 'username',
        valueTypes: [ValueType.STRING],
        dynamicConfidence: 0.8,
        flags: [],
        count: 5,
        firstSeen: new Date('2023-01-01'),
        lastSeen: new Date(),
        redactedExamples: ['user***'],
        exampleRequestIds: ['req1', 'req2']
      }
    ] as Parameter[];
  },

  async getDomains() {
    console.log('Mock: getDomains called');
    return [
      {
        name: 'example.com',
        endpoints: [],
        totalParams: 10,
        lastSeen: new Date()
      }
    ] as Domain[];
  },

  async getParameterDetail(parameterId) {
    console.log('Mock: getParameterDetail called with:', parameterId);
    return null;
  },

  async getParameterObservations(parameterId, limit) {
    console.log('Mock: getParameterObservations called with:', parameterId, limit);
    return [] as Observation[];
  },

  async getStats() {
    console.log('Mock: getStats called');
    return {
      totalRequests: 100,
      totalParams: 50,
      uniqueParams: 25,
      domains: 5,
      endpoints: 15
    } as InventoryStats;
  },

  async exportWordlist(filters) {
    console.log('Mock: exportWordlist called with filters:', filters);
    return ['param1', 'param2', 'param3'];
  },

  async clearInventory() {
    console.log('Mock: clearInventory called');
  },

  async triggerHistoricalScan() {
    console.log('Mock: triggerHistoricalScan called');
  }
};

export const mockCaido: Caido<InventoryBackendAPI, InventoryBackendEvents> = {
  // Backend SDK with proper RPC methods and event handling
  backend: {
    ...mockBackendAPI,
    onEvent: (event: any, callback: any) => {
      console.log('Mock: Registering event listener for', event);
      return { stop: () => console.log('Mock: Stopped listening to', event) };
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
      return localStorage.getItem(`caido-param-inventory-${key}`);
    },
    set: async (key: string, value: any) => {
      console.log('Mock: Setting storage value for key', key, value);
      localStorage.setItem(`caido-param-inventory-${key}`, JSON.stringify(value));
    },
    delete: async (key: string) => {
      console.log('Mock: Deleting storage value for key', key);
      localStorage.removeItem(`caido-param-inventory-${key}`);
    },
    getKeys: async () => {
      console.log('Mock: Getting all storage keys');
      return Object.keys(localStorage).filter(k => k.startsWith('caido-param-inventory-'));
    }
  },

  // Add other required SDK properties with minimal mock implementations
  graphql: {} as any,
  ui: {} as any,
  ai: {} as any,
  scopes: {} as any,
  findings: {} as any,
  commands: {} as any,
  menu: {} as any,
  projects: {} as any,
  window: {} as any,
  assets: {} as any,
  shortcuts: {} as any,
  commandPalette: {} as any,
  replay: {} as any,
  search: {} as any,
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