<template>
  <Dialog 
    v-model:visible="visible"
    modal
    :closable="true"
    :draggable="false"
    class="w-full max-w-lg"
    @hide="close"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <i class="pi pi-cog text-primary"></i>
        <span class="font-semibold">Settings</span>
      </div>
    </template>
    
    <div class="space-y-6">
      <!-- Layout Section -->
      <div class="space-y-4">
        <div class="flex items-center gap-2 pb-2 border-b border-surface-200 dark:border-surface-700">
          <i class="pi pi-layout text-primary"></i>
          <h3 class="font-semibold text-surface-700 dark:text-surface-300">Layout</h3>
        </div>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Tree panel width (px)</label>
            <InputNumber
              v-model="localSettings.treePanelWidth"
              :min="150"
              :max="500"
              :step="10"
              showButtons
              class="w-32"
            />
          </div>
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Drawer width (px)</label>
            <InputNumber
              v-model="localSettings.drawerWidth"
              :min="250"
              :max="800"
              :step="10"
              showButtons
              class="w-32"
            />
          </div>
        </div>
      </div>

      <!-- Data Section -->
      <div class="space-y-4">
        <div class="flex items-center gap-2 pb-2 border-b border-surface-200 dark:border-surface-700">
          <i class="pi pi-refresh text-primary"></i>
          <h3 class="font-semibold text-surface-700 dark:text-surface-300">Data</h3>
        </div>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Auto-refresh</label>
            <ToggleSwitch v-model="localSettings.autoRefresh" />
          </div>
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Refresh interval (ms)</label>
            <InputNumber
              v-model="localSettings.refreshInterval"
              :min="1000"
              :max="60000"
              :step="1000"
              showButtons
              class="w-32"
            />
          </div>
        </div>
      </div>

      <!-- Privacy Section -->
      <div class="space-y-4">
        <div class="flex items-center gap-2 pb-2 border-b border-surface-200 dark:border-surface-700">
          <i class="pi pi-shield text-primary"></i>
          <h3 class="font-semibold text-surface-700 dark:text-surface-300">Privacy</h3>
        </div>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Redaction mode</label>
            <Select
              v-model="localSettings.defaultRedactionMode"
              :options="redactionOptions"
              optionLabel="label"
              optionValue="value"
              class="w-32"
            />
          </div>
        </div>
      </div>
    </div>
    
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button 
          label="Cancel" 
          variant="text"
          @click="close"
        />
        <Button 
          label="Save" 
          @click="save"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import ToggleSwitch from 'primevue/toggleswitch';
import Select from 'primevue/select';
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

const redactionOptions = [
  { label: 'Full', value: 'full' },
  { label: 'Partial', value: 'partial' },
  { label: 'Hash', value: 'hash' },
  { label: 'Length only', value: 'length' }
];

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
