/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for Cloudflare Workers when using @cloudflare/vite-plugin.
 *
 * The Cloudflare Vite Plugin manages the build pipeline and dev server.
 * This file is the Worker entry point referenced by wrangler.jsonc.
 *
 * Learn more:
 * - https://developers.cloudflare.com/workers/
 * - https://github.com/cloudflare/workers-sdk/tree/main/packages/vite-plugin
 */
import {
  createQwikCity,
  type PlatformCloudflarePages,
} from "@builder.io/qwik-city/middleware/cloudflare-pages";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";

declare global {
  type QwikCityPlatform = PlatformCloudflarePages;
}

const onRequest = createQwikCity({ render, qwikCityPlan });

export default {
  async fetch(
    request: Request,
    env: Record<string, unknown>,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return onRequest(request, env, ctx);
  },
} satisfies ExportedHandler;
