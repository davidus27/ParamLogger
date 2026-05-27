<template>
  <aside class="inv-tree-panel" :class="{ 'sidebar-open': sidebarOpen }">
    <div class="inv-tree-toolbar">
      <input
        :value="treeFilter"
        class="inv-tree-search"
        placeholder="Filter tree…"
        @input="$emit('update:treeFilter', ($event.target as HTMLInputElement).value)"
      />
      <button class="inv-btn inv-btn-ghost" title="Collapse all" @click="$emit('collapse-all')">△</button>
      <button class="inv-btn inv-btn-ghost" title="Expand all" @click="$emit('expand-all')">▽</button>
    </div>

    <div class="inv-tree">
      <div
        class="inv-tree-row"
        :class="{ selected: !selectedScope }"
        @click="$emit('select-scope', null)"
      >
        <span class="inv-tree-arrow hidden">▶</span>
        <span class="inv-tree-icon">◉</span>
        <span class="inv-tree-label all">All targets</span>
        <span class="inv-tree-count">{{ scopedParameterCount }}</span>
      </div>

      <template v-for="domain in tree" :key="domain.name">
        <div
          class="inv-tree-row tree-domain"
          :class="{ selected: isDomainSelected(domain.name) }"
          @click="$emit('toggle-domain', domain.name)"
        >
          <span class="inv-tree-arrow" :class="{ open: openDomains.has(domain.name) }">▶</span>
          <span class="inv-tree-icon">○</span>
          <span class="inv-tree-label">{{ domain.name }}</span>
          <span class="inv-tree-count">{{ domain.paramCount }}</span>
        </div>

        <div v-if="openDomains.has(domain.name)" class="inv-tree-children">
          <div
            v-for="ep in domain.endpoints"
            :key="ep.method + ep.path"
            class="inv-tree-row tree-endpoint"
            :class="{ selected: isEndpointSelected(domain.name, ep.method, ep.path) }"
            @click.stop="$emit('select-scope', { domain: domain.name, method: ep.method, path: ep.path })"
          >
            <span class="inv-tree-arrow hidden">▶</span>
            <span class="method-badge" :class="`m-${ep.method}`">{{ ep.method }}</span>
            <span class="inv-tree-label endpoint">{{ ep.path }}</span>
            <span class="inv-tree-count">{{ ep.params.length }}</span>
          </div>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Parameter } from '@param-logger/shared';
import type { ScopeSelection } from '../composables/useSelection';

interface TreeEndpoint {
  method: string;
  path: string;
  params: Parameter[];
}

interface TreeNode {
  name: string;
  paramCount: number;
  endpoints: TreeEndpoint[];
}

const props = defineProps<{
  tree: TreeNode[];
  treeFilter: string;
  selectedScope: ScopeSelection;
  openDomains: Set<string>;
  sidebarOpen: boolean;
  scopedParameterCount: number;
}>();

defineEmits<{
  'update:treeFilter': [value: string];
  'select-scope': [scope: ScopeSelection];
  'toggle-domain': [domain: string];
  'collapse-all': [];
  'expand-all': [];
}>();

function isDomainSelected(domain: string): boolean {
  return !!props.selectedScope && props.selectedScope.domain === domain && !props.selectedScope.path;
}

function isEndpointSelected(domain: string, method: string, path: string): boolean {
  return (
    !!props.selectedScope &&
    props.selectedScope.domain === domain &&
    props.selectedScope.method === method &&
    props.selectedScope.path === path
  );
}
</script>
