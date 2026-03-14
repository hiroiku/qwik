import type { StaticGenerateRenderOptions } from '@builder.io/qwik-city/static';
import { type ServerAdapterOptions, viteAdapter } from '../../shared/vite';
import fs from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

/** @public */
export function cloudflareWorkerAdapter(opts: CloudflareWorkerAdapterOptions = {}): any {
  const env = process?.env;

  let serverOutDir: string | null = null;
  let entryWorkerFileName: string | null = null;

  // Secondary plugin: writes server/entry.worker.mjs after the SSR build so that
  // wrangler.jsonc can reference a stable entry path instead of the hashed chunk name.
  const workerOutputPlugin: Plugin = {
    name: 'vite-plugin-qwik-city-cloudflare-worker-output',
    enforce: 'post',
    apply: 'build',

    configResolved(config: ResolvedConfig) {
      if (config.build?.ssr) {
        serverOutDir = config.build.outDir;
      }
    },

    generateBundle(_options: any, bundles: any) {
      if (!serverOutDir) {
        return;
      }
      for (const fileName in bundles) {
        const chunk = bundles[fileName];
        if (chunk.type === 'chunk' && chunk.isEntry && chunk.name === 'entry.worker') {
          entryWorkerFileName = fileName;
        }
      }
    },

    async closeBundle() {
      if (!serverOutDir || !entryWorkerFileName) {
        return;
      }
      // Place server/entry.worker.mjs next to the project root (sibling of outDir).
      const workerDir = join(process.cwd(), 'server');
      await fs.promises.mkdir(workerDir, { recursive: true });

      const entryChunkAbsPath = join(serverOutDir, entryWorkerFileName);
      const relativePath = relative(workerDir, entryChunkAbsPath).replace(/\\/g, '/');
      const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;

      await fs.promises.writeFile(
        join(workerDir, 'entry.worker.mjs'),
        `export { default } from '${importPath}';\n`
      );
    },
  };

  return [
    viteAdapter({
      name: 'cloudflare-worker',
      origin: env?.ORIGIN ?? 'https://your.cloudflare.workers.dev',
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
    }),
    workerOutputPlugin,
  ];
}

/** @public */
export interface CloudflareWorkerAdapterOptions extends ServerAdapterOptions {
  /**
   * Manually add pathnames that should be treated as static paths and not SSR. For example, when
   * these pathnames are requested, their response should come from a static file, rather than a
   * server-side rendered response.
   */
  staticPaths?: string[];
}

/** @public */
export type { StaticGenerateRenderOptions };
