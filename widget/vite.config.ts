import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  build: {
    lib: {
      entry: "src/index.tsx",
      name: "SasaganiWidget",
      fileName: () => "sasagani.js",
      formats: ["iife"],
    },
    outDir: "dist",
    minify: "terser",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
