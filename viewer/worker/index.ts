/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

const sourcePdfs = {
  ntc2018:
    "https://www.gazzettaufficiale.it/eli/gu/2018/02/20/42/so/8/sg/pdf",
  circ2019:
    "https://www.gazzettaufficiale.it/eli/gu/2019/02/11/35/so/5/sg/pdf",
} as const;

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  DB: unknown;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/source-pdf") {
      const document = url.searchParams.get("document");
      if (document !== "ntc2018" && document !== "circ2019") {
        return new Response("Documento non valido", { status: 400 });
      }

      const headers = new Headers();
      const range = request.headers.get("range");
      if (range) headers.set("range", range);
      const upstream = await fetch(sourcePdfs[document], { headers });
      const responseHeaders = new Headers({
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${document}.pdf"`,
        "cache-control": "public, max-age=86400",
      });
      for (const name of [
        "accept-ranges",
        "content-length",
        "content-range",
        "etag",
        "last-modified",
      ]) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
