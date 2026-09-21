import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    fs: {
      allow: [
        fileURLToPath(new URL(".", import.meta.url)),
        fileURLToPath(
          new URL("../miniapp/src/static/h5/fonts", import.meta.url),
        ),
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/echarts") ||
            id.includes("node_modules/zrender")
          )
            return "charts";
          if (
            id.includes("node_modules/element-plus") ||
            id.includes("node_modules/@element-plus")
          )
            return "element-plus";
        },
      },
    },
  },
});
