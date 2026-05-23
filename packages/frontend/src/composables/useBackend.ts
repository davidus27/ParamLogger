import { reactive, readonly } from 'vue';
import type { Caido } from "@caido/sdk-frontend";
import type {
  InventoryBackendAPI,
  InventoryBackendEvents,
  InventoryFilters,
  Parameter,
  InventoryStats,
  ProjectInfo,
} from '@param-inventory/shared';
import { useInventory } from './useInventory';
import { useProject } from './useProject';
import { useScope } from './useScope';

let caido: Caido<InventoryBackendAPI, InventoryBackendEvents> | null = null;

const connectionStatus = reactive({
  isConnected: false,
  isScanning: false,
});

export function useBackend() {
  const {
    updateParameters,
    updateDomains,
    updateStats,
    upsertParameters,
    clearInventory,
    setLoading,
  } = useInventory();
  const { setFromBackendEvent: setProjectFromBackendEvent } = useProject();
  const { refresh: refreshScope } = useScope();

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

    // The backend emits this whenever Caido switches projects. Wipe local
    // caches immediately so the user never sees parameters from the previous
    // project, then reload everything from the (now-rescanning) backend.
    caido.backend.onEvent('project-changed', (info: ProjectInfo) => {
      console.info('[Param Inventory] backend project-changed', info);
      setProjectFromBackendEvent(info);
      // Scopes are project-scoped — the backend emits this event after the
      // project transition has settled, so re-reading the active scope here
      // is the most reliable place to pick up the new project's scope.
      refreshScope('backend-project-changed');
      clearInventory();
      setLoading(true);
      void loadInitialData().finally(() => setLoading(false));
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

  // Force the backend to wipe its in-memory store and rescan history for the
  // currently selected Caido project. The backend will emit `inventory-batch`
  // and `stats-updated` events as it rebuilds, which our subscriptions
  // already handle.
  async function resetAndRescan() {
    if (!caido) return;
    try {
      clearInventory();
      setLoading(true);
      await caido.backend.resetAndRescan();
    } catch (error) {
      console.error('Error during resetAndRescan:', error);
    } finally {
      setLoading(false);
    }
  }

  return {
    connectionStatus: readonly(connectionStatus),
    init,
    refreshInventory,
    loadInitialData,
    resetAndRescan,
  };
}
