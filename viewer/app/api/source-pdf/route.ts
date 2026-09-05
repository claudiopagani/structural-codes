import corpusManifest from "structural-codes/corpus/manifest.json" with { type: "json" };
import sourceRegistry from "structural-codes/sources/registry" with { type: "json" };

type DocumentId = keyof typeof corpusManifest.documents;

const pdfEnabled =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_VIEWER_DEBUG_PDF === "true";

const sourceUrlById = new Map(
  sourceRegistry.works.flatMap((work) =>
    work.manifestations.map((manifestation) => [
      manifestation.sourceId,
      manifestation.officialUrl,
    ] as const),
  ),
);

function officialPdfUrl(documentId: DocumentId) {
  const sourceId = corpusManifest.documents[documentId].sourceId;
  const sourceUrl = sourceUrlById.get(sourceId);
  if (!sourceUrl) throw new Error(`Source registry privo di ${sourceId}`);
  return sourceUrl;
}

export async function GET(request: Request) {
  const documentId = new URL(request.url).searchParams.get("document");
  if (documentId !== "ntc2018" && documentId !== "circ2019") {
    return new Response("Documento non valido", { status: 400 });
  }
  if (!pdfEnabled) {
    return new Response("PDF ufficiale disponibile solo in locale/debug", { status: 404 });
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
