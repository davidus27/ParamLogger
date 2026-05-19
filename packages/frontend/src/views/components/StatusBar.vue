<template>
  <span>
    <span :class="['live', { 'scanning': isScanning, 'connected': isConnected, 'disconnected': !isConnected }]"></span>
    <template v-if="isScanning && scanProgress">
      Scanning... {{ scanProgress.processed }}/{{ scanProgress.total }} ({{ scanProgressPercent }}%)
    </template>
    <template v-else-if="isConnected">
      Listening &middot; {{ stats.totalRequests }} requests parsed
    </template>
    <template v-else>
      Disconnected
    </template>
  </span>
  <span>
    {{ stats.totalParams }} params &middot; {{ stats.domains }} domains &middot; v0.1.0
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useInventory } from '../../composables/useInventory';
import { useBackend } from '../../composables/useBackend';

const { stats } = useInventory();
const { connectionStatus } = useBackend();

const isConnected = computed(() => connectionStatus.isConnected);
const isScanning = computed(() => connectionStatus.isScanning);
const scanProgress = computed(() => connectionStatus.scanProgress);

const scanProgressPercent = computed(() => {
  if (!scanProgress.value || scanProgress.value.total === 0) return 0;
  return Math.round((scanProgress.value.processed / scanProgress.value.total) * 100);
});
</script>