import { defineConfig } from "@caido-community/dev";

export default defineConfig({
  id: "param-inventory",
  name: "Parameter Inventory",
  description: "Passively inventories HTTP parameters from proxied traffic into a searchable parameter map",
  version: "0.1.0",
  author: {
    name: "David Drobny",
    email: "david.drobny@example.com",
  },
  plugins: [
    {
      kind: "frontend",
      id: "param-inventory-frontend",
      name: "Parameter Inventory Frontend",
      root: "packages/frontend",
      backend: {
        id: "param-inventory-backend",
      },
    },
    {
      kind: "backend",
      id: "param-inventory-backend",
      name: "Parameter Inventory Backend",
      root: "packages/backend",
    },
  ],
});