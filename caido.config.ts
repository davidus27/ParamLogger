import { defineConfig } from "@caido-community/dev";

export default defineConfig({
  id: "param-logger",
  name: "Param Logger",
  description: "Passively logs HTTP parameters from proxied traffic into a searchable parameter map",
  version: "0.1.1",
  author: {
    name: "David Drobny",
    email: "david.drobny@example.com",
  },
  plugins: [
    {
      kind: "frontend",
      id: "param-logger-frontend",
      name: "Param Logger Frontend",
      root: "packages/frontend",
      backend: {
        id: "param-logger-backend",
      },
    },
    {
      kind: "backend",
      id: "param-logger-backend",
      name: "Param Logger Backend",
      root: "packages/backend",
    },
  ],
});