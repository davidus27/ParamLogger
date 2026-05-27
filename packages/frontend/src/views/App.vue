<template>
  <div id="param-logger-root" class="inv-app" :class="{ 'sidebar-open': sidebarOpen }">
    <AppHeader
      v-model:searchQuery="searchQuery"
      v-model:sidebarOpen="sidebarOpen"
      :resultCountLabel="resultCountLabel"
      :isRescanning="isRescanning"
      :currentProject="currentProject"
      :currentScope="currentScope"
      ref="appHeader"
      @rescan="triggerRescan"
    />

    <TreePanel
      v-model:treeFilter="treeFilter"
      :tree="filteredTree"
      :selectedScope="selectedScope"
      :openDomains="openDomains"
      :sidebarOpen="sidebarOpen"
      :scopedParameterCount="scopedParameterCount"
      @select-scope="selectScope"
      @toggle-domain="toggleDomain"
      @collapse-all="collapseAll"
      @expand-all="expandAll"
    />

    <main class="inv-main">
      <FilterBar
        v-model:activeLoc="activeLoc"
        :activeFlags="activeFlags"
        :activeValueTypes="activeValueTypes"
        @toggle-flag="toggleFlag"
        @toggle-value-type="toggleValueType"
      />

      <div class="inv-table-wrap">
        <ParameterTable
          v-if="filteredParameters.length"
          :parameters="filteredParameters"
          :selectedParam="selectedParam"
          :rowNumWidth="rowNumWidth"
          @row-click="openDrawer"
        />
        <EmptyState
          v-else
          :isLoading="isLoading"
          :currentScope="currentScope"
          :hasScopedParams="scopedParameterCount > 0"
        />
      </div>
    </main>

    <StatusBar
      :isConnected="isConnected"
      :scopedParameterCount="scopedParameterCount"
      @open-help="openHelp"
    />

    <ParameterDrawer
      :parameter="selectedParam"
      :isSendingToReplay="isSendingToReplay"
      @close="closeDrawer"
      @open-in-search="openInSearch"
      @send-to-replay="sendToReplay"
      @copy="copyText"
    />

    <HelpModal
      v-model:open="showHelp"
      v-model:page="helpPage"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue';
import type { Caido } from '@caido/sdk-frontend';
import type { HTTPQL } from '@caido/sdk-frontend';
import type {
  InventoryBackendAPI,
  InventoryBackendEvents,
  Parameter,
} from '@param-logger/shared';
import { useInventory } from '../composables/useInventory';
import { useBackend } from '../composables/useBackend';
import { useScope } from '../composables/useScope';
import { useProject } from '../composables/useProject';
import { useFilters } from '../composables/useFilters';
import { useSelection } from '../composables/useSelection';
import { useHelp } from '../composables/useHelp';
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts';
import { buildHttpQLForParameter } from '../utils/httpql';
import AppHeader from '../components/AppHeader.vue';
import TreePanel from '../components/TreePanel.vue';
import FilterBar from '../components/FilterBar.vue';
import ParameterTable from '../components/ParameterTable.vue';
import EmptyState from '../components/EmptyState.vue';
import StatusBar from '../components/StatusBar.vue';
import ParameterDrawer from '../components/ParameterDrawer.vue';
import HelpModal from '../components/HelpModal.vue';

const caido = inject<Caido<InventoryBackendAPI, InventoryBackendEvents>>('caido');
const { parameters, isLoading, setLoading, tree } = useInventory();
const { init: initBackend, connectionStatus, refreshInventory, resetAndRescan } = useBackend();
const { currentScope, init: initScope, isHostInScope, cleanup: cleanupScope, getCurrentScope, explain, refresh: refreshScope } = useScope();
const { currentProject, init: initProject, cleanup: cleanupProject } = useProject();

const isConnected = computed(() => connectionStatus.isConnected);

// ───── Help modal ─────
const { showHelp, helpPage, openHelp, closeHelp } = useHelp();

// ───── Selection ─────
const {
  selectedScope,
  selectedParam,
  openDomains,
  selectScope,
  toggleDomain,
  collapseAll,
  expandAll,
  openDrawer,
  closeDrawer,
} = useSelection({
  getFilteredTree: () => filteredTree.value,
});

// ───── Filters ─────
const {
  searchQuery,
  treeFilter,
  activeLoc,
  activeFlags,
  activeValueTypes,
  filteredParameters,
  filteredTree,
  scopedParameters,
  scopedParameterCount,
  resultCountLabel,
  rowNumWidth,
  toggleFlag,
  toggleValueType,
  resetFilters,
} = useFilters(
  computed(() => parameters.value),
  tree,
  isHostInScope,
  selectedScope,
);

const appHeader = ref<InstanceType<typeof AppHeader> | null>(null);
const searchInput = computed(() => appHeader.value?.searchInput ?? null);
const sidebarOpen = ref(false);

// ───── Keyboard shortcuts ─────
useKeyboardShortcuts({ searchInput, showHelp, openHelp, closeHelp, closeDrawer });

// ───── Watchers ─────
// When the Caido project changes, drop any selection / filter state that
// references items from the previous project. The actual inventory reload
// (clearing the cache + refetching) is handled by `useBackend` in response
// to the backend's `project-changed` event, so we don't trigger it here.
watch(
  () => currentProject.value.projectId,
  (newId, oldId) => {
    if (newId === oldId) return;
    selectScope(null);
    closeDrawer();
    resetFilters();
    collapseAll();
    console.info('[Param Logger] project changed, cleared UI selection', {
      from: oldId ?? null,
      to: newId ?? null,
    });
  },
);

// When the Caido scope changes, narrow the view to the new scope and pull
// fresh data from the backend so results always reflect the active scope.
watch(currentScope, async (newScope, oldScope) => {
  // Clear stale UI state that may reference out-of-scope items.
  selectScope(null);
  closeDrawer();

  // Reset narrowing filters so the user immediately sees the full in-scope
  // set rather than a possibly-empty intersection with the previous filters.
  resetFilters();

  console.info('[Param Logger] scope changed, refreshing results', {
    from: oldScope?.name ?? null,
    to: newScope?.name ?? null,
  });

  // Always refetch from backend so the visible list reflects the latest data
  // under the new scope (also covers cases where parameters arrived while a
  // different scope was active).
  if (caido) {
    try {
      setLoading(true);
      await refreshInventory();
    } catch (error) {
      console.warn('[Param Logger] Failed to refresh inventory after scope change:', error);
    } finally {
      setLoading(false);
    }
  }

  console.info('[Param Logger] scope filter result', {
    scope: newScope,
    scoped: scopedParameterCount.value,
    total: parameters.value.length,
  });
});

// ───── Actions ─────
function copyText(txt: string): void {
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(txt);
  }
}

const isRescanning = ref(false);

async function triggerRescan(): Promise<void> {
  if (isRescanning.value) return;
  isRescanning.value = true;
  try {
    closeDrawer();
    refreshScope('rescan');
    await resetAndRescan();
  } catch (error) {
    console.error('[Param Inventory] Failed to trigger rescan:', error);
  } finally {
    isRescanning.value = false;
  }
}

function openInSearch(p: Parameter): void {
  const query = buildHttpQLForParameter(p);
  try {
    caido?.search?.setQuery?.(query as HTTPQL);
    caido?.navigation?.goTo?.({ id: 'Search' });
  } catch (error) {
    console.error('Failed to open Search with query:', query, error);
  }
}

// ───── Send to Replay ─────
const isSendingToReplay = ref(false);

async function sendToReplay(p: Parameter): Promise<void> {
  if (isSendingToReplay.value || !caido) return;
  isSendingToReplay.value = true;
  try {
    const ids: string[] = await caido.backend.getRequestIdsForParam(p.id);
    if (!ids || ids.length === 0) {
      // Fall back to Search so the user can pick a request manually
      openInSearch(p);
      return;
    }
    const requestId = ids[0];
    await caido.replay.createSession({ type: 'ID', id: requestId });
    caido.navigation.goTo('Replay');
  } catch (error) {
    console.error('[Param Logger] sendToReplay failed:', error);
    // Graceful fallback
    openInSearch(p);
  } finally {
    isSendingToReplay.value = false;
  }
}

onMounted(async () => {
  // Expose debug helpers globally (always on, not just in dev mode)
  (window as any).__paramInventoryDebug = {
    getCurrentScope,
    scopedParameters,
    explain,
    getCurrentProject: () => currentProject.value,
    refreshScope: () => refreshScope('debug-helper'),
  };

  // Expose for testing in development mode
  const isDev = (import.meta as any).env?.DEV;
  if (isDev) {
    // Import the simulation function dynamically to avoid bundling in production
    import('../mock-caido-sdk').then(({ simulateScopeChange, simulateProjectChange }) => {
      (window as any).vueApp = {
        tree: filteredTree,
        parameters,
        currentScope,
        currentProject,
        upsertTest: () => {
          // Test upsert functionality
          console.log('🧪 Testing upsert functionality...');
          const { upsertParameters } = useInventory();
          upsertParameters([
            {
              id: 'test-upsert-1',
              domain: 'test-upsert.com',
              method: 'GET',
              normalizedPath: '/test',
              location: 'query' as any,
              name: 'test_param',
              valueTypes: ['string' as any],
              flags: ['new' as any],
              count: 1,
              firstSeen: new Date(),
              lastSeen: new Date()
            }
          ]);
          console.log('✅ Upsert test completed');
        },
        simulateScopeChange: (scopeId?: string) => {
          console.log('🧪 Testing scope change to:', scopeId || 'no scope');
          simulateScopeChange(scopeId);
          console.log('✅ Scope change simulation completed');
        },
        simulateProjectChange: (projectId?: string) => {
          console.log('🧪 Testing project change to:', projectId || 'no project');
          simulateProjectChange(projectId);
          console.log('✅ Project change simulation completed');
        }
      };
    });
  }

  try {
    setLoading(true);
    if (caido) {
      initBackend(caido);
      initScope(caido);
      void initProject(caido);
    } else {
      console.warn('No Caido SDK provided, running in development mode');
    }
  } catch (error) {
    console.error('Error during app initialization:', error);
  } finally {
    setLoading(false);
  }
});

onUnmounted(() => {
  cleanupScope();
  cleanupProject();
});
</script>
