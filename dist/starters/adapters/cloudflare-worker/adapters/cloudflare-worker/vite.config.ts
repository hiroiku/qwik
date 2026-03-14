import { cloudflareWorkerAdapter } from "@builder.io/qwik-city/adapters/cloudflare-worker/vite";
import { extendConfig } from "@builder.io/qwik-city/vite";
import baseConfig from "../../vite.config";

export default extendConfig(baseConfig, () => {
  return {
    build: {
      rollupOptions: {
        input: ["src/entry.worker.tsx", "src/entry.ssr.tsx", "@qwik-city-plan"],
      },
    },
    plugins: [cloudflareWorkerAdapter()],
  };
});
