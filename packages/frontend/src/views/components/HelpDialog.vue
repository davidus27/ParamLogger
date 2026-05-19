<template>
  <Dialog 
    v-model:visible="isVisible"
    modal
    :closable="true"
    :draggable="false"
    class="w-full max-w-2xl"
    @hide="onHide"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <i class="pi pi-question-circle text-primary"></i>
        <span class="font-semibold">Keyboard Shortcuts</span>
      </div>
    </template>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
      <div class="space-y-4">
        <div>
          <h3 class="font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
            <i class="pi pi-compass text-primary"></i>
            Navigation
          </h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">/</kbd>
              <span class="text-sm">Focus search input</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">Escape</kbd>
              <span class="text-sm">Close dialogs and clear search</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">?</kbd>
              <span class="text-sm">Show this help dialog</span>
            </div>
          </div>
        </div>
        
        <div>
          <h3 class="font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
            <i class="pi pi-cog text-primary"></i>
            Actions
          </h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">Ctrl + E</kbd>
              <span class="text-sm">Export wordlist</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">Ctrl + R</kbd>
              <span class="text-sm">Refresh inventory</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">Alt + C</kbd>
              <span class="text-sm">Clear all filters</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="space-y-4">
        <div>
          <h3 class="font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
            <i class="pi pi-filter text-primary"></i>
            Filters & Navigation
          </h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">I</kbd>
              <span class="text-sm">Toggle interesting parameters</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">N</kbd>
              <span class="text-sm">Toggle new parameters</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">J</kbd>
              <span class="text-sm">Select next parameter</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">K</kbd>
              <span class="text-sm">Select previous parameter</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">Enter</kbd>
              <span class="text-sm">Open parameter detail drawer</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">T</kbd>
              <span class="text-sm">Toggle tree panel visibility</span>
            </div>
          </div>
        </div>
        
        <div>
          <h3 class="font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
            <i class="pi pi-bolt text-primary"></i>
            Quick Actions
          </h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">C</kbd>
              <span class="text-sm">Copy selected parameter name</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">E</kbd>
              <span class="text-sm">Copy selected parameter endpoint</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
              <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">Ctrl + ,</kbd>
              <span class="text-sm">Open settings</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="mt-6">
      <h3 class="font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
        <i class="pi pi-list text-primary"></i>
        Context Menu (Right-click on parameter)
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
          <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">R</kbd>
          <span class="text-sm">Replay request</span>
        </div>
        <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
          <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">H</kbd>
          <span class="text-sm">View in history</span>
        </div>
        <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
          <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">C</kbd>
          <span class="text-sm">Copy parameter name</span>
        </div>
        <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
          <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">E</kbd>
          <span class="text-sm">Copy endpoint</span>
        </div>
        <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
          <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">U</kbd>
          <span class="text-sm">Copy full URL</span>
        </div>
        <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
          <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">A</kbd>
          <span class="text-sm">Send to Automate</span>
        </div>
        <div class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
          <kbd class="px-2 py-1 text-xs bg-surface-200 dark:bg-surface-700 rounded">T</kbd>
          <span class="text-sm">Send to Repeater</span>
        </div>
      </div>
    </div>
    
    <Message severity="info" :closable="false" class="mt-4">
      <div class="flex items-start gap-2">
        <i class="pi pi-info-circle mt-0.5"></i>
        <div>
          <strong>Tip:</strong> Most shortcuts work globally, except context menu shortcuts which only work when the right-click menu is open.
        </div>
      </div>
    </Message>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';

const isVisible = ref(false);

const emit = defineEmits<{
  'close': [];
}>();

function open() {
  isVisible.value = true;
}

function close() {
  isVisible.value = false;
  emit('close');
}

function onHide() {
  emit('close');
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isVisible.value) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

defineExpose({
  open,
  close
});
</script>