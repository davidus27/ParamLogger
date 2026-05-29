import { defineConfig } from "@caido-community/dev";

export default defineConfig({
  id: "param-logger",
  name: "Param Logger",
  description: "Passively logs HTTP parameters from proxied traffic into a searchable parameter map",
  version: "0.1.4",
  author: {
    name: "David Drobny",
    email: "david.drobny123@gmail.com",
    url: "https://github.com/davidus27",
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