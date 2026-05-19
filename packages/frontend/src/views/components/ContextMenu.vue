<template>
  <ContextMenu 
    ref="contextMenuRef" 
    :model="menuItems" 
    @hide="emit('close')"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, nextTick, watch } from 'vue';
import ContextMenu from 'primevue/contextmenu';
import type { Parameter, Caido } from '@param-inventory/shared';

interface ContextMenuProps {
  parameter: Parameter | null;
  x: number;
  y: number;
  isVisible: boolean;
}

const props = defineProps<ContextMenuProps>();

const emit = defineEmits<{
  'close': [];
  'action': [action: string, parameter: Parameter];
  'show-toast': [message: string, type?: 'success' | 'error' | 'info'];
}>();

const caido = inject<Caido>('caido');
const contextMenuRef = ref();

const canReplay = computed(() => {
  return props.parameter && props.parameter.exampleRequestIds.length > 0;
});

const canViewHistory = computed(() => {
  return props.parameter && props.parameter.exampleRequestIds.length > 0;
});

const canSendToAutomate = computed(() => {
  return props.parameter && caido && typeof caido.automate !== 'undefined';
});

const canSendToRepeater = computed(() => {
  return props.parameter && caido && typeof caido.repeater !== 'undefined';
});

const menuItems = computed(() => [
  {
    label: 'Replay Request',
    icon: 'pi pi-refresh',
    disabled: !canReplay.value,
    command: replayRequest
  },
  {
    label: 'View in History',
    icon: 'pi pi-search',
    disabled: !canViewHistory.value,
    command: viewInHistory
  },
  { separator: true },
  {
    label: 'Copy Parameter Name',
    icon: 'pi pi-copy',
    command: copyParameterName
  },
  {
    label: 'Copy Endpoint',
    icon: 'pi pi-link',
    command: copyEndpoint
  },
  {
    label: 'Copy Full URL',
    icon: 'pi pi-external-link',
    command: copyFullUrl
  },
  { separator: true },
  {
    label: 'Send to Automate',
    icon: 'pi pi-send',
    disabled: !canSendToAutomate.value,
    command: sendToAutomate
  },
  {
    label: 'Send to Repeater',
    icon: 'pi pi-replay',
    disabled: !canSendToRepeater.value,
    command: sendToRepeater
  }
]);

// Show context menu when props change
watch(
  () => props.isVisible,
  (visible) => {
    if (visible && contextMenuRef.value) {
      nextTick(() => {
        contextMenuRef.value.show({ x: props.x, y: props.y });
      });
    }
  }
);

async function replayRequest() {
  if (!props.parameter || !canReplay.value) return;
  
  try {
    const requestId = props.parameter.exampleRequestIds[0];
    
    if (caido && caido.replay) {
      await caido.replay.replay(requestId);
      emit('show-toast', `Replaying request ${requestId}`, 'success');
    } else {
      // Fallback for development
      console.log(`Replaying request ${requestId} for parameter ${props.parameter.name}`);
      emit('show-toast', `Replay initiated for ${props.parameter.name}`, 'info');
    }
    
    emit('action', 'replay', props.parameter);
  } catch (error) {
    console.error('Failed to replay request:', error);
    emit('show-toast', 'Failed to replay request', 'error');
  }
  
  emit('close');
}

async function viewInHistory() {
  if (!props.parameter || !canViewHistory.value) return;
  
  try {
    const requestId = props.parameter.exampleRequestIds[0];
    
    if (caido && caido.navigation) {
      await caido.navigation.addPage(`/requests/${requestId}`, {
        title: `Request ${requestId}`
      });
      emit('show-toast', `Opened request ${requestId} in history`, 'success');
    } else {
      // Fallback for development
      console.log(`Opening request ${requestId} in history`);
      emit('show-toast', `Request ${requestId} opened in history`, 'info');
    }
    
    emit('action', 'view-history', props.parameter);
  } catch (error) {
    console.error('Failed to view request in history:', error);
    emit('show-toast', 'Failed to open request in history', 'error');
  }
  
  emit('close');
}

async function copyParameterName() {
  if (!props.parameter) return;
  
  try {
    await navigator.clipboard.writeText(props.parameter.name);
    emit('show-toast', `Copied "${props.parameter.name}" to clipboard`, 'success');
  } catch (error) {
    console.warn('Failed to copy to clipboard:', error);
    emit('show-toast', `Copy failed: ${props.parameter.name}`, 'error');
  }
  
  emit('action', 'copy-name', props.parameter);
  emit('close');
}

async function copyEndpoint() {
  if (!props.parameter) return;
  
  const endpoint = `${props.parameter.method} ${props.parameter.normalizedPath}`;
  
  try {
    await navigator.clipboard.writeText(endpoint);
    emit('show-toast', `Copied endpoint to clipboard`, 'success');
  } catch (error) {
    console.warn('Failed to copy endpoint:', error);
    emit('show-toast', `Copy failed: ${endpoint}`, 'error');
  }
  
  emit('action', 'copy-endpoint', props.parameter);
  emit('close');
}

async function copyFullUrl() {
  if (!props.parameter) return;
  
  const fullUrl = `https://${props.parameter.domain}${props.parameter.normalizedPath}`;
  
  try {
    await navigator.clipboard.writeText(fullUrl);
    emit('show-toast', `Copied full URL to clipboard`, 'success');
  } catch (error) {
    console.warn('Failed to copy full URL:', error);
    emit('show-toast', `Copy failed: ${fullUrl}`, 'error');
  }
  
  emit('action', 'copy-url', props.parameter);
  emit('close');
}

async function sendToAutomate() {
  if (!props.parameter || !canSendToAutomate.value) return;
  
  try {
    if (caido && caido.automate) {
      // This would depend on Caido's actual Automate API
      // For now, simulate the action
      console.log(`Sending ${props.parameter.name} to Automate`);
      emit('show-toast', `Sent ${props.parameter.name} to Automate`, 'success');
    } else {
      emit('show-toast', 'Automate integration not available', 'error');
    }
    
    emit('action', 'send-to-automate', props.parameter);
  } catch (error) {
    console.error('Failed to send to Automate:', error);
    emit('show-toast', 'Failed to send to Automate', 'error');
  }
  
  emit('close');
}

async function sendToRepeater() {
  if (!props.parameter || !canSendToRepeater.value) return;
  
  try {
    if (caido && caido.repeater && props.parameter.exampleRequestIds.length > 0) {
      const requestId = props.parameter.exampleRequestIds[0];
      // This would depend on Caido's actual Repeater API
      console.log(`Sending request ${requestId} to Repeater`);
      emit('show-toast', `Sent request to Repeater`, 'success');
    } else {
      emit('show-toast', 'Repeater integration not available', 'error');
    }
    
    emit('action', 'send-to-repeater', props.parameter);
  } catch (error) {
    console.error('Failed to send to Repeater:', error);
    emit('show-toast', 'Failed to send to Repeater', 'error');
  }
  
  emit('close');
}

// Event handlers are now managed by PrimeVue ContextMenu component
</script>