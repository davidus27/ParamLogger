/**
 * Integration example demonstrating the frontend-backend wiring
 * 
 * This file shows how the reactive state management and backend communication works
 */

import { useInventory } from './composables/useInventory';
import { useBackend } from './composables/useBackend';
import { mockCaido } from './mock-caido-sdk';
import type { Parameter, Domain, InventoryStats, ParameterLocation, ValueType, ParameterFlag } from '@param-inventory/shared';

// Example usage of the reactive state system
function demonstrateReactiveState() {
  console.log('=== Reactive State Management Demo ===');
  
  const {
    parameters,
    domains,
    stats,
    filters,
    availableLocations,
    availableFlags,
    updateParameters,
    updateDomains,
    updateStats,
    setSearch,
    toggleLocationFilter,
    toggleFlagFilter,
    resetFilters
  } = useInventory();

  // Initial state
  console.log('Initial parameters:', parameters.value.length);
  console.log('Initial stats:', stats);

  // Update with mock data
  const mockParameters: Parameter[] = [
    {
      id: 'example.com:GET:/api/users:query:search',
      domain: 'example.com',
      method: 'GET',
      path: '/api/users',
      normalizedPath: '/api/users',
      location: 'query' as ParameterLocation,
      name: 'search',
      valueTypes: ['string' as ValueType],
      dynamicConfidence: 0.8,
      flags: ['new' as ParameterFlag],
      count: 5,
      firstSeen: new Date(),
      lastSeen: new Date(),
      redactedExamples: ['john doe', 'admin'],
      exampleRequestIds: ['1', '2', '3']
    },
    {
      id: 'example.com:POST:/api/users:json:user.email',
      domain: 'example.com',
      method: 'POST',
      path: '/api/users',
      normalizedPath: '/api/users',
      location: 'json' as ParameterLocation,
      name: 'user.email',
      valueTypes: ['email' as ValueType],
      dynamicConfidence: 0.9,
      flags: ['sensitive' as ParameterFlag],
      count: 12,
      firstSeen: new Date(),
      lastSeen: new Date(),
      redactedExamples: ['j***@example.com'],
      exampleRequestIds: ['4', '5']
    }
  ];

  updateParameters(mockParameters);
  console.log('After adding parameters:', parameters.value.length);

  // Test filtering
  setSearch('email');
  console.log('After search filter:', parameters.value.length);
  
  toggleLocationFilter('json' as ParameterLocation);
  console.log('After location filter:', parameters.value.length);

  resetFilters();
  console.log('After reset:', parameters.value.length);
}

// Example usage of backend communication
async function demonstrateBackendCommunication() {
  console.log('=== Backend Communication Demo ===');
  
  const backend = useBackend();
  
  // Initialize with mock SDK
  backend.init(mockCaido);
  
  console.log('Connection status:', backend.connectionStatus.isConnected);
  
  try {
    // Test RPC calls
    const inventory = await backend.getInventory();
    console.log('Inventory from backend:', inventory.length);
    
    const domains = await backend.getDomains();
    console.log('Domains from backend:', domains.length);
    
    const stats = await backend.getStats();
    console.log('Stats from backend:', stats);
    
    // Test wordlist export
    const wordlist = await backend.exportWordlist();
    console.log('Wordlist from backend:', wordlist.length);
    
  } catch (error) {
    console.log('Backend calls (expected to use mock data):', error);
  }
}

// Example of how components would integrate both systems
function demonstrateComponentIntegration() {
  console.log('=== Component Integration Demo ===');
  
  const inventory = useInventory();
  const backend = useBackend();
  
  // This is how a component would initialize
  backend.init(mockCaido);
  
  // Listen for changes and update inventory
  // In a real component, this would be done via Vue's reactivity system
  const unsubscribe = () => {
    // Cleanup function
  };
  
  // Example of how search would work in a component
  inventory.setSearch('api');
  console.log('Filtered parameters for "api":', inventory.parameters.value.length);
  
  // Example of how location filtering would work
  inventory.toggleLocationFilter('query' as ParameterLocation);
  console.log('Parameters in query location:', inventory.parameters.value.length);
  
  return unsubscribe;
}

// Run all demonstrations
export async function runIntegrationDemo() {
  console.log('🚀 Running Parameter Inventory Integration Demo...\n');
  
  try {
    demonstrateReactiveState();
    console.log('');
    
    await demonstrateBackendCommunication();
    console.log('');
    
    const cleanup = demonstrateComponentIntegration();
    console.log('');
    
    console.log('✅ Integration demo completed successfully!');
    
    // Cleanup
    cleanup();
    
    return true;
  } catch (error) {
    console.error('❌ Integration demo failed:', error);
    return false;
  }
}

// Auto-run in development mode
if (import.meta.env.DEV) {
  console.log('Development mode detected - you can run integration demo with:');
  console.log('import { runIntegrationDemo } from "./integration-example"; runIntegrationDemo();');
}