"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/qwik-city/src/adapters/cloudflare-worker/vite/index.ts
var index_exports = {};
__export(index_exports, {
  cloudflareWorkerAdapter: () => cloudflareWorkerAdapter
});
module.exports = __toCommonJS(index_exports);
var import_vite = require("../../shared/vite/index.cjs");
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = require("node:path");
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
      const workerDir = (0, import_node_path.join)(process.cwd(), "server");
      await import_node_fs.default.promises.mkdir(workerDir, { recursive: true });
      const entryChunkAbsPath = (0, import_node_path.join)(serverOutDir, entryWorkerFileName);
      const relativePath = (0, import_node_path.relative)(workerDir, entryChunkAbsPath).replace(/\\/g, "/");
      const importPath = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
      await import_node_fs.default.promises.writeFile(
        (0, import_node_path.join)(workerDir, "entry.worker.mjs"),
        `export { default } from '${importPath}';
`
      );
    }
  };
  return [
    (0, import_vite.viteAdapter)({
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cloudflareWorkerAdapter
});
