import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  envDir: mode === "test" ? "./src/test" : ".",
  plugins: [react()],
  optimizeDeps: { exclude: ["pyodide"] },
  worker: { format: "es" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
    },
  },
}));
