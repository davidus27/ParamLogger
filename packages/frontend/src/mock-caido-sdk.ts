/**
 * Mock Caido SDK for frontend development
 */

import type { Caido } from '@caido/sdk-frontend';
import type { InventoryBackendAPI, InventoryBackendEvents, Parameter, Domain, InventoryStats } from '@param-inventory/shared';
import { ParameterLocation, ValueType, Flag } from '@param-inventory/shared';

// Mock implementations of the backend API methods
const mockBackendAPI: InventoryBackendAPI = {
  async getInventory(filters) {
    console.log('Mock: getInventory called with filters:', filters);
    // Return some mock parameters with the new minimal Parameter interface
    return [
      {
        id: '1',
        domain: 'example.com',
        method: 'POST',
        normalizedPath: '/api/login',
        location: ParameterLocation.JSON,
        name: 'username',
        valueTypes: [ValueType.STRING],
        flags: [Flag.SENSITIVE],
        count: 5,
        firstSeen: new Date('2023-01-01'),
        lastSeen: new Date()
      },
      {
        id: '2',
        domain: 'api.example.com',
        method: 'GET',
        normalizedPath: '/users/{id}',
        location: ParameterLocation.QUERY,
        name: 'token',
        valueTypes: [ValueType.JWT],
        flags: [Flag.AUTH, Flag.SENSITIVE],
        count: 12,
        firstSeen: new Date('2023-01-15'),
        lastSeen: new Date()
      },
      {
        id: '3',
        domain: 'example.com',
        method: 'POST',
        normalizedPath: '/upload',
        location: ParameterLocation.MULTIPART,
        name: 'file',
        valueTypes: [ValueType.STRING],
        flags: [Flag.FILE, Flag.NEW],
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date()
      }
    ] as Parameter[];
  },

  async getDomains() {
    console.log('Mock: getDomains called');
    return [
      {
        name: 'example.com',
        count: 25
      },
      {
        name: 'api.example.com',
        count: 15
      }
    ] as Domain[];
  },

  async getStats() {
    console.log('Mock: getStats called');
    return {
      totalRequests: 100,
      uniqueParams: 25,
      domains: 2
    } as InventoryStats;
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