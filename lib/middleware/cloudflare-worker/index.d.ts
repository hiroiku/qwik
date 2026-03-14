import type { ServerRenderOptions } from '@builder.io/qwik-city/middleware/request-handler';

/** @public */
export declare function createQwikCity(opts: QwikCityCloudflareWorkerOptions): (request: Request, env: PlatformCloudflareWorker['env'], ctx: PlatformCloudflareWorker['ctx']) => Promise<Response>;

/** @public */
export declare interface PlatformCloudflareWorker {
    request: Request;
    env: Record<string, any>;
    ctx: {
        waitUntil: (promise: Promise<any>) => void;
    };
}

/** @public */
export declare interface QwikCityCloudflareWorkerOptions extends ServerRenderOptions {
}

export { }
