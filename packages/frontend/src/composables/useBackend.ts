/**
 * Backend RPC and event communication
 */

import { reactive, readonly } from 'vue';
import type { Caido } from "../mock-caido-sdk";
import type { RpcMethods, BackendEvents, InventoryFilters, Parameter, Domain, InventoryStats, Observation } from '@param-inventory/shared';
import { useInventory } from './useInventory';

let caido: Caido | null = null;

// Global reactive state for backend connection status
const connectionStatus = reactive({
  isConnected: false,
  isScanning: false,
  scanProgress: null as { processed: number; total: number; isComplete: boolean } | null
});

export function useBackend() {
  const { updateParameters, updateDomains, updateStats } = useInventory();
  
  function init(caidoInstance: Caido) {
    caido = caidoInstance;
    connectionStatus.isConnected = true;
    
    console.log('Initializing backend connection...');
    
    // Set up event subscriptions
    setupEventSubscriptions();
    
    // Load initial data
    loadInitialData();
  }
  
  function setupEventSubscriptions() {
    if (!caido) return;
    
    // Listen for parameter inventory updates
    caido.backend.onEvent('inventory-updated', (parameter: Parameter) => {
      console.log('Parameter updated:', parameter);
      // Refresh the full inventory to ensure consistency
      refreshInventory();
    });
    
    // Listen for new observations
    caido.backend.onEvent('observation-added', (observation: Observation) => {
      console.log('New observation added:', observation);
      // Could update individual parameter if needed, but refreshInventory covers this
    });
    
    // Listen for scan progress updates
    caido.backend.onEvent('scan-progress', (progress: { processed: number; total: number; isComplete: boolean }) => {
      console.log('Scan progress:', progress);
      connectionStatus.scanProgress = progress;
      connectionStatus.isScanning = !progress.isComplete;
    });
    
    // Listen for stats updates
    caido.backend.onEvent('stats-updated', (stats: InventoryStats) => {
      console.log('Stats updated:', stats);
      updateStats(stats);
    });
    
    // Listen for scan lifecycle events
    caido.backend.onEvent('scan-started', (data: { total: number }) => {
      console.log('Historical scan started:', data);
      connectionStatus.isScanning = true;
      connectionStatus.scanProgress = { processed: 0, total: data.total, isComplete: false };
    });
    
    caido.backend.onEvent('scan-completed', (data: { processed: number; duration: number }) => {
      console.log('Historical scan completed:', data);
      connectionStatus.isScanning = false;
      connectionStatus.scanProgress = null;
      refreshInventory(); // Ensure UI is fully up to date
    });
  }
  
  async function loadInitialData() {
    try {
      // Load initial inventory, domains, and stats
      await Promise.all([
        refreshInventory(),
        refreshDomains(),
        refreshStats()
      ]);
      console.log('Initial data loaded successfully');
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }
  
  async function refreshInventory(filters?: InventoryFilters) {
    try {
      const parameters = await getInventory(filters);
      updateParameters(parameters);
    } catch (error) {
      console.error('Error refreshing inventory:', error);
    }
  }
  
  async function refreshDomains() {
    try {
      const domains = await getDomains();
      updateDomains(domains);
    } catch (error) {
      console.error('Error refreshing domains:', error);
    }
  }
  
  async function refreshStats() {
    try {
      const stats = await getStats();
      updateStats(stats);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  }
  
  async function getInventory(filters?: InventoryFilters): Promise<Parameter[]> {
    if (!caido) throw new Error('Backend not initialized');
    try {
      return await caido.backend.getInventory(filters);
    } catch (error) {
      console.error('Error calling getInventory:', error);
      return [];
    }
  }
  
  async function getDomains(): Promise<Domain[]> {
    if (!caido) throw new Error('Backend not initialized');
    try {
      return await caido.backend.getDomains();
    } catch (error) {
      console.error('Error calling getDomains:', error);
      return [];
    }
  }
  
  async function getParameterDetail(id: string): Promise<Parameter | null> {
    if (!caido) throw new Error('Backend not initialized');
    try {
      return await caido.backend.getParameterDetail(id);
    } catch (error) {
      console.error('Error calling getParameterDetail:', error);
      return null;
    }
  }
  
  async function getParameterObservations(id: string, limit?: number): Promise<Observation[]> {
    if (!caido) throw new Error('Backend not initialized');
    try {
      return await caido.backend.getParameterObservations(id, limit);
    } catch (error) {
      console.error('Error calling getParameterObservations:', error);
      return [];
    }
  }
  
  async function getStats(): Promise<InventoryStats> {
    if (!caido) throw new Error('Backend not initialized');
    try {
      return await caido.backend.getStats();
    } catch (error) {
      console.error('Error calling getStats:', error);
      return {
        totalRequests: 0,
        totalParams: 0,
        uniqueParams: 0,
        domains: 0,
        endpoints: 0
      };
    }
  }
  
  async function exportWordlist(filters?: InventoryFilters): Promise<string[]> {
    if (!caido) throw new Error('Backend not initialized');
    try {
      return await caido.backend.exportWordlist(filters);
    } catch (error) {
      console.error('Error calling exportWordlist:', error);
      return [];
    }
  }
  
  async function clearInventory(): Promise<void> {
    if (!caido) throw new Error('Backend not initialized');
    try {
      await caido.backend.clearInventory();
      // Refresh the UI after clearing
      await loadInitialData();
    } catch (error) {
      console.error('Error calling clearInventory:', error);
    }
  }
  
  async function triggerHistoricalScan(): Promise<void> {
    if (!caido) throw new Error('Backend not initialized');
    try {
      await caido.backend.triggerHistoricalScan();
    } catch (error) {
      console.error('Error calling triggerHistoricalScan:', error);
    }
  }
  
  return {
    // State
    connectionStatus: readonly(connectionStatus),
    
    // Initialization
    init,
    
    // Data fetching
    getInventory,
    getDomains,
    getParameterDetail,
    getParameterObservations,
    getStats,
    exportWordlist,
    
    // Actions
    clearInventory,
    triggerHistoricalScan,
    
    // Refresh methods (useful for manual updates)
    refreshInventory,
    refreshDomains,
    refreshStats,
    loadInitialData
  };
}