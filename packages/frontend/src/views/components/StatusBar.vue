<template>
  <div class="flex items-center justify-between w-full px-4 py-2 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm">
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <div 
          :class="[
            'w-2 h-2 rounded-full',
            {
              'bg-yellow-500 animate-pulse': isScanning,
              'bg-green-500': isConnected && !isScanning,
              'bg-red-500': !isConnected
            }
          ]"
        ></div>
        <span class="text-xs font-medium">
          <template v-if="isScanning && scanProgress">
            Scanning... {{ scanProgress.processed }}/{{ scanProgress.total }} ({{ scanProgressPercent }}%)
          </template>
          <template v-else-if="isConnected">
            Listening • {{ stats.totalRequests }} requests parsed
          </template>
          <template v-else>
            Disconnected
          </template>
        </span>
      </div>
      
      <ProgressBar 
        v-if="isScanning && scanProgress" 
        :value="scanProgressPercent" 
        class="w-24 h-1"
        :showValue="false"
      />
    </div>
    
    <div class="flex items-center gap-1 text-xs text-muted-color">
      <Tag :value="stats.totalParams + ' params'" severity="secondary" class="text-xs" />
      <span>•</span>
      <Tag :value="stats.domains + ' domains'" severity="secondary" class="text-xs" />
      <span>•</span>
      <span>v0.1.0</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
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