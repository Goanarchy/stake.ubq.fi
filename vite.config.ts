import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { UserConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  css: {
    devSourcemap: true,
  },
  build: {
    cssCodeSplit: false,
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (normalized.includes("/node_modules/")) {
            if (normalized.includes("/react/") || normalized.includes("/react-dom/") || normalized.includes("/scheduler/")) {
              return "vendor-react";
            }
            if (normalized.includes("/@tanstack/react-query/")) {
              return "vendor-query";
            }
            if (
              normalized.includes("/wagmi/") ||
              normalized.includes("/viem/") ||
              normalized.includes("/@wagmi/") ||
              normalized.includes("/@walletconnect/") ||
              normalized.includes("/@coinbase/")
            ) {
              return "vendor-wallet";
            }
            return "vendor-misc";
          }
        },
      },
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["secp256k1"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
}) as UserConfig;
