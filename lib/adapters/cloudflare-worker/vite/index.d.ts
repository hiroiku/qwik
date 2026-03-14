import { ServerAdapterOptions } from '../../shared/vite';
import type { StaticGenerateRenderOptions } from '@builder.io/qwik-city/static';

/** @public */
export declare function cloudflareWorkerAdapter(opts?: CloudflareWorkerAdapterOptions): any;

/** @public */
export declare interface CloudflareWorkerAdapterOptions extends ServerAdapterOptions {
    /**
     * Manually add pathnames that should be treated as static paths and not SSR. For example, when
     * these pathnames are requested, their response should come from a static file, rather than a
     * server-side rendered response.
     */
    staticPaths?: string[];
}

export { StaticGenerateRenderOptions }

export { }
