/**
 * This is the base config for vite.
 * When building, the adapter config is used which loads this file and extends it.
 *
 * For Cloudflare Workers dev mode, @cloudflare/vite-plugin provides workerd-based SSR.
 * The cloudflare() plugin is only loaded during `vite dev` (serve command).
 */
import { defineConfig, type Plugin, type UserConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Worker environment override plugin for dev mode.
 *
 * When @cloudflare/vite-plugin runs SSR in the workerd environment, qwikVite()
 * does not yet fully support Vite 7 Environment API and may set isBrowser=true
 * in the SSR (worker) environment. This plugin corrects that in serve mode.
 *
 * Also replaces @builder.io/qwik/preloader (a browser-only module that uses
 * `document`) with a noop in the SSR environment.
 */
const qwikWorkerEnvPlugin: Plugin = {
  name: "qwik-worker-env",
  enforce: "pre",
  apply: "serve",
  resolveId(id) {
    if ((this as any).environment?.name !== "ssr") {
      return;
    }
    if (id === "@builder.io/qwik/build") {
      return "\0qwik-build-ssr";
    }
    if (id === "@builder.io/qwik/preloader") {
      return "\0qwik-preloader-noop";
    }
  },
  load(id) {
    if (id === "\0qwik-build-ssr") {
      return `// @qwik-build (Worker/SSR environment override)
export const isBrowser = false;
export const isServer = true;
export const isDev = true;
`;
    }
    if (id === "\0qwik-preloader-noop") {
      return `// @builder.io/qwik/preloader noop for Worker environment
export const p = () => {};
export const g = () => {};
export const h = () => {};
export const l = () => {};
`;
    }
  },
};

export default defineConfig(async ({ command }): Promise<UserConfig> => {
  const devPlugins: Plugin[] = [];

  if (command === "serve") {
    // In dev mode, use @cloudflare/vite-plugin to run SSR in the workerd runtime.
    // This provides accurate emulation of the Cloudflare Workers environment including
    // Bindings (vars, Secrets, KV, D1, R2, etc.) without needing getPlatformProxy().
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    devPlugins.push(
      cloudflare({
        // wrangler.jsonc main points to the built file. Override it for dev
        // so that Vite serves the source file directly.
        config: { main: "./src/entry.worker.tsx" },
        // Merge the Worker environment into the "ssr" Vite environment so that
        // qwikVite() and qwikCity() can process SSR requests from workerd.
        viteEnvironment: { name: "ssr" },
      }),
    );
  }

  return {
    environments: {
      ssr: {
        // Exclude @builder.io/qwik packages from esbuild pre-optimization in the
        // SSR environment. The qwikVite() resolveId hook must handle these so that
        // virtual modules like @qwik-client-manifest are correctly resolved.
        optimizeDeps: {
          exclude: ["@builder.io/qwik", "@builder.io/qwik/server"],
        },
      },
    },
    plugins: [
      qwikWorkerEnvPlugin,
      ...devPlugins,
      qwikCity({
        // Disable Qwik City's built-in SSR dev server; @cloudflare/vite-plugin
        // provides workerd-based SSR instead.
        devSsrServer: false,
      }),
      qwikVite({
        // Disable Qwik's built-in SSR dev server for the same reason.
        devSsrServer: false,
      }),
      tsconfigPaths({ root: "." }),
    ],
    server: {
      headers: {
        // Don't cache the server response in dev mode
        "Cache-Control": "public, max-age=0",
      },
    },
    preview: {
      headers: {
        // Do cache the server response in preview (non-adapter production build)
        "Cache-Control": "public, max-age=600",
      },
    },
  };
});
