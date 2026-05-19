<template>
  <span class="logo">&#9670; Param Inventory</span>
  <span class="sep"></span>
  <div class="search-global">
    <span style="color: var(--text-muted)">&#x1F50D;</span>
    <input 
      ref="searchInput"
      type="text" 
      placeholder="Search params, endpoints, domains..."
      :value="filters.search"
      @input="onSearchChange"
    />
    <kbd>/</kbd>
  </div>
  <span class="header-count">{{ resultCount }}</span>
  <div class="header-actions">
    <button class="btn" @click="$emit('show-help')" title="Keyboard shortcuts (?)">
      <i class="pi pi-question-circle"></i>
    </button>
    <button class="btn" @click="$emit('show-settings')" title="Settings (Ctrl+,)">
      <i class="pi pi-cog"></i>
    </button>
    <button class="btn btn-accent" @click="exportWordlist">
      <i class="pi pi-download"></i> Wordlist
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useInventory } from '../../composables/useInventory';
import { useBackend } from '../../composables/useBackend';

const searchInput = ref<HTMLInputElement>();
const { filters, parameters, filteredStats, setSearch } = useInventory();
const { exportWordlist: exportWordlistFromBackend } = useBackend();

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

function onSearchChange(event: Event) {
  const target = event.target as HTMLInputElement;
  setSearch(target.value);
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
    searchInput.value?.focus();
  }
  
  if (e.key === 'Escape' && document.activeElement === searchInput.value) {
    searchInput.value?.blur();
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