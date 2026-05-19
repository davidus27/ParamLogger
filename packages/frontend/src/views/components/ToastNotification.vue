<template>
  <Toast position="top-right" />
</template>

<script setup lang="ts">
import { inject } from 'vue';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const toast = useToast();

function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 4000) {
  toast.add({
    severity: type,
    summary: message,
    life: duration
  });
}

function removeToast(id: string) {
  // PrimeVue toast handles removal automatically
}

function clearAllToasts() {
  toast.removeAllGroups();
}

// Expose methods for parent components
defineExpose({
  showToast,
  removeToast,
  clearAllToasts
});
</script>