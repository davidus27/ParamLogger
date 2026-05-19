<template>
  <div 
    :class="['drawer', { 'open': isOpen }]"
  >
    <!-- Header -->
    <div class="drawer-head">
      <h3>{{ selectedParameter?.name || '' }}</h3>
      <button class="btn btn-ghost" @click="close">&times;</button>
    </div>
    
    <!-- Body -->
    <div class="drawer-body" v-if="selectedParameter">
      <div class="d-section">
        <h4>Details</h4>
        <div class="d-row">
          <span class="k">Location</span>
          <span class="v">
            <span :class="`loc loc-${selectedParameter.location}`">
              {{ selectedParameter.location }}
            </span>
          </span>
        </div>
        <div class="d-row">
          <span class="k">Endpoint</span>
          <span class="v mono">{{ selectedParameter.method }} {{ selectedParameter.normalizedPath }}</span>
        </div>
        <div class="d-row">
          <span class="k">Domain</span>
          <span class="v">{{ selectedParameter.domain }}</span>
        </div>
        <div class="d-row">
          <span class="k">Value type</span>
          <span class="v">{{ getDisplayValueType(selectedParameter.valueTypes) }}</span>
        </div>
        <div class="d-row">
          <span class="k">Seen</span>
          <span class="v">{{ selectedParameter.count }} requests</span>
        </div>
        <div class="d-row">
          <span class="k">Dynamic</span>
          <span class="v">{{ Math.round(selectedParameter.dynamicConfidence * 100) }}%</span>
        </div>
        <div class="d-row" v-if="selectedParameter.flags.length > 0">
          <span class="k">Flags</span>
          <span class="v">
            <span 
              v-for="flag in selectedParameter.flags" 
              :key="flag"
              :class="`flag flag-${flag}`"
            >
              {{ flag }}
            </span>
          </span>
        </div>
      </div>
      
      <div class="d-section">
        <h4>
          Observed values
          <span v-if="isLoadingObservations" style="font-size: 12px; color: var(--text-muted)">Loading...</span>
        </h4>
        
        <!-- Show recent observations if available -->
        <template v-if="observations.length > 0">
          <div 
            v-for="obs in observations.slice(0, 10)" 
            :key="obs.id"
            class="d-val"
            :title="`Type: ${obs.valueType}, Timestamp: ${new Date(obs.timestamp).toLocaleString()}`"
          >
            <span v-if="obs.redactedValue.startsWith('[redacted')" class="redacted">{{ obs.redactedValue }}</span>
            <span v-else>{{ obs.redactedValue }}</span>
            <span class="val-type">{{ obs.valueType }}</span>
          </div>
          <div v-if="observations.length > 10" class="d-val" style="color: var(--text-muted); font-style: italic;">
            ... and {{ observations.length - 10 }} more values
          </div>
        </template>
        
        <!-- Fallback to redacted examples -->
        <template v-else-if="selectedParameter.redactedExamples.length > 0">
          <div 
            v-for="value in selectedParameter.redactedExamples" 
            :key="value"
            class="d-val"
          >
            <span v-if="value.startsWith('[redacted')" class="redacted">{{ value }}</span>
            <span v-else>{{ value }}</span>
          </div>
        </template>
        
        <!-- Empty state -->
        <div v-else class="d-val" style="color: var(--text-muted); font-style: italic;">
          No observed values available
        </div>
      </div>
      
      <div class="d-section">
        <h4>Example requests</h4>
        <div 
          v-for="reqId in selectedParameter.exampleRequestIds.slice(0, 4)" 
          :key="reqId"
          class="d-req"
          @click="openRequest(reqId)"
        >
          <span class="id">#{{ reqId }}</span>
          <span :class="`method-badge m-${selectedParameter.method}`">{{ selectedParameter.method }}</span>
          <span style="color:var(--text-dim);font-size:11px">{{ selectedParameter.domain }}{{ selectedParameter.normalizedPath }}</span>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="drawer-foot" v-if="selectedParameter">
      <button class="btn" @click="replayRequest">&#x21BB; Replay</button>
      <button class="btn" @click="sendToAutomate">&#x27A1; Automate</button>
      <button class="btn" @click="copyParameterName">&#x2398; Copy name</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject, watch } from 'vue';
import type { Parameter, ValueType, Observation, Caido } from '@param-inventory/shared';
import { useInventory } from '../../composables/useInventory';
import { useBackend } from '../../composables/useBackend';

const isOpen = ref(false);
const selectedParameter = ref<Parameter | null>(null);
const observations = ref<Observation[]>([]);
const isLoadingObservations = ref(false);

const { setSelectedParameter } = useInventory();
const { getParameterObservations } = useBackend();
const caido = inject<Caido>('caido');

const emit = defineEmits<{
  'show-toast': [message: string, type?: 'success' | 'error' | 'info'];
}>();

async function open(parameter: Parameter) {
  selectedParameter.value = parameter;
  setSelectedParameter(parameter);
  isOpen.value = true;
  
  // Load detailed observations for this parameter
  await loadObservations(parameter.id);
}

function close() {
  isOpen.value = false;
  selectedParameter.value = null;
  setSelectedParameter(null);
  observations.value = [];
}

async function loadObservations(parameterId: string) {
  isLoadingObservations.value = true;
  try {
    // Load the most recent 20 observations
    const obs = await getParameterObservations(parameterId, 20);
    observations.value = obs;
  } catch (error) {
    console.error('Failed to load parameter observations:', error);
    observations.value = [];
  } finally {
    isLoadingObservations.value = false;
  }
}

function getDisplayValueType(valueTypes: ValueType[]): string {
  if (valueTypes.length === 0) return 'Unknown';
  if (valueTypes.length === 1) return valueTypes[0];
  return valueTypes[0] + ' (+' + (valueTypes.length - 1) + ')';
}

async function openRequest(reqId: string) {
  console.log(`Opening request ${reqId} in Caido...`);
  
  if (caido) {
    try {
      // Navigate to the request in Caido's history
      await caido.navigation.addPage(`/requests/${reqId}`, {
        title: `Request ${reqId}`
      });
      emit('show-toast', `Opened request ${reqId} in history`, 'success');
    } catch (error) {
      console.error('Failed to navigate to request:', error);
      emit('show-toast', 'Failed to open request in history', 'error');
    }
  }
}

async function replayRequest() {
  if (!selectedParameter.value) return;
  
  const param = selectedParameter.value;
  console.log(`Replaying ${param.method} ${param.domain}${param.normalizedPath}...`);
  
  if (caido && param.exampleRequestIds.length > 0) {
    try {
      // Use the first example request for replay
      const requestId = param.exampleRequestIds[0];
      await caido.replay.replay(requestId);
      emit('show-toast', `Replaying request ${requestId}`, 'success');
    } catch (error) {
      console.error('Failed to replay request:', error);
      emit('show-toast', 'Failed to replay request', 'error');
    }
  }
}

async function sendToAutomate() {
  if (!selectedParameter.value || !caido) return;
  
  try {
    const param = selectedParameter.value;
    console.log(`Sending ${param.name} from ${param.domain}${param.normalizedPath} to Automate...`);
    
    if (caido.automate && param.exampleRequestIds.length > 0) {
      await caido.automate.sendToAutomate(param.exampleRequestIds[0], {
        parameter: param.name,
        location: param.location
      });
      emit('show-toast', `Sent ${param.name} to Automate`, 'success');
    } else {
      emit('show-toast', 'Automate integration not available', 'error');
    }
  } catch (error) {
    console.error('Failed to send to Automate:', error);
    emit('show-toast', 'Failed to send to Automate', 'error');
  }
}

async function copyParameterName() {
  if (!selectedParameter.value) return;
  
  const name = selectedParameter.value.name;
  try {
    await navigator.clipboard.writeText(name);
    emit('show-toast', `Copied "${name}" to clipboard`, 'success');
  } catch (error) {
    console.warn(`Failed to copy to clipboard: ${name}`, error);
    emit('show-toast', `Copy failed: ${name}`, 'error');
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

// Expose functions for other components to call
defineExpose({
  open,
  close
});
</script>