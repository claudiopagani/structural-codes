/**
 * acquire-source: registra una fonte ufficiale in sources/sources.json.
 *
 * Calcola hash SHA-256 del PDF locale, registra metadati e data di
 * acquisizione. Il registro e' append-only: una fonte gia' registrata con lo
 * stesso sourceId non viene sovrascritta (sicurezza editoriale).
 *
 * Uso:
 *   node --experimental-strip-types scripts/acquire-source.ts --source <sourceId>
 * Le fonti note sono dichiarate in KNOWN_SOURCES qui sotto.
 */
import { writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { sha256OfFile } from "../src/lib/hash.ts";
import { sourceRegistrySchema, type SourceRegistry } from "../src/schema/source.schema.ts";
import { SOURCES_FILE, RAW_SOURCES_DIR, readJsonFile } from "./lib/walk-content.ts";

interface KnownSource {
    sourceId: string;
    authority: string;
    title: string;
    actNumber: string;
    actDate: string;
    gazette: string;
    gazetteSupplement?: string;
    url: string;
    localFile: string;
}

const KNOWN_SOURCES: KnownSource[] = [
    {
        sourceId: "gu-so8-2018-ntc",
        authority: "Gazzetta Ufficiale della Repubblica Italiana",
        title:
            "D.M. 17 gennaio 2018 — Aggiornamento delle «Norme tecniche per le costruzioni»",
        actNumber: "D.M. 17 gennaio 2018",
        actDate: "2018-01-17",
        gazette: "GU n. 42 del 20-02-2018",
        gazetteSupplement: "S.O. n. 8",
        url: "https://www.gazzettaufficiale.it/eli/gu/2018/02/20/42/so/8/sg/pdf",
        localFile: "raw-sources/ntc2018/gu-42-so8-2018-02-20.pdf",
    },
    {
        sourceId: "circ-7-2019",
        authority: "Ministero delle Infrastrutture e dei Trasporti — Consiglio Superiore dei Lavori Pubblici",
        title:
            "Circolare 21 gennaio 2019 n. 7 — Istruzioni per l'applicazione dell'«Aggiornamento delle Norme tecniche per le costruzioni» di cui al D.M. 17 gennaio 2018",
        actNumber: "Circolare 21 gennaio 2019, n. 7",
        actDate: "2019-01-21",
        gazette: "GU n. 35 del 11-02-2019",
        gazetteSupplement: "S.O. n. 5",
        url: "https://www.gazzettaufficiale.it/eli/gu/2019/02/11/35/so/5/sg/pdf",
        localFile: "raw-sources/circ2019/circolare-7-2019.pdf",
    },
    {
        sourceId: "gu-sg69-2023-dm-ntc-amendment",
        authority: "Gazzetta Ufficiale della Repubblica Italiana",
        title:
            "D.M. 9 marzo 2023 — Modifiche ed integrazioni al decreto 17 gennaio 2018, recante «Aggiornamento delle norme tecniche per le costruzioni»",
        actNumber: "D.M. 9 marzo 2023",
        actDate: "2023-03-09",
        gazette: "GU n. 69 del 22-03-2023",
        url: "https://www.gazzettaufficiale.it/eli/gu/2023/03/22/69/sg/pdf",
        localFile: "raw-sources/dm2023/gu-69-2023-03-22.pdf",
    },
];

function parseArgs(argv: string[]): { sourceId: string } {
    const idx = argv.indexOf("--source");
    if (idx === -1 || argv[idx + 1] === undefined) {
        console.error("Uso: acquire-source --source <sourceId>");
        console.error(`Fonti note: ${KNOWN_SOURCES.map((s) => s.sourceId).join(", ")}`);
        process.exit(2);
    }
    return { sourceId: argv[idx + 1]! };
}

const { sourceId } = parseArgs(process.argv);
const known = KNOWN_SOURCES.find((s) => s.sourceId === sourceId);
if (!known) {
    console.error(`Fonte sconosciuta: "${sourceId}". Fonti note: ${KNOWN_SOURCES.map((s) => s.sourceId).join(", ")}`);
    process.exit(2);
}

const pdfPath = join(RAW_SOURCES_DIR, "..", known.localFile);
let pdfStats;
try {
    pdfStats = await stat(pdfPath);
} catch {
    console.error(`PDF non trovato: ${known.localFile}`);
    console.error("Copia il PDF sorgente nel percorso indicato e riprova.");
    process.exit(2);
}

let registry: SourceRegistry;
try {
    const existing = await readJsonFile(SOURCES_FILE);
    registry = sourceRegistrySchema.parse(existing);
} catch {
    registry = { registryVersion: 1, sources: [] };
}

if (registry.sources.some((s) => s.sourceId === sourceId)) {
    console.error(`Fonte "${sourceId}" gia' registrata. Il registro e' append-only: rifiutato.`);
    process.exit(2);
}

console.log(`Calcolo SHA-256 di ${known.localFile} (${(pdfStats.size / 1e6).toFixed(1)} MB)...`);
const pdfSha256 = await sha256OfFile(pdfPath);

registry.sources.push({
    sourceId: known.sourceId,
    authority: known.authority,
    title: known.title,
    actNumber: known.actNumber,
    actDate: known.actDate,
    gazette: known.gazette,
    ...(known.gazetteSupplement ? { gazetteSupplement: known.gazetteSupplement } : {}),
    url: known.url,
    localFile: known.localFile,
    pdfSha256,
    pdfBytes: pdfStats.size,
    acquiredAt: new Date().toISOString(),
    manualVerification: { by: null, at: null },
});

await writeFile(SOURCES_FILE, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
console.log(`Registrata fonte "${sourceId}" con hash ${pdfSha256}`);
console.log(`Aggiornato: sources/sources.json`);
