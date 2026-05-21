import { createApp } from 'vue';
import App from './views/App.vue';
import type { Caido } from '@caido/sdk-frontend';
import type { InventoryBackendAPI, InventoryBackendEvents } from '@param-inventory/shared';

import './style.css';

export function init(caido: Caido<InventoryBackendAPI, InventoryBackendEvents>): void {
  const container = document.createElement("div");
  container.id = "param-inventory-root";
  container.style.width = "100%";
  container.style.height = "100%";

  const app = createApp(App);
  app.provide('caido', caido);
  app.mount(container);

  caido.navigation.addPage("/param-inventory", {
    body: container
  });

  caido.sidebar.registerItem("Parameter Inventory", "/param-inventory", {
    icon: "fas fa-list"
  });
}

if (import.meta.env.DEV) {
  import('./mock-caido-sdk').then(({ mockCaido, simulateBatchUpdate }) => {
    // Expose testing functions globally
    (window as any).simulateBatchUpdate = simulateBatchUpdate;
    
    const mount = () => {
      const appElement = document.getElementById('app');
      if (appElement) {
        const app = createApp(App);
        app.provide('caido', mockCaido);
        app.mount(appElement);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount);
    } else {
      mount();
    }
  });
}
