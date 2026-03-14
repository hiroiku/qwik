// packages/qwik-city/src/middleware/cloudflare-worker/index.ts
import {
  mergeHeadersCookies,
  requestHandler,
  _TextEncoderStream_polyfill
} from "../request-handler/index.mjs";
import { _deserializeData, _serializeData, _verifySerializable } from "@builder.io/qwik";
import { setServerPlatform } from "@builder.io/qwik/server";
function createQwikCity(opts) {
  try {
    new globalThis.TextEncoderStream();
  } catch (e) {
    globalThis.TextEncoderStream = _TextEncoderStream_polyfill;
  }
  const qwikSerializer = {
    _deserializeData,
    _serializeData,
    _verifySerializable
  };
  if (opts.manifest) {
    setServerPlatform(opts.manifest);
  }
  async function onCloudflareWorkerFetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const serverRequestEv = {
        mode: "server",
        locale: void 0,
        url,
        request,
        env: {
          get(key) {
            return env[key];
          }
        },
        getWritableStream: (status, headers, cookies, resolve) => {
          const { readable, writable } = new TransformStream();
          const response = new Response(readable, {
            status,
            headers: mergeHeadersCookies(headers, cookies)
          });
          resolve(response);
          return writable;
        },
        getClientConn: () => {
          return {
            ip: request.headers.get("CF-connecting-ip") || "",
            country: request.headers.get("CF-IPCountry") || ""
          };
        },
        platform: {
          request,
          env,
          ctx
        }
      };
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
      return new Response(null, {
        status: 404,
        headers: { "X-Not-Found": url.pathname }
      });
    } catch (e) {
      console.error(e);
      return new Response(String(e || "Error"), {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Error": "cloudflare-worker" }
      });
    }
  }
  return onCloudflareWorkerFetch;
}
export {
  createQwikCity
};
