/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for Cloudflare Workers when building for production.
 * This adapter integrates with @cloudflare/vite-plugin for both dev and production.
 *
 * Key differences from the cloudflare-pages adapter:
 * - Static assets are served by Cloudflare Workers Static Assets (not _routes.json)
 * - The entry uses `export default { fetch }` instead of `export { fetch }`
 * - No _worker.js generation; wrangler.jsonc points to server/entry.worker.mjs
 *
 * Learn more about the Cloudflare Workers integration here:
 * - https://qwik.dev/docs/deployments/cloudflare-workers/
 * - https://developers.cloudflare.com/workers/vite-plugin/
 *
 */
import {
  createQwikCity,
  type PlatformCloudflareWorker,
} from "@builder.io/qwik-city/middleware/cloudflare-worker";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";

declare global {
  type QwikCityPlatform = PlatformCloudflareWorker;
}

const fetch: ReturnType<typeof createQwikCity> = createQwikCity({
  render,
  qwikCityPlan,
});

export default { fetch };
