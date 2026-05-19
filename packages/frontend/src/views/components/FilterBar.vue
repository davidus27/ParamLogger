<template>
  <div class="filter-bar">
    <!-- Location filter pills -->
    <span class="label">Location</span>
    <span 
      v-for="location in locations" 
      :key="location"
      :class="['pill', { 'on': isLocationActive(location) }]"
      :data-loc="location.toLowerCase()"
      @click="toggleLocation(location)"
    >
      {{ location }}
    </span>
    
    <span class="filter-sep"></span>
    
    <!-- Flag toggles -->
    <span class="label">Show</span>
    <span 
      :class="['pill', { 'on': filters.showInteresting }]"
      data-flag="interesting"
      @click="toggleFlag('showInteresting')"
    >
      Interesting only
    </span>
    <span 
      :class="['pill', { 'on': filters.showNew }]"
      data-flag="new"
      @click="toggleFlag('showNew')"
    >
      New only
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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