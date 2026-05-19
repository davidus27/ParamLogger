<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast" tag="div">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
        >
          <div class="toast-icon">
            <span v-if="toast.type === 'success'">&#x2713;</span>
            <span v-else-if="toast.type === 'error'">&#x2717;</span>
            <span v-else-if="toast.type === 'warning'">&#x26A0;</span>
            <span v-else>&#x2139;</span>
          </div>
          <div class="toast-message">{{ toast.message }}</div>
          <button 
            class="toast-close" 
            @click="removeToast(toast.id)"
            aria-label="Close notification"
          >
            &times;
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

const toasts = ref<Toast[]>([]);
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

function showToast(message: string, type: Toast['type'] = 'info', duration = 4000) {
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  
  const toast: Toast = {
    id,
    message,
    type,
    duration
  };
  
  toasts.value.push(toast);
  
  // Auto-remove after duration
  if (duration > 0) {
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);
    
    toastTimers.set(id, timer);
  }
  
  return id;
}

function removeToast(id: string) {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index > -1) {
    toasts.value.splice(index, 1);
  }
  
  // Clear timer if exists
  const timer = toastTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    toastTimers.delete(id);
  }
}

function clearAllToasts() {
  toasts.value = [];
  toastTimers.forEach(timer => clearTimeout(timer));
  toastTimers.clear();
}

// Clean up timers on unmount
onUnmounted(() => {
  toastTimers.forEach(timer => clearTimeout(timer));
  toastTimers.clear();
});

// Expose methods for parent components
defineExpose({
  showToast,
  removeToast,
  clearAllToasts
});
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid;
  min-width: 250px;
  max-width: 400px;
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(8px);
}

.toast-success {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgb(34, 197, 94);
  color: rgb(34, 197, 94);
}

.toast-error {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgb(239, 68, 68);
  color: rgb(239, 68, 68);
}

.toast-warning {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgb(245, 158, 11);
  color: rgb(245, 158, 11);
}

.toast-info {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgb(59, 130, 246);
  color: rgb(59, 130, 246);
}

.toast-icon {
  flex-shrink: 0;
  font-weight: bold;
  font-size: 14px;
}

.toast-message {
  flex: 1;
  word-wrap: break-word;
}

.toast-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  opacity: 0.7;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-close:hover {
  opacity: 1;
}

/* Transition animations */
.toast-enter-active {
  transition: all 0.3s ease;
}

.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>