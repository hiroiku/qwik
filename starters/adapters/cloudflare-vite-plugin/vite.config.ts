import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    qwikCity({ trailingSlash: false }),
    qwikVite(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
  ],
});
