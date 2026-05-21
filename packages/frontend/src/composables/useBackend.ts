import { reactive, readonly } from 'vue';
import type { Caido } from "@caido/sdk-frontend";
import type { InventoryBackendAPI, InventoryBackendEvents, InventoryFilters, Parameter, InventoryStats } from '@param-inventory/shared';
import { useInventory } from './useInventory';

let caido: Caido<InventoryBackendAPI, InventoryBackendEvents> | null = null;

const connectionStatus = reactive({
  isConnected: false,
  isScanning: false,
});

export function useBackend() {
  const { updateParameters, updateDomains, updateStats, upsertParameters } = useInventory();

  function init(caidoInstance: Caido<InventoryBackendAPI, InventoryBackendEvents>) {
    caido = caidoInstance;
    connectionStatus.isConnected = true;
    setupEventSubscriptions();
    loadInitialData();
  }

  function setupEventSubscriptions() {
    if (!caido) return;

    caido.backend.onEvent('inventory-batch', (parameters: Parameter[]) => {
      upsertParameters(parameters);
    });

    caido.backend.onEvent('stats-updated', (stats: InventoryStats) => {
      updateStats(stats);
    });

    caido.backend.onEvent('scan-started', (_data: { total: number }) => {
      connectionStatus.isScanning = true;
    });

    caido.backend.onEvent('scan-completed', (_data: { processed: number; duration: number }) => {
      connectionStatus.isScanning = false;
      refreshInventory();
    });
  }

  async function loadInitialData() {
    try {
      await Promise.all([
        refreshInventory(),
        refreshDomains(),
        refreshStats()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  async function refreshInventory(filters?: InventoryFilters) {
    if (!caido) return;
    try {
      // Always send a concrete object: passing `undefined` becomes `null`
      // over the wire and Caido's backend RPC rejects null args with
      // "invalid type: null, expected a string".
      const safeFilters: InventoryFilters = filters ?? {};
      const parameters = await caido.backend.getInventory(safeFilters);
      updateParameters(parameters);
    } catch (error) {
      console.error('Error refreshing inventory:', error);
    }
  }

  async function refreshDomains() {
    if (!caido) return;
    try {
      const domains = await caido.backend.getDomains();
      updateDomains(domains);
    } catch (error) {
      console.error('Error refreshing domains:', error);
    }
  }

  async function refreshStats() {
    if (!caido) return;
    try {
      const stats = await caido.backend.getStats();
      updateStats(stats);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  }

  return {
    connectionStatus: readonly(connectionStatus),
    init,
    refreshInventory,
    loadInitialData
  };
}
