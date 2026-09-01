import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitPath = join(repoRoot, "corpus", "units", "circ2019", "c1.1.json");
const profile = "circ-c1-formula-audit-0.1.0";
const note = "Matematica inline segmentata dopo confronto con il render ufficiale ad alta scala.";

type Token = { value: string; latex: string };

// Il record canonico contiene blocchi eterogenei definiti dallo schema del corpus.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unit: any = JSON.parse(await readFile(unitPath, "utf8"));

function inline(text: string, tokens: Token[]): Array<Record<string, string>> {
    const segments: Array<Record<string, string>> = [];
    let cursor = 0;
    for (const token of tokens) {
        const index = text.indexOf(token.value, cursor);
        if (index < 0) throw new Error(`Token non trovato: ${token.value}`);
        if (index > cursor) segments.push({ kind: "text", value: text.slice(cursor, index) });
        segments.push({ kind: "math", value: token.value, latex: token.latex });
        cursor = index + token.value.length;
    }
    if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
    return segments;
}

function patch(page: number, prefix: string, tokens: Token[]): void {
    const block = unit.blocks.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (candidate: any) => candidate.evidence.pdfPage === page && candidate.text?.normalized?.startsWith(prefix),
    );
    if (block === undefined) throw new Error(`Blocco C1.1 non trovato: p.${page} / ${prefix}`);
    block.text.inline = inline(block.text.normalized, tokens);
    if (!block.evidence.transformations.some((entry: { ruleVersion?: string }) => entry.ruleVersion === profile)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

patch(34, "Le considerazioni innanzi", [{ value: "2°", latex: "2^\\circ" }]);
patch(35, "“... OMISSIS", [{ value: "0,5-2,0", latex: "0{,}5\\text{-}2{,}0" }]);
patch(35, "La ridistribuzione è", [{ value: "30%", latex: "30\\%" }]);
patch(36, "Infatti, al § 8.3", [{ value: "ζE", latex: "\\zeta_E" }]);
patch(36, "La restrizione sull’uso", [{ value: "ζV,i", latex: "\\zeta_{V,i}" }]);

await writeFile(unitPath, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
console.log("circ-c1-formulas: aggiornato C1.1 (5 espressioni inline)");
