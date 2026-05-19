<template>
  <div v-if="visible" class="drawer open" @click.self="close">
    <div class="drawer-head">
      <h3>Settings</h3>
      <button class="btn btn-ghost btn-sm" @click="close">✕</button>
    </div>
    <div class="drawer-body">
      <div class="settings-panel">
        <div class="settings-section">
          <h3><span>⚙</span> Layout</h3>
          <div class="settings-row">
            <span class="settings-label">Tree panel width (px)</span>
            <div class="settings-control">
              <input
                class="number-input"
                type="number"
                :value="localSettings.treePanelWidth"
                min="150"
                max="500"
                @input="localSettings.treePanelWidth = +($event.target as HTMLInputElement).value"
              />
            </div>
          </div>
          <div class="settings-row">
            <span class="settings-label">Drawer width (px)</span>
            <div class="settings-control">
              <input
                class="number-input"
                type="number"
                :value="localSettings.drawerWidth"
                min="250"
                max="800"
                @input="localSettings.drawerWidth = +($event.target as HTMLInputElement).value"
              />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3><span>🔄</span> Data</h3>
          <div class="settings-row">
            <span class="settings-label">Auto-refresh</span>
            <div class="settings-control">
              <div
                class="toggle"
                :class="{ on: localSettings.autoRefresh }"
                @click="localSettings.autoRefresh = !localSettings.autoRefresh"
              />
            </div>
          </div>
          <div class="settings-row">
            <span class="settings-label">Refresh interval (ms)</span>
            <div class="settings-control">
              <input
                class="number-input"
                type="number"
                :value="localSettings.refreshInterval"
                min="1000"
                max="60000"
                step="1000"
                @input="localSettings.refreshInterval = +($event.target as HTMLInputElement).value"
              />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3><span>🔒</span> Privacy</h3>
          <div class="settings-row">
            <span class="settings-label">Redaction mode</span>
            <div class="settings-control">
              <select
                class="number-input"
                style="width:120px"
                :value="localSettings.defaultRedactionMode"
                @change="localSettings.defaultRedactionMode = ($event.target as HTMLSelectElement).value as any"
              >
                <option value="full">Full</option>
                <option value="partial">Partial</option>
                <option value="hash">Hash</option>
                <option value="length">Length only</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="drawer-foot">
      <button class="btn btn-accent" @click="save">Save</button>
      <button class="btn" @click="close">Cancel</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import type { FrontendSettings } from '@param-inventory/shared';

const props = defineProps<{
  settings: FrontendSettings;
}>();

const emit = defineEmits<{
  save: [settings: FrontendSettings];
}>();

const visible = ref(false);
const localSettings = reactive<FrontendSettings>({
  filters: {},
  tableColumnWidths: {},
  drawerWidth: 380,
  treePanelWidth: 280,
  autoRefresh: true,
  refreshInterval: 5000,
  defaultRedactionMode: 'partial',
});

watch(
  () => props.settings,
  (s) => {
    if (s) Object.assign(localSettings, JSON.parse(JSON.stringify(s)));
  },
  { immediate: true, deep: true }
);

function open() {
  Object.assign(localSettings, JSON.parse(JSON.stringify(props.settings)));
  visible.value = true;
}

function close() {
  visible.value = false;
}

function save() {
  emit('save', { ...localSettings });
  close();
}

defineExpose({ open, close });
</script>
