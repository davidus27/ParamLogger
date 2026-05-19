<template>
  <div v-if="isVisible" class="help-overlay" @click="close">
    <div class="help-dialog" @click.stop>
      <div class="help-header">
        <h2>Keyboard Shortcuts</h2>
        <button class="btn btn-ghost" @click="close">&times;</button>
      </div>
      
      <div class="help-content">
        <div class="shortcut-section">
          <h3>Navigation</h3>
          <div class="shortcut-list">
            <div class="shortcut-item">
              <kbd>/</kbd>
              <span>Focus search input</span>
            </div>
            <div class="shortcut-item">
              <kbd>Escape</kbd>
              <span>Close dialogs and clear search</span>
            </div>
            <div class="shortcut-item">
              <kbd>?</kbd>
              <span>Show this help dialog</span>
            </div>
          </div>
        </div>
        
        <div class="shortcut-section">
          <h3>Actions</h3>
          <div class="shortcut-list">
            <div class="shortcut-item">
              <kbd>Ctrl + E</kbd>
              <span>Export wordlist</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl + R</kbd>
              <span>Refresh inventory</span>
            </div>
            <div class="shortcut-item">
              <kbd>Alt + C</kbd>
              <span>Clear all filters</span>
            </div>
          </div>
        </div>
        
        <div class="shortcut-section">
          <h3>Filters & Navigation</h3>
          <div class="shortcut-list">
            <div class="shortcut-item">
              <kbd>I</kbd>
              <span>Toggle interesting parameters</span>
            </div>
            <div class="shortcut-item">
              <kbd>N</kbd>
              <span>Toggle new parameters</span>
            </div>
            <div class="shortcut-item">
              <kbd>J</kbd>
              <span>Select next parameter</span>
            </div>
            <div class="shortcut-item">
              <kbd>K</kbd>
              <span>Select previous parameter</span>
            </div>
            <div class="shortcut-item">
              <kbd>Enter</kbd>
              <span>Open parameter detail drawer</span>
            </div>
            <div class="shortcut-item">
              <kbd>T</kbd>
              <span>Toggle tree panel visibility</span>
            </div>
          </div>
        </div>
        
        <div class="shortcut-section">
          <h3>Quick Actions</h3>
          <div class="shortcut-list">
            <div class="shortcut-item">
              <kbd>C</kbd>
              <span>Copy selected parameter name</span>
            </div>
            <div class="shortcut-item">
              <kbd>E</kbd>
              <span>Copy selected parameter endpoint</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl + ,</kbd>
              <span>Open settings</span>
            </div>
          </div>
        </div>
        
        <div class="shortcut-section">
          <h3>Context Menu (Right-click on parameter)</h3>
          <div class="shortcut-list">
            <div class="shortcut-item">
              <kbd>R</kbd>
              <span>Replay request</span>
            </div>
            <div class="shortcut-item">
              <kbd>H</kbd>
              <span>View in history</span>
            </div>
            <div class="shortcut-item">
              <kbd>C</kbd>
              <span>Copy parameter name</span>
            </div>
            <div class="shortcut-item">
              <kbd>E</kbd>
              <span>Copy endpoint</span>
            </div>
            <div class="shortcut-item">
              <kbd>U</kbd>
              <span>Copy full URL</span>
            </div>
            <div class="shortcut-item">
              <kbd>A</kbd>
              <span>Send to Automate</span>
            </div>
            <div class="shortcut-item">
              <kbd>T</kbd>
              <span>Send to Repeater</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="help-footer">
        <p>
          <strong>Tip:</strong> Most shortcuts work globally, except context menu shortcuts which only work when the right-click menu is open.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

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

<style scoped>
.help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.help-dialog {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  max-width: 600px;
  width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border);
}

.help-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.help-content {
  padding: 20px 24px;
  overflow-y: auto;
}

.shortcut-section {
  margin-bottom: 24px;
}

.shortcut-section:last-child {
  margin-bottom: 0;
}

.shortcut-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.shortcut-item kbd {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 11px;
  min-width: 60px;
  text-align: center;
  color: var(--text-muted);
}

.shortcut-item span {
  color: var(--text);
}

.help-footer {
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-muted);
}

.help-footer strong {
  color: var(--text);
}
</style>