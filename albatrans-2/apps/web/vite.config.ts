import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll("\\", "/");
          if (normalized.includes("/node_modules/@supabase/")) return "vendor-supabase";
          if (normalized.includes("/node_modules/react") || normalized.includes("/node_modules/scheduler")) return "vendor-react";
          if (normalized.includes("/pages/transport/") || normalized.includes("/data/transport-")) return "transport-core";
          if (normalized.includes("/pages/execution/") || normalized.includes("/data/execution-")) return "transport-execution";
          if (normalized.includes("/pages/master-data/") || normalized.includes("/data/master-data-")) return "master-data";
          if (normalized.includes("/pages/superadmin/") || normalized.includes("/data/organization-") || normalized.includes("/data/platform-") || normalized.includes("/layouts/SuperadminLayout")) return "superadmin";
          if (normalized.includes("/auth/") || normalized.includes("/pages/LoginPage") || normalized.includes("/pages/PasswordPages") || normalized.includes("/pages/ConfigurationPage") || normalized.includes("/pages/PortalPage")) return "auth-public";
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts"
  },
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    port: 4173,
    strictPort: true
  }
});
