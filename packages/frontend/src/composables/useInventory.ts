import { reactive, readonly, computed, ref } from 'vue';
import type { Parameter, Domain, InventoryStats } from '@param-inventory/shared';

const state = reactive({
  parameters: [] as Parameter[],
  domains: [] as Domain[],
  stats: {
    totalRequests: 0,
    totalParams: 0,
    uniqueParams: 0,
    domains: 0,
    endpoints: 0
  } as InventoryStats,
  isLoading: false
});

export function useInventory() {
  function updateParameters(newParams: Parameter[]) {
    state.parameters = newParams;
  }

  function updateDomains(newDomains: Domain[]) {
    state.domains = newDomains;
  }

  function updateStats(newStats: InventoryStats) {
    state.stats = newStats;
  }

  function setLoading(loading: boolean) {
    state.isLoading = loading;
  }

  return {
    parameters: computed(() => state.parameters),
    domains: computed(() => state.domains),
    stats: readonly(state.stats),
    isLoading: computed(() => state.isLoading),
    updateParameters,
    updateDomains,
    updateStats,
    setLoading,
  };
}
