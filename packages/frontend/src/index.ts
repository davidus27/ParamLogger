/**
 * Frontend plugin entry point for Parameter Inventory
 */

import { createApp } from 'vue';
import App from './views/App.vue';
import type { Caido } from './mock-caido-sdk';
import { mockCaido } from './mock-caido-sdk';

import PrimeVue from 'primevue/config';
import 'primeicons/primeicons.css';

import './style.css';

export function init(caido?: Caido): void {
  const sdk = caido || mockCaido;

  const container = document.createElement("div");
  container.id = "param-inventory-root";
  container.style.width = "100%";
  container.style.height = "100%";

  const app = createApp(App);
  app.use(PrimeVue, { theme: 'none' });
  app.provide('caido', sdk);
  app.mount(container);

  sdk.navigation.addPage("/param-inventory", {
    body: container
  });

  sdk.sidebar.registerItem("Parameter Inventory", "/param-inventory", {
    icon: "fas fa-list"
  });
}

if (import.meta.env.DEV) {
  document.addEventListener('DOMContentLoaded', () => {
    const appElement = document.getElementById('app');
    if (appElement) {
      const app = createApp(App);
      app.use(PrimeVue, { theme: 'none' });
      app.provide('caido', mockCaido);
      app.mount(appElement);
    }
  });
}