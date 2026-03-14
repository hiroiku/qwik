// packages/qwik-city/src/adapters/cloudflare-worker/vite/index.ts
import { viteAdapter } from "../../shared/vite/index.mjs";
import fs from "node:fs";
import { join, relative } from "node:path";
function cloudflareWorkerAdapter(opts = {}) {
  const env = process == null ? void 0 : process.env;
  let serverOutDir = null;
  let entryWorkerFileName = null;
  const workerOutputPlugin = {
    name: "vite-plugin-qwik-city-cloudflare-worker-output",
    enforce: "post",
    apply: "build",
    configResolved(config) {
      var _a;
      if ((_a = config.build) == null ? void 0 : _a.ssr) {
        serverOutDir = config.build.outDir;
      }
    },
    generateBundle(_options, bundles) {
      if (!serverOutDir) {
        return;
      }
      for (const fileName in bundles) {
        const chunk = bundles[fileName];
        if (chunk.type === "chunk" && chunk.isEntry && chunk.name === "entry.worker") {
          entryWorkerFileName = fileName;
        }
      }
    },
    async closeBundle() {
      if (!serverOutDir || !entryWorkerFileName) {
        return;
      }
      const workerDir = join(process.cwd(), "server");
      await fs.promises.mkdir(workerDir, { recursive: true });
      const entryChunkAbsPath = join(serverOutDir, entryWorkerFileName);
      const relativePath = relative(workerDir, entryChunkAbsPath).replace(/\\/g, "/");
      const importPath = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
      await fs.promises.writeFile(
        join(workerDir, "entry.worker.mjs"),
        `export { default } from '${importPath}';
`
      );
    }
  };
  return [
    viteAdapter({
      name: "cloudflare-worker",
      origin: (env == null ? void 0 : env.ORIGIN) ?? "https://your.cloudflare.workers.dev",
      ssg: opts.ssg ?? null,
      staticPaths: opts.staticPaths,
      cleanStaticGenerated: true,
      config() {
        return {
          resolve: {
            conditions: ["webworker", "worker"]
          },
          ssr: {
            target: "webworker",
            noExternal: true,
            external: ["node:async_hooks"]
          },
          build: {
            ssr: true,
            rollupOptions: {
              output: {
                format: "es",
                hoistTransitiveImports: false
              }
            }
          },
          publicDir: false
        };
      }
    }),
    workerOutputPlugin
  ];
}
export {
  cloudflareWorkerAdapter
};
