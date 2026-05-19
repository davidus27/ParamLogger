/**
 * Reactive state management for the parameter inventory
 */

import { ref, computed, reactive, readonly } from 'vue';
import type { Parameter, Domain, InventoryFilters, InventoryStats, ParameterLocation, ParameterFlag } from '@param-inventory/shared';

// Global reactive state
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
  filters: {
    search: '',
    locations: [],
    flags: [],
    domains: [],
    showInteresting: false,
    showNew: false
  } as InventoryFilters,
  selectedParameter: null as Parameter | null,
  isLoading: false
});

export function useInventory() {
  const filteredParameters = computed(() => {
    let result = state.parameters;
    
    // Apply search filter
    if (state.filters.search) {
      const search = state.filters.search.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.domain.toLowerCase().includes(search) ||
        p.normalizedPath.toLowerCase().includes(search) ||
        p.valueTypes.some(vt => vt.toLowerCase().includes(search)) ||
        p.flags.some(f => f.toLowerCase().includes(search))
      );
    }
    
    // Apply location filter
    if (state.filters.locations && state.filters.locations.length > 0) {
      result = result.filter(p => state.filters.locations!.includes(p.location));
    }
    
    // Apply domain filter
    if (state.filters.domains && state.filters.domains.length > 0) {
      result = result.filter(p => state.filters.domains!.includes(p.domain));
    }
    
    // Apply flag filters
    if (state.filters.flags && state.filters.flags.length > 0) {
      result = result.filter(p => 
        state.filters.flags!.some(flag => p.flags.includes(flag))
      );
    }
    
    // Apply interesting filter
    if (state.filters.showInteresting) {
      result = result.filter(p => 
        p.flags.length > 0 || p.dynamicConfidence > 0.7
      );
    }
    
    // Apply new filter
    if (state.filters.showNew) {
      result = result.filter(p => p.flags.includes('new' as any));
    }
    
    return result;
  });
  
  const filteredDomains = computed(() => {
    if (state.filters.search) {
      const search = state.filters.search.toLowerCase();
      return state.domains.filter(domain =>
        domain.name.toLowerCase().includes(search) ||
        domain.endpoints.some(endpoint =>
          endpoint.path.toLowerCase().includes(search) ||
          endpoint.normalizedPath.toLowerCase().includes(search)
        )
      );
    }
    return state.domains;
  });
  
  const availableLocations = computed(() => {
    const locations = new Set<ParameterLocation>();
    state.parameters.forEach(p => locations.add(p.location));
    return Array.from(locations);
  });
  
  const availableFlags = computed(() => {
    const flags = new Set<ParameterFlag>();
    state.parameters.forEach(p => p.flags.forEach(f => flags.add(f)));
    return Array.from(flags);
  });
  
  const availableDomainNames = computed(() => {
    const domainNames = new Set<string>();
    state.parameters.forEach(p => domainNames.add(p.domain));
    return Array.from(domainNames);
  });
  
  // Computed stats based on filtered results
  const filteredStats = computed(() => {
    const filtered = filteredParameters.value;
    const uniqueNames = new Set(filtered.map(p => p.name));
    const domainsInResults = new Set(filtered.map(p => p.domain));
    const endpointsInResults = new Set(filtered.map(p => `${p.domain}:${p.method}:${p.normalizedPath}`));
    
    return {
      ...state.stats,
      filteredParams: filtered.length,
      filteredUniqueParams: uniqueNames.size,
      filteredDomains: domainsInResults.size,
      filteredEndpoints: endpointsInResults.size
    };
  });
  
  function updateParameters(newParams: Parameter[]) {
    state.parameters = newParams;
    console.log(`Updated parameters: ${newParams.length} total`);
  }
  
  function addParameter(param: Parameter) {
    const existingIndex = state.parameters.findIndex(p => p.id === param.id);
    if (existingIndex >= 0) {
      state.parameters[existingIndex] = param;
    } else {
      state.parameters.push(param);
    }
  }
  
  function updateDomains(newDomains: Domain[]) {
    state.domains = newDomains;
    console.log(`Updated domains: ${newDomains.length} total`);
  }
  
  function updateStats(newStats: InventoryStats) {
    state.stats = newStats;
  }
  
  function updateFilters(newFilters: Partial<InventoryFilters>) {
    state.filters = { ...state.filters, ...newFilters };
    console.log('Filters updated:', state.filters);
  }
  
  function setSearch(searchTerm: string) {
    state.filters.search = searchTerm;
  }
  
  function toggleLocationFilter(location: ParameterLocation) {
    const locations = state.filters.locations || [];
    const index = locations.indexOf(location);
    if (index >= 0) {
      state.filters.locations = locations.filter(l => l !== location);
    } else {
      state.filters.locations = [...locations, location];
    }
  }
  
  function toggleFlagFilter(flag: ParameterFlag) {
    const flags = state.filters.flags || [];
    const index = flags.indexOf(flag);
    if (index >= 0) {
      state.filters.flags = flags.filter(f => f !== flag);
    } else {
      state.filters.flags = [...flags, flag];
    }
  }
  
  function toggleDomainFilter(domain: string) {
    const domains = state.filters.domains || [];
    const index = domains.indexOf(domain);
    if (index >= 0) {
      state.filters.domains = domains.filter(d => d !== domain);
    } else {
      state.filters.domains = [...domains, domain];
    }
  }
  
  function setSelectedParameter(parameter: Parameter | null) {
    state.selectedParameter = parameter;
  }
  
  function setLoading(loading: boolean) {
    state.isLoading = loading;
  }
  
  function toggleInteresting() {
    state.filters.showInteresting = !state.filters.showInteresting;
    return state.filters.showInteresting;
  }
  
  function toggleNew() {
    state.filters.showNew = !state.filters.showNew;
    return state.filters.showNew;
  }
  
  function clearFilters() {
    state.filters = {
      search: '',
      locations: [],
      flags: [],
      domains: [],
      showInteresting: false,
      showNew: false
    };
  }
  
  function resetFilters() {
    clearFilters();
  }
  
  function clearAll() {
    state.parameters = [];
    state.domains = [];
    state.stats = {
      totalRequests: 0,
      totalParams: 0,
      uniqueParams: 0,
      domains: 0,
      endpoints: 0
    };
    resetFilters();
  }
  
  return {
    // Reactive state (readonly to prevent direct mutation)
    parameters: filteredParameters,
    domains: filteredDomains,
    stats: readonly(state.stats),
    filters: readonly(state.filters),
    selectedParameter: readonly(ref(state.selectedParameter)),
    isLoading: readonly(ref(state.isLoading)),
    
    // Computed helpers
    availableLocations,
    availableFlags,
    availableDomainNames,
    filteredStats,
    
    // Raw data (for components that need the unfiltered data)
    rawParameters: readonly(ref(state.parameters)),
    rawDomains: readonly(ref(state.domains)),
    
    // Actions
    updateParameters,
    addParameter,
    updateDomains,
    updateStats,
    updateFilters,
    setSearch,
    toggleLocationFilter,
    toggleFlagFilter,
    toggleDomainFilter,
    toggleInteresting,
    toggleNew,
    clearFilters,
    setSelectedParameter,
    setLoading,
    resetFilters,
    clearAll
  };
}