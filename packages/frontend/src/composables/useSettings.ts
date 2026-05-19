import { ref, reactive } from 'vue';
import type { FrontendSettings, InventoryBackendAPI, InventoryBackendEvents } from '@param-inventory/shared';
import type { Caido } from '@caido/sdk-frontend';

const STORAGE_KEY = 'param-inventory-settings';

const defaultSettings: FrontendSettings = {
  filters: {},
  tableColumnWidths: {},
  drawerWidth: 380,
  treePanelWidth: 280,
  autoRefresh: true,
  refreshInterval: 5000,
  defaultRedactionMode: 'partial',
};

export function useSettings(caido?: Caido<InventoryBackendAPI, InventoryBackendEvents>) {
  const settings = reactive<FrontendSettings>({ ...defaultSettings });
  const isLoaded = ref(false);

  async function loadSettings() {
    try {
      const stored = caido
        ? await caido.storage.get(STORAGE_KEY)
        : localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        Object.assign(settings, { ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.warn('Failed to load settings, using defaults:', error);
    } finally {
      isLoaded.value = true;
    }
  }

  async function saveSettings(newSettings?: Partial<FrontendSettings>) {
    if (newSettings) {
      Object.assign(settings, newSettings);
    }
    try {
      const serialized = JSON.stringify(settings);
      if (caido) {
        await caido.storage.set(STORAGE_KEY, serialized);
      } else {
        localStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  loadSettings();

  return {
    settings,
    isLoaded,
    saveSettings,
    loadSettings,
  };
}
