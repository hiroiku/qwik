import type {
  ServerRenderOptions,
  ServerRequestEvent,
} from '@builder.io/qwik-city/middleware/request-handler';
import {
  mergeHeadersCookies,
  requestHandler,
  _TextEncoderStream_polyfill,
} from '@builder.io/qwik-city/middleware/request-handler';
import { _deserializeData, _serializeData, _verifySerializable } from '@builder.io/qwik';
import { setServerPlatform } from '@builder.io/qwik/server';

// @builder.io/qwik-city/middleware/cloudflare-worker

/** @public */
export function createQwikCity(opts: QwikCityCloudflareWorkerOptions) {
  try {
    // https://developers.cloudflare.com/workers/configuration/compatibility-dates/#streams-constructors
    // this will throw if CF compatibility_date < 2022-11-30
    new globalThis.TextEncoderStream();
  } catch (e) {
    // @ts-ignore
    globalThis.TextEncoderStream = _TextEncoderStream_polyfill;
  }
  const qwikSerializer = {
    _deserializeData,
    _serializeData,
    _verifySerializable,
  };
  if (opts.manifest) {
    setServerPlatform(opts.manifest);
  }
  async function onCloudflareWorkerFetch(
    request: Request,
    env: PlatformCloudflareWorker['env'],
    ctx: PlatformCloudflareWorker['ctx']
  ): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Note: Static assets are handled by Cloudflare Workers Static Assets
      // before this Worker is invoked. No isStaticPath check is needed.

      const serverRequestEv: ServerRequestEvent<Response> = {
        mode: 'server',
        locale: undefined,
        url,
        request,
        env: {
          get(key) {
            return (env as Record<string, string>)[key];
          },
        },
        getWritableStream: (status, headers, cookies, resolve) => {
          const { readable, writable } = new TransformStream<Uint8Array>();
          const response = new Response(readable, {
            status,
            headers: mergeHeadersCookies(headers, cookies),
          });
          resolve(response);
          return writable;
        },
        getClientConn: () => {
          return {
            ip: request.headers.get('CF-connecting-ip') || '',
            country: request.headers.get('CF-IPCountry') || '',
          };
        },
        platform: {
          request,
          env,
          ctx,
        },
      };

      // send request to qwik city request handler
      const handledResponse = await requestHandler(serverRequestEv, opts, qwikSerializer);
      if (handledResponse) {
        handledResponse.completion.then((v) => {
          if (v) {
            console.error(v);
          }
        });
        const response = await handledResponse.response;
        if (response) {
          return response;
        }
      }

      // qwik city did not have a route for this request
      // Cloudflare Workers with @cloudflare/vite-plugin does not use pre-generated 404 pages;
      // the Qwik City SSR render handles 404 responses via routeLoaders and layouts.
      return new Response(null, {
        status: 404,
        headers: { 'X-Not-Found': url.pathname },
      });
    } catch (e: any) {
      console.error(e);
      return new Response(String(e || 'Error'), {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Error': 'cloudflare-worker' },
      });
    }
  }

  return onCloudflareWorkerFetch;
}

/** @public */
export interface QwikCityCloudflareWorkerOptions extends ServerRenderOptions {}

/** @public */
export interface PlatformCloudflareWorker {
  request: Request;
  env: Record<string, any>;
  ctx: { waitUntil: (promise: Promise<any>) => void };
}
