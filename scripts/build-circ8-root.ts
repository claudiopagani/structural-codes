import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ8-root-editorial-profile-0.1.0";
const value = "C8 COSTRUZIONI ESISTENTI";

const id = "urn:structural-codes:it:unit:circ2019:c8";
const evidence = {
    sourceId,
    pdfPage: 253,
    printedPage: "249",
    region: { coordinateSystem: "pdf-points-top-left", x: 73.9, y: 55, width: 450, height: 730 },
    extraction: { method: "manual-transcription", tool: "codex-render-transcription", toolVersion: profile },
    transformations: [{ operation: "manual-correction", ruleVersion: profile, note: "Titolo del capitolo trascritto direttamente dal render ufficiale rasterizzato; il layer testuale della pagina non contiene il titolo." }],
    rawSha256: sha256OfText(value),
    normalizedSha256: sha256OfText(value),
};

const unit = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id,
    workId,
    expressionId,
    kind: "section",
    numbering: { official: "C8", sortKey: "008" },
    title: "COSTRUZIONI ESISTENTI",
    titleBlockId: `${id}#block-heading`,
    hierarchy: { parentId: null, ancestorIds: [], position: 8 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-10" },
    blocks: [{ blockId: `${id}#block-heading`, kind: "heading", origin: "official", text: { raw: value, normalized: value, normalizationVersion: profile, inline: [{ kind: "text", value }] }, evidence }],
    citations: [],
    relations: [],
    assets: { formulaIds: [], tableIds: [], figureIds: [] },
    workflow: {
        status: "extracted",
        createdBy: { actorId: "codex:circ8:root", kind: "automated-agent", toolVersion: profile },
        createdAt: "2026-08-10T00:00:00Z",
        reviews: [],
        openIssues: [
            { issueId: "circ2019-c8-source-review", type: "normalization-review", severity: "blocking", note: "Titolo confrontato con il render ufficiale; la revisione umana indipendente resta obbligatoria prima della pubblicazione." },
        ],
    },
};

await mkdir(unitDirectory, { recursive: true });
await writeFile(join(unitDirectory, "c8.json"), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
console.log("generated Circ C8 root unit for PDF page 253");
