<template>
  <div id="param-inventory-root" class="inventory-app">
    <div class="inventory-header">
      <span class="inventory-title">Parameter Inventory</span>
      <span class="inventory-count" v-if="parameters.length">
        {{ parameters.length }} parameters
      </span>
      <span class="inventory-status" :class="{ connected: isConnected }">
        {{ isConnected ? 'Connected' : 'Disconnected' }}
      </span>
    </div>

    <div class="inventory-list" v-if="parameters.length">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Domain</th>
            <th>Endpoint</th>
            <th>Types</th>
            <th>Flags</th>
            <th>Count</th>

          </tr>
        </thead>
        <tbody>
          <tr v-for="param in parameters" :key="param.id">
            <td class="param-name">{{ param.name }}</td>
            <td><span class="loc">{{ param.location }}</span></td>
            <td>{{ param.domain }}</td>
            <td class="endpoint-cell">
              <span class="method-badge">{{ param.method }}</span>
              {{ param.normalizedPath }}
            </td>
            <td class="val-type">{{ param.valueTypes.join(', ') }}</td>
            <td>
              <span v-for="flag in param.flags" :key="flag" class="flag">{{ flag }}</span>
            </td>
            <td>{{ param.count }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="inventory-empty" v-else-if="!isLoading">
      No params collected yet. Browse some pages through Caido to start collecting.
    </div>
    <div class="inventory-actions" v-else-if="!isLoading">
      <button class="inventory-action-btn" @click.prevent>Do Nothing</button>
    </div>

    <div class="inventory-loading" v-else>
      Loading...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue';
import type { Caido } from '@caido/sdk-frontend';
import type { InventoryBackendAPI, InventoryBackendEvents } from '@param-inventory/shared';
import { useInventory } from '../composables/useInventory';
import { useBackend } from '../composables/useBackend';

const caido = inject<Caido<InventoryBackendAPI, InventoryBackendEvents>>('caido');
const { parameters, isLoading, setLoading } = useInventory();
const { init: initBackend, connectionStatus } = useBackend();

const isConnected = computed(() => connectionStatus.isConnected);

onMounted(async () => {
  try {
    setLoading(true);
    if (caido) {
      initBackend(caido);
    } else {
      console.warn('No Caido SDK provided, running in development mode');
    }
  } catch (error) {
    console.error('Error during app initialization:', error);
  } finally {
    setLoading(false);
  }
});
</script>
