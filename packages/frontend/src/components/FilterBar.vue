<template>
  <div class="inv-filter-bar">
    <div class="inv-filter-group">
      <span class="inv-filter-label">Location</span>
      <span
        v-for="loc in locationFilters"
        :key="loc.value"
        class="inv-pill"
        :class="{ on: activeLoc === loc.value }"
        @click="$emit('update:activeLoc', loc.value)"
      >{{ loc.label }}</span>
    </div>
    <span class="inv-filter-sep"></span>
    <div class="inv-filter-group">
      <span class="inv-filter-label">Flags</span>
      <span
        v-for="f in FILTER_FLAGS"
        :key="f.flag"
        class="inv-pill"
        :class="{ on: activeFlags.has(f.flag) }"
        @click="$emit('toggle-flag', f.flag)"
      >{{ f.label }}</span>
    </div>
    <span class="inv-filter-sep"></span>
    <div class="inv-filter-group">
      <span class="inv-filter-label">Value type</span>
      <span
        v-for="vt in FILTER_VALUE_TYPES"
        :key="vt.valueType"
        class="inv-pill"
        :class="{ on: activeValueTypes.has(vt.valueType) }"
        @click="$emit('toggle-value-type', vt.valueType)"
      >{{ vt.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ParameterLocation, ValueType } from '@param-logger/shared';
import { locationFilters, FILTER_FLAGS, FILTER_VALUE_TYPES } from '../constants/filterConfig';

defineProps<{
  activeLoc: 'all' | ParameterLocation;
  activeFlags: Set<string>;
  activeValueTypes: Set<ValueType>;
}>();

defineEmits<{
  'update:activeLoc': [value: 'all' | ParameterLocation];
  'toggle-flag': [flag: string];
  'toggle-value-type': [valueType: ValueType];
}>();
</script>
