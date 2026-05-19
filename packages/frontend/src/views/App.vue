<template>
  <div class="app">
    <!-- Header with search and actions -->
    <div class="header">
      <SearchHeader 
        @show-toast="showToast"
        @show-help="helpDialog?.open()"
        @show-settings="settingsDialog?.open()"
      />
    </div>
    
    <!-- Tree Panel (left) -->
    <div class="tree-panel">
      <TreePanel />
    </div>
    
    <!-- Main Panel (right) -->
    <div class="main-panel">
      <FilterBar />
      <div class="table-wrap">
        <ParamTable 
          @open-drawer="openDrawer" 
          @show-toast="showToast"
        />
      </div>
    </div>
    
    <!-- Footer with status -->
    <div class="statusbar">
      <StatusBar />
    </div>
    
    <!-- Detail drawer (overlay) -->
    <DetailDrawer ref="detailDrawer" @show-toast="showToast" />
    
    <!-- Help dialog -->
    <HelpDialog ref="helpDialog" />
    
    <!-- Settings dialog -->
    <SettingsDialog 
      ref="settingsDialog" 
      :settings="settings" 
      @save="onSettingsSaved"
    />
    
    <!-- Toast notifications -->
    <ToastNotification ref="toastNotification" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject, computed } from 'vue';
import type { Caido } from '../mock-caido-sdk';
import SearchHeader from './components/SearchHeader.vue';
import TreePanel from './components/TreePanel.vue';
import FilterBar from './components/FilterBar.vue';
import ParamTable from './components/ParamTable.vue';
import DetailDrawer from './components/DetailDrawer.vue';
import StatusBar from './components/StatusBar.vue';
import HelpDialog from './components/HelpDialog.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import ToastNotification from './components/ToastNotification.vue';
import { useInventory } from '../composables/useInventory';
import { useBackend } from '../composables/useBackend';
import { useKeyboardShortcuts, globalShortcuts } from '../composables/useKeyboardShortcuts';
import { useSettings } from '../composables/useSettings';
import type { Parameter, FrontendSettings } from '@param-inventory/shared';

const caido = inject<Caido>('caido');
const { 
  setSelectedParameter, 
  setLoading, 
  updateStats, 
  filters, 
  setSearch,
  clearFilters,
  toggleInteresting,
  toggleNew
} = useInventory();
const { 
  init: initBackend, 
  connectionStatus, 
  loadInitialData,
  refreshInventory,
  exportWordlist
} = useBackend();
const { registerShortcut } = useKeyboardShortcuts();
const { 
  settings, 
  isLoaded: settingsLoaded,
  saveSettings 
} = useSettings(caido);

// Component refs
const detailDrawer = ref<InstanceType<typeof DetailDrawer>>();
const helpDialog = ref<InstanceType<typeof HelpDialog>>();
const settingsDialog = ref<InstanceType<typeof SettingsDialog>>();
const toastNotification = ref<InstanceType<typeof ToastNotification>>();

// Reactive connection state
const isConnected = computed(() => connectionStatus.isConnected);
const isScanning = computed(() => connectionStatus.isScanning);

function openDrawer(parameter: Parameter) {
  setSelectedParameter(parameter);
  detailDrawer.value?.open(parameter);
}

function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  toastNotification.value?.showToast(message, type);
}

function onSettingsSaved(newSettings: FrontendSettings) {
  showToast('Settings saved successfully', 'success');
  // Apply settings immediately where possible
  applySettings(newSettings);
}

function applySettings(newSettings: FrontendSettings) {
  // Apply layout changes
  const app = document.querySelector('.app') as HTMLElement;
  if (app) {
    app.style.setProperty('--tree-panel-width', `${newSettings.treePanelWidth}px`);
    app.style.setProperty('--drawer-width', `${newSettings.drawerWidth}px`);
  }
}

function setupKeyboardShortcuts() {
  // Global search focus
  registerShortcut({
    ...globalShortcuts.SEARCH_FOCUS,
    handler: () => {
      const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });
  
  // Escape key handling
  registerShortcut({
    ...globalShortcuts.ESCAPE,
    handler: () => {
      // Close help dialog first
      if (helpDialog.value) {
        helpDialog.value.close();
        return;
      }
      
      // Close detail drawer
      if (detailDrawer.value) {
        detailDrawer.value.close();
      }
      
      // Clear search
      setSearch('');
    }
  });
  
  // Help dialog
  registerShortcut({
    ...globalShortcuts.HELP,
    handler: () => {
      helpDialog.value?.open();
    }
  });
  
  // Export wordlist
  registerShortcut({
    ...globalShortcuts.EXPORT_WORDLIST,
    handler: async () => {
      try {
        const wordlist = await exportWordlist(filters.value);
        const text = wordlist.join('\n');
        await navigator.clipboard.writeText(text);
        showToast(`Exported ${wordlist.length} unique parameters to clipboard`, 'success');
      } catch (error) {
        showToast('Failed to export wordlist', 'error');
        console.error('Export error:', error);
      }
    }
  });
  
  // Refresh inventory
  registerShortcut({
    ...globalShortcuts.REFRESH,
    handler: async () => {
      try {
        await refreshInventory();
        showToast('Inventory refreshed', 'success');
      } catch (error) {
        showToast('Failed to refresh inventory', 'error');
        console.error('Refresh error:', error);
      }
    }
  });
  
  // Clear filters
  registerShortcut({
    ...globalShortcuts.CLEAR_FILTERS,
    handler: () => {
      clearFilters();
      showToast('Filters cleared', 'info');
    }
  });
  
  // Toggle interesting filter
  registerShortcut({
    ...globalShortcuts.TOGGLE_INTERESTING,
    handler: () => {
      const newState = toggleInteresting();
      showToast(`Interesting filter ${newState ? 'enabled' : 'disabled'}`, 'info');
    },
    condition: () => document.activeElement?.tagName !== 'INPUT'
  });
  
  // Toggle new filter
  registerShortcut({
    ...globalShortcuts.TOGGLE_NEW,
    handler: () => {
      const newState = toggleNew();
      showToast(`New parameters filter ${newState ? 'enabled' : 'disabled'}`, 'info');
    },
    condition: () => document.activeElement?.tagName !== 'INPUT'
  });
  
  // Settings dialog
  registerShortcut({
    ...globalShortcuts.SETTINGS,
    handler: () => {
      settingsDialog.value?.open();
    }
  });
}

// Initialize the plugin
onMounted(async () => {
  console.log('App mounted, initializing plugin...');
  
  try {
    setLoading(true);
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    if (caido) {
      // Initialize backend communication
      initBackend(caido);
      
      // Load initial data (this will be called automatically by useBackend.init())
      // but we can also call it explicitly for more control
      console.log('Loading initial data...');
    } else {
      console.warn('No Caido SDK provided, running in development mode with mock data');
      
      // Set mock stats for development
      updateStats({
        totalRequests: 1284,
        totalParams: 147,
        uniqueParams: 123,
        domains: 5,
        endpoints: 28
      });
      
      // Show welcome message in development mode
      setTimeout(() => {
        showToast('Running in development mode', 'info');
      }, 1000);
    }
  } catch (error) {
    console.error('Error during app initialization:', error);
    showToast('Failed to initialize plugin', 'error');
  } finally {
    setLoading(false);
  }
});

// Cleanup on unmount
onUnmounted(() => {
  console.log('App unmounting...');
  setSelectedParameter(null);
});

// Provide global error handling for the app
window.addEventListener('error', (event) => {
  console.error('Global error in Parameter Inventory plugin:', event.error);
  showToast('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in Parameter Inventory plugin:', event.reason);
  showToast('An unexpected error occurred', 'error');
});
</script>