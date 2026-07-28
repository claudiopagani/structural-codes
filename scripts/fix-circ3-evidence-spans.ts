import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const unitPath = resolve(
    repoRoot,
    "corpus/units/circ2019/c3.3.8.1.3.json",
);

async function evidenceRawText(pdfPage: number): Promise<string> {
    const page = JSON.parse(
        await readFile(
            resolve(
                repoRoot,
                `evidence/circ-7-2019/pages/page-${String(pdfPage).padStart(4, "0")}.json`,
            ),
            "utf8",
        ),
    ) as { rawText: string };
    return page.rawText;
}

function sliceThrough(raw: string, start: string, end: string): string {
    const from = raw.indexOf(start);
    const through = raw.indexOf(end, from);
    if (from < 0 || through < 0) {
        throw new Error(`Intervallo raw non trovato: ${start} … ${end}`);
    }
    return raw.slice(from, through + end.length).trim();
}

function sliceUntil(raw: string, start: string, end: string): string {
    const from = raw.indexOf(start);
    const until = raw.indexOf(end, from);
    if (from < 0 || until < 0) {
        throw new Error(`Intervallo raw non trovato: ${start} … ${end}`);
    }
    return raw.slice(from, until).trim();
}

const unit = JSON.parse(await readFile(unitPath, "utf8"));
const page59 = await evidenceRawText(59);
const page60 = await evidenceRawText(60);

const correctedRaw = new Map<string, string>([
    [
        `${unit.id}#block-editorial-001`,
        sliceThrough(
            page59,
            "L’altezza di riferimento",
            "l’elemento strutturale considerato.",
        ),
    ],
    [
        `${unit.id}#block-editorial-005`,
        page59.slice(page59.lastIndexOf("I coefficienti globali")).trim(),
    ],
    [
        `${unit.id}#block-editorial-008`,
        sliceUntil(
            page60,
            "I coefficienti locali e di dettaglio",
            "\nVento parallelo alla direzione del colmo",
        ),
    ],
]);

for (const block of unit.blocks) {
    const raw = correctedRaw.get(block.blockId);
    if (!raw) continue;
    if (!block.text || !block.evidence) {
        throw new Error(`Blocco testuale/evidence mancante: ${block.blockId}`);
    }
    block.text.raw = raw;
    block.evidence.rawSha256 = createHash("sha256")
        .update(raw)
        .digest("hex");
}

unit.workflow.openIssues = unit.workflow.openIssues.filter(
    ({ issueId }: { issueId: string }) =>
        issueId !== "circ2019-c3-3-8-1-3-evidence-page-span",
);

await writeFile(unitPath, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
console.log("fix-circ3-evidence-spans: corretti 3 raw e rimossa 1 issue");
