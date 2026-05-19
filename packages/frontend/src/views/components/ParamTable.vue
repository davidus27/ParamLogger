<template>
  <div class="param-table-container">
    <table>
      <thead>
        <tr>
          <th style="width:30px"></th>
          <th>Parameter</th>
          <th>Location</th>
          <th>Value type</th>
          <th>Flags</th>
          <th>Seen</th>
          <th style="width:60px"></th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="(param, index) in parameters" 
          :key="param.id"
          :class="{ 'selected': selectedParameter?.id === param.id }"
          @click="openDrawer(param)"
          @contextmenu="showContextMenu($event, param)"
        >
          <td style="text-align:center;color:var(--text-muted);font-size:10px">
            {{ index + 1 }}
          </td>
          <td>
            <span class="param-name">{{ param.name }}</span>
          </td>
          <td>
            <span :class="`loc loc-${param.location}`">{{ param.location }}</span>
          </td>
          <td class="val-type">
            {{ getDisplayValueType(param.valueTypes) }}
          </td>
          <td>
            <template v-if="param.flags.length > 0">
              <span 
                v-for="flag in param.flags" 
                :key="flag"
                :class="`flag flag-${flag}`"
              >
                {{ flag.toUpperCase() }}
              </span>
            </template>
            <span v-else style="color:var(--text-muted)">—</span>
          </td>
          <td style="color:var(--text-muted)">
            {{ param.count }}x
          </td>
          <td>
            <div class="row-actions">
              <button 
                class="btn btn-ghost btn-sm" 
                title="Replay" 
                @click.stop="replayRequest(param)"
              >
                &#x21BB;
              </button>
              <button 
                class="btn btn-ghost btn-sm" 
                title="Copy name" 
                @click.stop="copyParameterName(param.name)"
              >
                &#x2398;
              </button>
              <button 
                class="btn btn-ghost btn-sm" 
                title="Copy endpoint" 
                @click.stop="copyEndpoint(param)"
              >
                &#x1F517;
              </button>
            </div>
          </td>
        </tr>
        
        <!-- Empty state -->
        <tr v-if="!hasParameters">
          <td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">
            No parameters found. Start intercepting traffic or run a historical scan.
          </td>
        </tr>
      </tbody>
    </table>
    
    <!-- Context Menu -->
    <ContextMenu
      :parameter="contextMenuParameter"
      :x="contextMenuX"
      :y="contextMenuY"
      :isVisible="contextMenuVisible"
      @close="closeContextMenu"
      @action="handleContextAction"
      @show-toast="showToast"
    />
  </div>
</template>

<script setup lang="ts">
import { inject, computed, ref } from 'vue';
import { useInventory } from '../../composables/useInventory';
import ContextMenu from './ContextMenu.vue';
import type { Parameter, ValueType, Caido } from '@param-inventory/shared';

const { parameters, selectedParameter } = useInventory();
const caido = inject<Caido>('caido');

// Context menu state
const contextMenuVisible = ref(false);
const contextMenuParameter = ref<Parameter | null>(null);
const contextMenuX = ref(0);
const contextMenuY = ref(0);

function getDisplayValueType(valueTypes: ValueType[]): string {
  if (valueTypes.length === 0) return 'Unknown';
  if (valueTypes.length === 1) return valueTypes[0];
  return valueTypes[0] + ' (+' + (valueTypes.length - 1) + ')';
}

const emit = defineEmits<{
  'open-drawer': [parameter: Parameter];
  'show-toast': [message: string, type?: 'success' | 'error' | 'info'];
}>();

function openDrawer(parameter: Parameter) {
  emit('open-drawer', parameter);
}

function showContextMenu(event: MouseEvent, parameter: Parameter) {
  event.preventDefault();
  
  contextMenuParameter.value = parameter;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  contextMenuVisible.value = true;
}

function closeContextMenu() {
  contextMenuVisible.value = false;
  contextMenuParameter.value = null;
}

function handleContextAction(action: string, parameter: Parameter) {
  console.log(`Context action: ${action} for parameter:`, parameter);
  // The context menu handles the specific actions,
  // but we can add additional logic here if needed
}

function showToast(message: string, type?: 'success' | 'error' | 'info') {
  emit('show-toast', message, type);
}

async function replayRequest(param: Parameter) {
  console.log(`Replaying ${param.method} ${param.domain}${param.normalizedPath}...`);
  
  if (caido && param.exampleRequestIds.length > 0) {
    // Use the first example request ID to replay
    const requestId = param.exampleRequestIds[0];
    try {
      if (caido.replay) {
        await caido.replay.replay(requestId);
        showToast(`Replaying request ${requestId}`, 'success');
      } else {
        // Fallback to navigation
        await caido.navigation.addPage(`/requests/${requestId}`, {
          title: `Request ${requestId}`
        });
        showToast(`Opened request ${requestId} in history`, 'info');
      }
    } catch (error) {
      console.error('Failed to replay/navigate to request:', error);
      showToast('Failed to replay request', 'error');
    }
  }
}

async function copyParameterName(name: string) {
  try {
    await navigator.clipboard.writeText(name);
    showToast(`Copied "${name}" to clipboard`, 'success');
  } catch (error) {
    console.warn(`Failed to copy to clipboard: ${name}`, error);
    showToast(`Copy failed: ${name}`, 'error');
  }
}

async function copyEndpoint(param: Parameter) {
  const endpoint = `${param.method} ${param.domain}${param.normalizedPath}`;
  try {
    await navigator.clipboard.writeText(endpoint);
    showToast('Copied endpoint to clipboard', 'success');
  } catch (error) {
    console.warn(`Failed to copy endpoint: ${endpoint}`, error);
    showToast(`Copy failed: ${endpoint}`, 'error');
  }
}

// Computed property for empty state
const hasParameters = computed(() => parameters.value.length > 0);
</script>