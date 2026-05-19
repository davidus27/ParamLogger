<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center gap-2 p-3 border-b border-surface-200 dark:border-surface-700">
      <InputText 
        v-model="treeFilter" 
        placeholder="Filter tree..."
        class="flex-1 text-sm"
        @input="buildTree"
      />
      <Button 
        icon="pi pi-angle-up"
        variant="text" 
        size="small"
        v-tooltip="'Collapse all'"
        @click="collapseAll"
      />
      <Button 
        icon="pi pi-angle-down"
        variant="text" 
        size="small"
        v-tooltip="'Expand all'"
        @click="expandAll"
      />
    </div>
    
    <div class="flex-1 overflow-auto">
      <Tree 
        :value="treeNodes"
        selectionMode="single"
        v-model:selectionKeys="selectedKeys"
        @nodeSelect="onNodeSelect"
        @nodeExpand="onNodeExpand"
        @nodeCollapse="onNodeCollapse"
        class="text-sm"
      >
        <template #default="{ node }">
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-2">
              <i :class="node.icon" class="text-xs"></i>
              <span class="text-sm">{{ node.label }}</span>
              <Tag 
                v-if="node.data?.method" 
                :value="node.data.method" 
                :class="getMethodTagClass(node.data.method)"
                class="text-xs"
              />
            </div>
            <span class="text-xs text-muted-color">{{ node.data?.count || '' }}</span>
          </div>
        </template>
      </Tree>
      
      <!-- Empty state -->
      <div v-if="treeNodes.length === 0" class="flex items-center justify-center h-full p-4">
        <div class="text-center text-muted-color">
          <i class="pi pi-sitemap text-2xl mb-2"></i>
          <p>No domains found.</p>
          <p class="text-xs">Start intercepting traffic to populate the tree.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Tree from 'primevue/tree';
import Tag from 'primevue/tag';
import { useInventory } from '../../composables/useInventory';
import type { Domain, Parameter } from '@param-inventory/shared';

interface TreeNode {
  key: string;
  label: string;
  icon: string;
  children?: TreeNode[];
  data?: {
    type: 'all' | 'domain' | 'endpoint';
    domain?: string;
    endpoint?: string;
    method?: string;
    count?: number;
  };
}

const { domains, parameters, filters, toggleDomainFilter, updateFilters, stats } = useInventory();
const treeFilter = ref('');
const selectedScope = ref<{ domain?: string; ep?: string; method?: string } | null>(null);
const selectedKeys = ref<Record<string, boolean>>({});
const expandedKeys = ref<Record<string, boolean>>({});

// Build domain/endpoint map for tree based on actual data
const domainMap = computed(() => {
  const map: Record<string, Record<string, { method: string; ep: string; count: number }>> = {};
  
  // If we have domains data, use it
  if (domains.value.length > 0) {
    domains.value.forEach(domain => {
      if (!map[domain.name]) map[domain.name] = {};
      
      domain.endpoints.forEach(endpoint => {
        const key = endpoint.method + ' ' + endpoint.normalizedPath;
        map[domain.name][key] = {
          method: endpoint.method,
          ep: endpoint.normalizedPath,
          count: endpoint.parameters.length
        };
      });
    });
  } else {
    // Fallback: build from parameters if domains not available
    parameters.value.forEach(param => {
      if (!map[param.domain]) map[param.domain] = {};
      
      const key = param.method + ' ' + param.normalizedPath;
      if (!map[param.domain][key]) {
        map[param.domain][key] = {
          method: param.method,
          ep: param.normalizedPath,
          count: 0
        };
      }
      map[param.domain][key].count++;
    });
  }
  
  return map;
});

const treeNodes = computed((): TreeNode[] => {
  const map = domainMap.value;
  const filter = treeFilter.value.toLowerCase();
  const nodes: TreeNode[] = [];

  // "All" node
  const totalParams = stats.totalParams || parameters.value.length;
  nodes.push({
    key: 'all',
    label: 'All targets',
    icon: 'pi pi-globe',
    data: { type: 'all', count: totalParams }
  });

  Object.keys(map).sort().forEach(domainName => {
    if (filter && !domainName.includes(filter) && !Object.keys(map[domainName]).some(k => k.toLowerCase().includes(filter))) return;
    
    const endpoints = map[domainName];
    const epKeys = Object.keys(endpoints).sort();
    const domainParamCount = epKeys.reduce((s, k) => s + endpoints[k].count, 0);
    
    const children: TreeNode[] = [];
    epKeys.forEach(k => {
      const e = endpoints[k];
      if (filter && !k.toLowerCase().includes(filter) && !domainName.includes(filter)) return;
      
      children.push({
        key: `${domainName}-${e.ep}-${e.method}`,
        label: e.ep,
        icon: 'pi pi-file',
        data: { 
          type: 'endpoint', 
          domain: domainName, 
          endpoint: e.ep, 
          method: e.method, 
          count: e.count 
        }
      });
    });

    nodes.push({
      key: domainName,
      label: domainName,
      icon: 'pi pi-server',
      children,
      data: { type: 'domain', domain: domainName, count: domainParamCount }
    });
  });

  return nodes;
});

function buildTree() {
  // Tree is reactive via computed property
}

function getMethodTagClass(method: string): string {
  const classes = {
    GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    PATCH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    OPTIONS: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    HEAD: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'
  };
  return classes[method as keyof typeof classes] || 'bg-surface-100 text-surface-800 dark:bg-surface-700 dark:text-surface-300';
}

function selectScope(domain?: string, ep?: string, method?: string) {
  if (!domain) {
    selectedScope.value = null;
    updateFilters({ domains: [] });
  } else if (!ep) {
    selectedScope.value = { domain };
    updateFilters({ domains: [domain] });
  } else {
    selectedScope.value = { domain, ep, method };
    // For endpoint selection, could filter to specific endpoint
    // For now, just filter by domain
    updateFilters({ domains: [domain] });
  }
}

function onNodeSelect(node: any) {
  const data = node.data;
  if (data.type === 'all') {
    selectScope();
    selectedKeys.value = { all: true };
  } else if (data.type === 'domain') {
    selectScope(data.domain);
    selectedKeys.value = { [node.key]: true };
  } else if (data.type === 'endpoint') {
    selectScope(data.domain, data.endpoint, data.method);
    selectedKeys.value = { [node.key]: true };
  }
}

function onNodeExpand(node: any) {
  expandedKeys.value[node.key] = true;
}

function onNodeCollapse(node: any) {
  delete expandedKeys.value[node.key];
}

function collapseAll() {
  expandedKeys.value = {};
}

function expandAll() {
  const keys: Record<string, boolean> = {};
  const addKeys = (nodes: TreeNode[]) => {
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        keys[node.key] = true;
        addKeys(node.children);
      }
    });
  };
  addKeys(treeNodes.value);
  expandedKeys.value = keys;
}

// Set initial selection
onMounted(() => {
  if (!selectedScope.value) {
    selectedKeys.value = { all: true };
  }
});

onUnmounted(() => {
  // Cleanup if needed
});
</script>