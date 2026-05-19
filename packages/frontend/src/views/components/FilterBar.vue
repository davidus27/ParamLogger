<template>
  <div class="flex items-center gap-4 px-4 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
    <!-- Location filter chips -->
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Location</span>
      <div class="flex gap-1">
        <Chip 
          v-for="location in locations" 
          :key="location"
          :label="location"
          :class="{ '!bg-primary !text-primary-contrast': isLocationActive(location) }"
          class="cursor-pointer text-xs"
          @click="toggleLocation(location)"
        />
      </div>
    </div>
    
    <Divider layout="vertical" class="!h-6" />
    
    <!-- Flag toggles -->
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Show</span>
      <div class="flex gap-1">
        <Chip 
          label="Interesting only"
          :class="{ '!bg-primary !text-primary-contrast': filters.showInteresting }"
          class="cursor-pointer text-xs"
          @click="toggleFlag('showInteresting')"
        />
        <Chip 
          label="New only"
          :class="{ '!bg-primary !text-primary-contrast': filters.showNew }"
          class="cursor-pointer text-xs"
          @click="toggleFlag('showNew')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Chip from 'primevue/chip';
import Divider from 'primevue/divider';
import { useInventory } from '../../composables/useInventory';
import { ParameterLocation } from '@param-inventory/shared';

const { filters, toggleLocationFilter, updateFilters, availableLocations } = useInventory();

const locations = ['All', 'Query', 'JSON', 'Form', 'Header', 'Cookie', 'Path'];

const activeLocation = computed(() => {
  if (!filters.locations || filters.locations.length === 0) {
    return 'All';
  }
  if (filters.locations.length === 1) {
    const loc = filters.locations[0];
    switch (loc) {
      case ParameterLocation.QUERY: return 'Query';
      case ParameterLocation.JSON: return 'JSON';
      case ParameterLocation.FORM: return 'Form';
      case ParameterLocation.HEADER: return 'Header';
      case ParameterLocation.COOKIE: return 'Cookie';
      case ParameterLocation.PATH: return 'Path';
      default: return 'All';
    }
  }
  return 'All';
});

function isLocationActive(location: string) {
  return activeLocation.value === location;
}

function toggleLocation(location: string) {
  if (location === 'All') {
    updateFilters({ locations: [] });
  } else {
    let paramLocation: ParameterLocation;
    switch (location) {
      case 'Query': paramLocation = ParameterLocation.QUERY; break;
      case 'JSON': paramLocation = ParameterLocation.JSON; break;
      case 'Form': paramLocation = ParameterLocation.FORM; break;
      case 'Header': paramLocation = ParameterLocation.HEADER; break;
      case 'Cookie': paramLocation = ParameterLocation.COOKIE; break;
      case 'Path': paramLocation = ParameterLocation.PATH; break;
      default: return;
    }
    
    // Use the new toggle method which handles adding/removing from array
    toggleLocationFilter(paramLocation);
  }
}

function toggleFlag(flag: 'showInteresting' | 'showNew') {
  updateFilters({ [flag]: !filters[flag] });
}
</script>