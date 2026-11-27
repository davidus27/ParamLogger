import { reactive, readonly, computed, shallowRef, watch } from 'vue';
import type { Parameter, Domain, InventoryStats } from '@param-logger/shared';
import { usePageVisibility } from './usePageVisibility';

export type TreeEndpoint = {
  method: string;
  path: string;
  params: Parameter[];
};

export type TreeNode = {
  name: string;
  paramCount: number;
  endpoints: TreeEndpoint[];
};

// Internal storage: Map for fast lookups and updates
const parametersMap = new Map<string, Parameter>();
// domain -> "METHOD path" -> parameters, each level in first-seen order, the
// order parametersMap iterates in.
const domainIndex = new Map<string, Map<string, Parameter[]>>();

// Reactive state with shallow refs for performance
const parametersRef = shallowRef<Parameter[]>([]);

// The tree is rebuilt per domain at publish time: only the domains touched
// since the last publish get new nodes, and the domain list is re-sorted only
// when a domain is added or removed. Nodes copy their endpoints' parameter
// lists because domainIndex keeps changing while the page is hidden, and the
// tree has to match parametersRef, not parametersMap.
const treeNodes = new Map<string, TreeNode>();
const dirtyTreeDomains = new Set<string>();
let treeDomainsChanged = false;
const treeRef = shallowRef<TreeNode[]>([]);

function buildTreeNode(name: string, endpointMap: Map<string, Parameter[]>): TreeNode {
  let paramCount = 0;
  const endpoints: TreeEndpoint[] = [];
  for (const [endpointKey, params] of endpointMap) {
    const [method, path] = endpointKey.split(' ', 2);
    endpoints.push({ method, path, params: params.slice() });
    paramCount += params.length;
  }
  endpoints.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
  return { name, paramCount, endpoints };
}

function publishTree() {
  if (dirtyTreeDomains.size === 0 && !treeDomainsChanged) return;

  for (const name of dirtyTreeDomains) {
    const endpointMap = domainIndex.get(name);
    if (endpointMap) {
      if (!treeNodes.has(name)) treeDomainsChanged = true;
      treeNodes.set(name, buildTreeNode(name, endpointMap));
    } else if (treeNodes.delete(name)) {
      treeDomainsChanged = true;
    }
  }
  dirtyTreeDomains.clear();

  treeRef.value = treeDomainsChanged
    ? Array.from(domainIndex.keys(), name => treeNodes.get(name)!).sort((a, b) => a.name.localeCompare(b.name))
    : treeRef.value.map(node => treeNodes.get(node.name)!);
  treeDomainsChanged = false;
}

function resetTree() {
  treeNodes.clear();
  dirtyTreeDomains.clear();
  treeDomainsChanged = false;
}

// Every computed over the inventory re-runs when parametersRef changes, so
// while the page is hidden parametersMap runs ahead and parametersRef catches
// up once, when the page is shown.
const { isVisible } = usePageVisibility();
let publishPending = false;

function publishParameters() {
  publishPending = false;
  publishTree();
  parametersRef.value = Object.freeze(Array.from(parametersMap.values()));
}

function schedulePublish() {
  if (isVisible.value) publishParameters();
  else publishPending = true;
}

watch(isVisible, (visible) => {
  if (visible && publishPending) publishParameters();
}, { flush: 'sync' });
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

function endpointKeyOf(parameter: Parameter): string {
  return `${parameter.method} ${parameter.normalizedPath}`;
}

// `known`: the parameter is already indexed under the same endpoint, so it is
// replaced where it is, which keeps first-seen order.
function updateDomainIndex(parameter: Parameter, known: boolean) {
  dirtyTreeDomains.add(parameter.domain);
  let endpointMap = domainIndex.get(parameter.domain);
  if (!endpointMap) {
    endpointMap = new Map();
    domainIndex.set(parameter.domain, endpointMap);
  }
  const endpointKey = endpointKeyOf(parameter);
  let endpointParams = endpointMap.get(endpointKey);
  if (!endpointParams) {
    endpointParams = [];
    endpointMap.set(endpointKey, endpointParams);
  }

  const existingIndex = known ? endpointParams.findIndex(p => p.id === parameter.id) : -1;
  if (existingIndex >= 0) {
    endpointParams[existingIndex] = parameter;
  } else {
    endpointParams.push(parameter);
  }
}

function removeDomainIndex(parameter: Parameter) {
  const endpointMap = domainIndex.get(parameter.domain);
  if (!endpointMap) return;
  dirtyTreeDomains.add(parameter.domain);

  const endpointKey = endpointKeyOf(parameter);
  const endpointParams = endpointMap.get(endpointKey);
  if (!endpointParams) return;

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
    resetTree();
    // Every node is rebuilt, and a domain may be gone, so the list is too.
    treeDomainsChanged = true;
    
    // Populate new data
    for (const param of newParams) {
      const known = parametersMap.has(param.id);
      parametersMap.set(param.id, param);
      updateDomainIndex(param, known);
    }
    
    schedulePublish();
  }

  function upsertParameters(batch: Parameter[]) {
    for (const param of batch) {
      const existing = parametersMap.get(param.id);
      let known = existing !== undefined;
      if (existing && (existing.domain !== param.domain || endpointKeyOf(existing) !== endpointKeyOf(param))) {
        removeDomainIndex(existing);
        known = false;
      }

      parametersMap.set(param.id, param);
      updateDomainIndex(param, known);
    }
    
    schedulePublish();
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
    resetTree();
    treeRef.value = [];
    publishPending = false;
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

  // Domains sorted by name, endpoints by path and method, parameters in
  // first-seen order. Untouched domains keep their TreeNode objects across
  // publishes, and a publish that touched no domain keeps the same array.
  const tree = computed(() => treeRef.value);

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
