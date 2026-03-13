import type { StaticGenerateRenderOptions } from '@builder.io/qwik-city/static';
import { type ServerAdapterOptions, viteAdapter } from '../../shared/vite';

/**
 * Adapter for deploying Qwik City applications via `@cloudflare/vite-plugin`.
 *
 * Unlike `cloudflarePagesAdapter`, this adapter delegates build orchestration and dev-server
 * management entirely to the Cloudflare Vite Plugin. No `_worker.js` or `_routes.json` files are
 * generated; the Cloudflare Vite Plugin handles the output bundle directly.
 *
 * Usage in `vite.config.ts`:
 *
 * ```ts
 * import { qwikCity } from '@builder.io/qwik-city/vite';
 * import { qwikVite } from '@builder.io/qwik/optimizer';
 * import { cloudflare } from '@cloudflare/vite-plugin';
 * import { defineConfig } from 'vite';
 *
 * export default defineConfig({
 *   plugins: [
 *     qwikCity({ trailingSlash: false }),
 *     qwikVite(),
 *     cloudflare({ viteEnvironment: { name: 'ssr' } }),
 *   ],
 * });
 * ```
 *
 * @public
 */
export function cloudflareVitePluginAdapter(opts: CloudflareVitePluginAdapterOptions = {}): any {
  const env = process?.env;
  return viteAdapter({
    name: 'cloudflare-vite-plugin',
    origin: opts?.origin ?? env?.ORIGIN ?? 'https://yoursite.workers.dev',
    ssg: opts.ssg ?? null,
    staticPaths: opts.staticPaths,
    cleanStaticGenerated: true,

    config() {
      return {
        resolve: {
          conditions: ['webworker', 'worker'],
        },
        ssr: {
          target: 'webworker',
          noExternal: true,
          external: ['node:async_hooks'],
        },
        build: {
          ssr: true,
          rollupOptions: {
            output: {
              format: 'es',
              hoistTransitiveImports: false,
            },
          },
        },
        publicDir: false,
      };
    },

    // No generate hook: the Cloudflare Vite Plugin manages all output files.
    // `_worker.js` and `_routes.json` are not generated here.
  });
}

/** @public */
export interface CloudflareVitePluginAdapterOptions extends ServerAdapterOptions {
  /**
   * The origin URL used during SSG (static site generation). Defaults to the `ORIGIN` environment
   * variable or `https://yoursite.workers.dev`.
   */
  origin?: string;

  /** Manually add pathnames that should be treated as static paths and not SSR. */
  staticPaths?: string[];
}

/** @public */
export type { StaticGenerateRenderOptions };
