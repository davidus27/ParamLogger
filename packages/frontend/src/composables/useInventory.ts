import { reactive, readonly, computed, ref, shallowRef } from 'vue';
import type { Parameter, Domain, InventoryStats } from '@param-logger/shared';

// Internal storage: Map for fast lookups and updates
const parametersMap = new Map<string, Parameter>();
const domainIndex = new Map<string, Map<string, Parameter[]>>();

// Reactive state with shallow refs for performance
const parametersRef = shallowRef<Parameter[]>([]);
const domainsRef = shallowRef<Domain[]>([]);
const state = reactive({
  stats: {
    totalRequests: 0,
    totalParams: 0,
    uniqueParams: 0,
    domains: 0,
    endpoints: 0
  } as InventoryStats,
  isLoading: false
});

function updateDomainIndex(parameter: Parameter) {
  if (!domainIndex.has(parameter.domain)) {
    domainIndex.set(parameter.domain, new Map());
  }
  const endpointMap = domainIndex.get(parameter.domain)!;
  const endpointKey = `${parameter.method} ${parameter.normalizedPath}`;
  
  if (!endpointMap.has(endpointKey)) {
    endpointMap.set(endpointKey, []);
  }
  
  const endpointParams = endpointMap.get(endpointKey)!;
  const existingIndex = endpointParams.findIndex(p => p.id === parameter.id);
  
  if (existingIndex >= 0) {
    endpointParams[existingIndex] = parameter;
  } else {
    endpointParams.push(parameter);
  }
}

function removeDomainIndex(parameter: Parameter) {
  if (!domainIndex.has(parameter.domain)) return;
  
  const endpointMap = domainIndex.get(parameter.domain)!;
  const endpointKey = `${parameter.method} ${parameter.normalizedPath}`;
  
  if (!endpointMap.has(endpointKey)) return;
  
  const endpointParams = endpointMap.get(endpointKey)!;
  const paramIndex = endpointParams.findIndex(p => p.id === parameter.id);
  
  if (paramIndex >= 0) {
    endpointParams.splice(paramIndex, 1);
    
    // Clean up empty endpoint
    if (endpointParams.length === 0) {
      endpointMap.delete(endpointKey);
      
      // Clean up empty domain
      if (endpointMap.size === 0) {
        domainIndex.delete(parameter.domain);
      }
    }
  }
}

export function useInventory() {
  function updateParameters(newParams: Parameter[]) {
    // Clear existing data
    parametersMap.clear();
    domainIndex.clear();
    
    // Populate new data
    for (const param of newParams) {
      parametersMap.set(param.id, param);
      updateDomainIndex(param);
    }
    
    // Update reactive ref with frozen array
    parametersRef.value = Object.freeze(Array.from(parametersMap.values()));
  }

  function upsertParameters(batch: Parameter[]) {
    for (const param of batch) {
      // Remove old index entry if parameter already exists
      const existing = parametersMap.get(param.id);
      if (existing) {
        removeDomainIndex(existing);
      }
      
      // Add/update parameter
      parametersMap.set(param.id, param);
      updateDomainIndex(param);
    }
    
    // Update reactive ref with frozen array
    parametersRef.value = Object.freeze(Array.from(parametersMap.values()));
  }

  function updateDomains(newDomains: Domain[]) {
    domainsRef.value = Object.freeze([...newDomains]);
  }

  function updateStats(newStats: InventoryStats) {
    Object.assign(state.stats, newStats);
  }

  // Wipe every cached parameter, domain, and stat. Used when the active Caido
  // project changes so we don't render stale data from the previous project
  // while the backend rescans.
  function clearInventory() {
    parametersMap.clear();
    domainIndex.clear();
    parametersRef.value = Object.freeze([] as Parameter[]);
    domainsRef.value = Object.freeze([] as Domain[]);
    // Mutate in place so existing reactive consumers keep their reference.
    Object.assign(state.stats, {
      totalRequests: 0,
      totalParams: 0,
      uniqueParams: 0,
      domains: 0,
      endpoints: 0,
    });
  }

  function setLoading(loading: boolean) {
    state.isLoading = loading;
  }

  // Memoized tree computation. We depend on the reactive parametersRef so
  // Vue re-evaluates this whenever the inventory changes; `domainIndex` itself
  // is a plain Map and isn't tracked by reactivity.
  const tree = computed(() => {
    const params = parametersRef.value;

    const result: Array<{
      name: string;
      paramCount: number;
      endpoints: Array<{
        method: string;
        path: string;
        params: Parameter[];
      }>;
    }> = [];

    const domainMap = new Map<string, Map<string, Parameter[]>>();
    for (const param of params) {
      let endpointMap = domainMap.get(param.domain);
      if (!endpointMap) {
        endpointMap = new Map();
        domainMap.set(param.domain, endpointMap);
      }
      const endpointKey = `${param.method} ${param.normalizedPath}`;
      let bucket = endpointMap.get(endpointKey);
      if (!bucket) {
        bucket = [];
        endpointMap.set(endpointKey, bucket);
      }
      bucket.push(param);
    }

    for (const [domainName, endpointMap] of domainMap) {
      const endpoints = Array.from(endpointMap.entries()).map(([endpointKey, ps]) => {
        const [method, path] = endpointKey.split(' ', 2);
        return {
          method,
          path,
          params: ps,
        };
      }).sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));

      result.push({
        name: domainName,
        paramCount: endpoints.reduce((sum, ep) => sum + ep.params.length, 0),
        endpoints,
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  });

  return {
    parameters: computed(() => parametersRef.value),
    domains: computed(() => domainsRef.value),
    stats: readonly(state.stats),
    isLoading: computed(() => state.isLoading),
    tree, // Expose memoized tree
    updateParameters,
    updateDomains,
    updateStats,
    setLoading,
    upsertParameters, // New method for incremental updates
    clearInventory,
  };
}
