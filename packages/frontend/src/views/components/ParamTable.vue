<template>
  <div class="param-table-container">
    <DataTable 
      :value="parameters"
      :selection="selectedParameter"
      selectionMode="single"
      @rowSelect="onRowSelect"
      @rowContextmenu="onRowContextMenu"
      scrollable
      scrollHeight="flex"
      :emptyMessage="emptyMessage"
      class="text-sm"
    >
      <Column field="index" header="#" style="width:3rem" class="text-center">
        <template #body="{ index }">
          <span class="text-xs text-muted-color">{{ index + 1 }}</span>
        </template>
      </Column>
      
      <Column field="name" header="Parameter" sortable>
        <template #body="{ data }">
          <span class="font-mono font-medium">{{ data.name }}</span>
        </template>
      </Column>
      
      <Column field="location" header="Location" sortable style="width:6rem">
        <template #body="{ data }">
          <Tag 
            :value="data.location" 
            :class="getLocationTagClass(data.location)"
            class="text-xs"
          />
        </template>
      </Column>
      
      <Column field="valueTypes" header="Value type" style="width:8rem">
        <template #body="{ data }">
          <span class="text-muted-color text-xs">{{ getDisplayValueType(data.valueTypes) }}</span>
        </template>
      </Column>
      
      <Column field="flags" header="Flags" style="width:8rem">
        <template #body="{ data }">
          <div class="flex gap-1 flex-wrap" v-if="data.flags.length > 0">
            <Tag 
              v-for="flag in data.flags" 
              :key="flag"
              :value="flag.toUpperCase()"
              :class="getFlagTagClass(flag)"
              class="text-xs"
            />
          </div>
          <span v-else class="text-muted-color">—</span>
        </template>
      </Column>
      
      <Column field="count" header="Seen" sortable style="width:4rem">
        <template #body="{ data }">
          <span class="text-muted-color text-xs">{{ data.count }}x</span>
        </template>
      </Column>
      
      <Column header="Actions" style="width:8rem">
        <template #body="{ data }">
          <div class="flex gap-1">
            <Button 
              icon="pi pi-refresh" 
              variant="text" 
              size="small"
              v-tooltip="'Replay'"
              @click="replayRequest(data)"
            />
            <Button 
              icon="pi pi-copy" 
              variant="text" 
              size="small"
              v-tooltip="'Copy name'"
              @click="copyParameterName(data.name)"
            />
            <Button 
              icon="pi pi-link" 
              variant="text" 
              size="small"
              v-tooltip="'Copy endpoint'"
              @click="copyEndpoint(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>
    
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
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
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

const emptyMessage = 'No parameters found. Start intercepting traffic or run a historical scan.';

function getDisplayValueType(valueTypes: ValueType[]): string {
  if (valueTypes.length === 0) return 'Unknown';
  if (valueTypes.length === 1) return valueTypes[0];
  return valueTypes[0] + ' (+' + (valueTypes.length - 1) + ')';
}

function getLocationTagClass(location: string): string {
  const classes = {
    query: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    json: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    form: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    header: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    cookie: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    path: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  };
  return classes[location.toLowerCase() as keyof typeof classes] || 'bg-surface-100 text-surface-800 dark:bg-surface-700 dark:text-surface-300';
}

function getFlagTagClass(flag: string): string {
  const classes = {
    interesting: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    new: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
    sensitive: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  };
  return classes[flag.toLowerCase() as keyof typeof classes] || 'bg-surface-100 text-surface-800 dark:bg-surface-700 dark:text-surface-300';
}

const emit = defineEmits<{
  'open-drawer': [parameter: Parameter];
  'show-toast': [message: string, type?: 'success' | 'error' | 'info'];
}>();

function openDrawer(parameter: Parameter) {
  emit('open-drawer', parameter);
}

function onRowSelect(event: any) {
  openDrawer(event.data);
}

function onRowContextMenu(event: any) {
  const mouseEvent = event.originalEvent;
  mouseEvent.preventDefault();
  
  contextMenuParameter.value = event.data;
  contextMenuX.value = mouseEvent.clientX;
  contextMenuY.value = mouseEvent.clientY;
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