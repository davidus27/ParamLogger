<template>
  <div class="flex items-center justify-between w-full px-4 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900">
    <div class="flex items-center gap-4">
      <span class="text-lg font-semibold text-primary">&#9670; Param Inventory</span>
      
      <div class="flex items-center gap-2 px-3 py-1 bg-surface-50 dark:bg-surface-800 rounded-md">
        <i class="pi pi-search text-muted-color"></i>
        <InputText 
          ref="searchInput"
          v-model="searchValue"
          placeholder="Search params, endpoints, domains..."
          class="!border-0 !bg-transparent !p-0 focus:!shadow-none"
          @input="onSearchChange"
        />
        <kbd class="text-xs px-1 py-0.5 bg-surface-200 dark:bg-surface-600 rounded text-muted-color">/</kbd>
      </div>
      
      <span class="text-sm text-muted-color">{{ resultCount }}</span>
    </div>
    
    <div class="flex items-center gap-2">
      <Button 
        icon="pi pi-question-circle" 
        variant="text" 
        size="small"
        @click="$emit('show-help')" 
        v-tooltip="'Keyboard shortcuts (?)'"
      />
      <Button 
        icon="pi pi-cog" 
        variant="text" 
        size="small"
        @click="$emit('show-settings')" 
        v-tooltip="'Settings (Ctrl+,)'"
      />
      <Button 
        icon="pi pi-download" 
        label="Wordlist"
        size="small"
        @click="exportWordlist"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import { useInventory } from '../../composables/useInventory';
import { useBackend } from '../../composables/useBackend';

const searchInput = ref<InstanceType<typeof InputText>>();
const searchValue = ref('');
const { filters, parameters, filteredStats, setSearch } = useInventory();
const { exportWordlist: exportWordlistFromBackend } = useBackend();

// Sync search value with filters
searchValue.value = filters.search;

const emit = defineEmits<{
  'show-toast': [message: string, type?: 'success' | 'error' | 'info'];
  'show-help': [];
  'show-settings': [];
}>();

const resultCount = computed(() => {
  const count = parameters.value.length;
  const stats = filteredStats.value;
  
  if (stats.filteredDomains !== undefined) {
    return `${count} parameter${count !== 1 ? 's' : ''} across ${stats.filteredDomains} domain${stats.filteredDomains !== 1 ? 's' : ''}`;
  }
  
  return `${count} parameter${count !== 1 ? 's' : ''}`;
});

function onSearchChange() {
  setSearch(searchValue.value);
}

async function exportWordlist() {
  try {
    // Use backend method to get wordlist based on current filters
    const wordlist = await exportWordlistFromBackend(filters);
    const text = wordlist.join('\n');
    
    await navigator.clipboard.writeText(text);
    emit('show-toast', `Exported ${wordlist.length} unique parameters to clipboard`, 'success');
  } catch (error) {
    console.error('Failed to export wordlist:', error);
    
    // Fallback: use client-side filtering
    const uniqueNames = [...new Set(parameters.value.map(p => p.name))];
    const text = uniqueNames.join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      emit('show-toast', `Exported ${uniqueNames.length} parameters to clipboard (fallback)`, 'success');
    } catch (clipboardError) {
      console.warn('Failed to copy to clipboard:', clipboardError);
      emit('show-toast', 'Failed to copy to clipboard', 'error');
    }
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault();
    searchInput.value?.$el?.focus();
  }
  
  if (e.key === 'Escape' && document.activeElement === searchInput.value?.$el) {
    searchInput.value?.$el?.blur();
    searchValue.value = '';
    setSearch('');
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown);
});
</script>