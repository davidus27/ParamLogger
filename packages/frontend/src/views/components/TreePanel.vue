<template>
  <div class="tree-toolbar">
    <input 
      class="tree-search" 
      v-model="treeFilter" 
      placeholder="Filter tree..."
      @input="buildTree"
    />
    <button 
      class="btn btn-sm btn-ghost" 
      title="Collapse all" 
      @click="collapseAll"
    >
      &#x25B3;
    </button>
    <button 
      class="btn btn-sm btn-ghost" 
      title="Expand all" 
      @click="expandAll"
    >
      &#x25BD;
    </button>
  </div>
  
  <div v-html="treeHtml"></div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useInventory } from '../../composables/useInventory';
import type { Domain, Parameter } from '@param-inventory/shared';

const { domains, parameters, filters, toggleDomainFilter, updateFilters, stats } = useInventory();
const treeFilter = ref('');
const selectedScope = ref<{ domain?: string; ep?: string; method?: string } | null>(null);

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

const treeHtml = computed(() => {
  const map = domainMap.value;
  const filter = treeFilter.value.toLowerCase();
  let html = '';

  // "All" node
  const totalParams = stats.totalParams || parameters.value.length;
  const allSelected = !selectedScope.value;
  html += `<div class="tree-node">
    <div class="tree-row ${allSelected ? 'selected' : ''}" onclick="window.selectScope(null)">
      <span class="arrow hidden">&#x25B6;</span>
      <span class="icon">&#x25C9;</span>
      <span class="label" style="font-weight:600">All targets</span>
      <span class="count">${totalParams}</span>
    </div>
  </div>`;

  Object.keys(map).sort().forEach(domainName => {
    if (filter && !domainName.includes(filter) && !Object.keys(map[domainName]).some(k => k.toLowerCase().includes(filter))) return;
    
    const endpoints = map[domainName];
    const epKeys = Object.keys(endpoints).sort();
    const domainParamCount = epKeys.reduce((s, k) => s + endpoints[k].count, 0);
    const domainSelected = selectedScope.value && selectedScope.value.domain === domainName && !selectedScope.value.ep;
    const isOpen = selectedScope.value && selectedScope.value.domain === domainName;

    html += `<div class="tree-node">
      <div class="tree-row tree-domain ${domainSelected ? 'selected' : ''}" onclick="window.toggleTreeNode('${domainName}')" data-domain="${domainName}">
        <span class="arrow ${isOpen ? 'open' : ''}">&#x25B6;</span>
        <span class="icon">&#x25CB;</span>
        <span class="label">${domainName}</span>
        <span class="count">${domainParamCount}</span>
      </div>
      <div class="tree-children ${isOpen ? 'open' : ''}">`;

    epKeys.forEach(k => {
      const e = endpoints[k];
      if (filter && !k.toLowerCase().includes(filter) && !domainName.includes(filter)) return;
      const epSelected = selectedScope.value && 
                        selectedScope.value.domain === domainName && 
                        selectedScope.value.ep === e.ep && 
                        selectedScope.value.method === e.method;
      html += `<div class="tree-row tree-endpoint ${epSelected ? 'selected' : ''}" style="padding-left:28px"
        onclick="event.stopPropagation(); window.selectScope('${domainName}', '${e.ep}', '${e.method}')">
        <span class="arrow hidden">&#x25B6;</span>
        <span class="method-badge m-${e.method}">${e.method}</span>
        <span class="label">${e.ep}</span>
        <span class="count">${e.count}</span>
      </div>`;
    });

    html += `</div></div>`;
  });

  // Empty state
  if (Object.keys(map).length === 0) {
    html += `<div class="tree-empty">
      <p style="color: var(--text-muted); text-align: center; padding: 20px;">
        No domains found.<br>
        Start intercepting traffic to populate the tree.
      </p>
    </div>`;
  }

  return html;
});

function buildTree() {
  // Tree is reactive via computed property
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

function toggleTreeNode(domain: string) {
  selectScope(domain);
}

function collapseAll() {
  const children = document.querySelectorAll('.tree-children');
  const arrows = document.querySelectorAll('.tree-row .arrow');
  children.forEach(c => c.classList.remove('open'));
  arrows.forEach(a => a.classList.remove('open'));
}

function expandAll() {
  const children = document.querySelectorAll('.tree-children');
  const arrows = document.querySelectorAll('.tree-row .arrow:not(.hidden)');
  children.forEach(c => c.classList.add('open'));
  arrows.forEach(a => a.classList.add('open'));
}

// Expose functions to global scope for onclick handlers
onMounted(() => {
  (window as any).selectScope = selectScope;
  (window as any).toggleTreeNode = toggleTreeNode;
});

onUnmounted(() => {
  // Clean up global handlers
  delete (window as any).selectScope;
  delete (window as any).toggleTreeNode;
});
</script>