import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy: when VITE_API_BASE is empty the app calls same-origin "/api/...",
// and this proxy forwards "/api" to your backend so you don't need CORS in dev.
// In production, either serve this build behind the same origin as the API,
// or set VITE_API_BASE to your backend URL (and enable CORS on the backend).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const backend = env.VITE_DEV_PROXY_TARGET || "http://localhost:8787";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: env.VITE_API_BASE
        ? undefined // base is absolute -> no proxy needed
        : { "/api": { target: backend, changeOrigin: true } },
    },
  };
});
