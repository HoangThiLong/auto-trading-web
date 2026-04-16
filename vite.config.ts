import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      // Proxy MEXC contract API calls to bypass CORS
      '/api/v1/contract': {
        target: 'https://contract.mexc.com',
        changeOrigin: true,
        secure: true,
      },
      // Proxy MEXC private API calls (futures account/order)
      '/api/v1/private': {
        target: 'https://contract.mexc.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
