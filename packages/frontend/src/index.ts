/**
 * Frontend plugin entry point for Parameter Inventory
 */

import { createApp } from 'vue';
import App from './views/App.vue';
import type { Caido } from '@caido/sdk-frontend';
import type { InventoryBackendAPI, InventoryBackendEvents } from '@param-inventory/shared';

import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { Classic } from '@caido/primevue';
import 'primeicons/primeicons.css';

import './style.css';

export function init(caido: Caido<InventoryBackendAPI, InventoryBackendEvents>): void {

  const container = document.createElement("div");
  container.id = "param-inventory-root";
  container.style.width = "100%";
  container.style.height = "100%";

  const app = createApp(App);
  app.use(PrimeVue, { unstyled: true, pt: Classic });
  app.use(ToastService);
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
  // Only import mock in development mode
  import('./mock-caido-sdk').then(({ mockCaido }) => {
    document.addEventListener('DOMContentLoaded', () => {
      const appElement = document.getElementById('app');
      if (appElement) {
      const app = createApp(App);
      app.use(PrimeVue, { unstyled: true, pt: Classic });
      app.use(ToastService);
      app.provide('caido', mockCaido);
      app.mount(appElement);
      }
    });
  });
}