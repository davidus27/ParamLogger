/**
 * Frontend plugin entry point for Parameter Inventory
 */

import { createApp } from 'vue';
import App from './views/App.vue';
import type { Caido } from './mock-caido-sdk';
import { mockCaido } from './mock-caido-sdk';

// Import PrimeVue
import PrimeVue from 'primevue/config';
import 'primeicons/primeicons.css';

// Import Tailwind CSS
import './style.css';

export function init(caido?: Caido): void {
  console.log("Parameter Inventory frontend loaded");

  // Use mock SDK if no real SDK provided
  const sdk = caido || mockCaido;

  // Create Vue app
  const app = createApp(App);
  app.use(PrimeVue, { 
    theme: 'none' // We'll use custom CSS for styling
  });

  // Provide Caido SDK to the app
  app.provide('caido', sdk);

  // Register the plugin page
  sdk.navigation.addPage("/param-inventory", {
    body: app
  });

  // Add sidebar entry
  sdk.sidebar.registerItem("Parameter Inventory", "/param-inventory", {
    icon: "pi pi-list"
  });
}

// For development: initialize with mock SDK
if (import.meta.env.DEV) {
  document.addEventListener('DOMContentLoaded', () => {
    // In development, mount directly to the app element
    const appElement = document.getElementById('app');
    if (appElement) {
      const app = createApp(App);
      app.use(PrimeVue, { 
        theme: 'none'
      });
      app.provide('caido', mockCaido);
      app.mount(appElement);
    }
  });
}