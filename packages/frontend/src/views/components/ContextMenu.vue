<template>
  <div 
    v-if="isVisible" 
    :class="['context-menu']"
    :style="menuStyle"
    @click.stop
  >
    <div class="context-menu-items">
      <button 
        class="context-item" 
        @click="replayRequest"
        :disabled="!canReplay"
      >
        <span class="icon">&#x21BB;</span>
        <span>Replay Request</span>
        <span class="shortcut">R</span>
      </button>
      
      <button 
        class="context-item" 
        @click="viewInHistory"
        :disabled="!canViewHistory"
      >
        <span class="icon">&#x1F50D;</span>
        <span>View in History</span>
        <span class="shortcut">H</span>
      </button>
      
      <div class="context-separator"></div>
      
      <button 
        class="context-item" 
        @click="copyParameterName"
      >
        <span class="icon">&#x2398;</span>
        <span>Copy Parameter Name</span>
        <span class="shortcut">C</span>
      </button>
      
      <button 
        class="context-item" 
        @click="copyEndpoint"
      >
        <span class="icon">&#x1F517;</span>
        <span>Copy Endpoint</span>
        <span class="shortcut">E</span>
      </button>
      
      <button 
        class="context-item" 
        @click="copyFullUrl"
      >
        <span class="icon">&#x1F310;</span>
        <span>Copy Full URL</span>
        <span class="shortcut">U</span>
      </button>
      
      <div class="context-separator"></div>
      
      <button 
        class="context-item" 
        @click="sendToAutomate"
        :disabled="!canSendToAutomate"
      >
        <span class="icon">&#x27A1;</span>
        <span>Send to Automate</span>
        <span class="shortcut">A</span>
      </button>
      
      <button 
        class="context-item" 
        @click="sendToRepeater"
        :disabled="!canSendToRepeater"
      >
        <span class="icon">&#x1F501;</span>
        <span>Send to Repeater</span>
        <span class="shortcut">T</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, nextTick } from 'vue';
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

const menuStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
}));

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

function handleKeydown(e: KeyboardEvent) {
  if (!props.isVisible || !props.parameter) return;
  
  // Handle keyboard shortcuts when context menu is open
  switch (e.key.toLowerCase()) {
    case 'r':
      e.preventDefault();
      if (canReplay.value) replayRequest();
      break;
    case 'h':
      e.preventDefault();
      if (canViewHistory.value) viewInHistory();
      break;
    case 'c':
      e.preventDefault();
      copyParameterName();
      break;
    case 'e':
      e.preventDefault();
      copyEndpoint();
      break;
    case 'u':
      e.preventDefault();
      copyFullUrl();
      break;
    case 'a':
      e.preventDefault();
      if (canSendToAutomate.value) sendToAutomate();
      break;
    case 't':
      e.preventDefault();
      if (canSendToRepeater.value) sendToRepeater();
      break;
    case 'escape':
      e.preventDefault();
      emit('close');
      break;
  }
}

function handleClickOutside(e: MouseEvent) {
  if (props.isVisible) {
    emit('close');
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  min-width: 180px;
  padding: 4px 0;
  font-size: 12px;
}

.context-menu-items {
  display: flex;
  flex-direction: column;
}

.context-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: none;
  background: none;
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  white-space: nowrap;
}

.context-item:hover:not(:disabled) {
  background: var(--accent);
  color: var(--text-on-accent);
}

.context-item:disabled {
  color: var(--text-muted);
  cursor: not-allowed;
}

.context-item .icon {
  width: 14px;
  text-align: center;
  font-size: 11px;
}

.context-item .shortcut {
  margin-left: auto;
  font-size: 10px;
  opacity: 0.7;
  padding: 1px 4px;
  border: 1px solid var(--border);
  border-radius: 2px;
}

.context-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
</style>