<template>
  <header class="inv-header">
    <button class="inv-btn inv-btn-ghost inv-sidebar-toggle" @click="$emit('update:sidebarOpen', !sidebarOpen)">☰</button>
    <span class="inv-logo">◆ Param Logger</span>
    <span class="inv-sep"></span>
    <div class="inv-search">
      <span class="inv-search-icon">⌕</span>
      <input
        ref="searchInput"
        :value="searchQuery"
        type="text"
        placeholder="Search params, endpoints, domains…"
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
      <kbd>/</kbd>
    </div>
    <span class="inv-result-count">{{ resultCountLabel }}</span>
    <div class="inv-header-actions">
      <button
        class="inv-btn"
        :disabled="isRescanning"
        title="Clear the inventory and rescan the current project from scratch"
        @click="$emit('rescan')"
      >{{ isRescanning ? '… Rescan' : '↻ Rescan' }}</button>
      <span
        class="inv-project-pill"
        :title="currentProject.projectId ? `Project: ${currentProject.projectName ?? currentProject.projectId}` : 'No active Caido project'"
      >▤ {{ currentProject.projectName || (currentProject.projectId ? '…' : 'No project') }}</span>
      <span class="inv-scope-pill">{{ currentScope?.name || 'All scopes' }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ProjectInfo } from '@param-logger/shared';

interface Scope {
  name: string;
}

const props = defineProps<{
  searchQuery: string;
  resultCountLabel: string;
  isRescanning: boolean;
  currentProject: ProjectInfo;
  currentScope: Scope | undefined;
  sidebarOpen: boolean;
}>();

defineEmits<{
  'update:searchQuery': [value: string];
  'update:sidebarOpen': [value: boolean];
  rescan: [];
}>();

const searchInput = ref<HTMLInputElement | null>(null);

defineExpose({ searchInput });
</script>
