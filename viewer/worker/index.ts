import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import corpusManifest from "structural-codes/corpus/manifest.json" with { type: "json" };
import sourceRegistry from "structural-codes/sources/registry" with { type: "json" };

type DocumentId = keyof typeof corpusManifest.documents;

const sourceUrlById = new Map(
  sourceRegistry.works.flatMap((work) =>
    work.manifestations.map((manifestation) => [
      manifestation.sourceId,
      manifestation.officialUrl,
    ] as const),
  ),
);

function officialPdfUrl(document: DocumentId) {
  const sourceId = corpusManifest.documents[document].sourceId;
  const sourceUrl = sourceUrlById.get(sourceId);
  if (!sourceUrl) throw new Error(`Source registry privo di ${sourceId}`);
  return sourceUrl;
}

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
      const documentId = url.searchParams.get("document");
      if (documentId !== "ntc2018" && documentId !== "circ2019") {
        return new Response("Documento non valido", { status: 400 });
      }

      const headers = new Headers();
      const range = request.headers.get("range");
      if (range) headers.set("range", range);
      const upstream = await fetch(officialPdfUrl(documentId), { headers });
      const responseHeaders = new Headers({
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${documentId}.pdf"`,
        "cache-control": "public, max-age=86400",
        "x-content-type-options": "nosniff",
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
