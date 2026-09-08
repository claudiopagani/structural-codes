import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "strong" | "math"; value: string; latex?: string };
type Block = { kind: string; listMarker?: "dash" | "none"; text?: { normalized: string; inline?: Inline[] }; evidence?: { pdfPage?: number } };
type Unit = { blocks: Block[] };
const root = fileURLToPath(new URL("../", import.meta.url));
const units = join(root, "corpus", "units", "ntc2018");

function segmented(text: string, formats: Inline[]): Inline[] {
    const out: Inline[] = []; let at = 0;
    for (const part of formats.sort((a, b) => text.indexOf(a.value, at) - text.indexOf(b.value, at))) {
        const next = text.indexOf(part.value, at); assert.ok(next >= at, `Segmento assente: ${part.value}`);
        if (next > at) out.push({ kind: "text", value: text.slice(at, next) }); out.push(part); at = next + part.value.length;
    }
    if (at < text.length) out.push({ kind: "text", value: text.slice(at) });
    assert.equal(out.map((part) => part.value).join(""), text); return out;
}
async function update(name: string, edit: (unit: Unit) => void): Promise<void> {
    const path = join(units, `${name}.json`); const unit = JSON.parse(await readFile(path, "utf8")) as Unit; edit(unit); await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`);
}
function block(unit: Unit, prefix: string): Block & { text: NonNullable<Block["text"]> } {
    const value = unit.blocks.find((candidate) => candidate.text?.normalized.startsWith(prefix)); assert.ok(value?.text, prefix); return value as Block & { text: NonNullable<Block["text"]> };
}
function format(unit: Unit, prefix: string, formats: Inline[]): void { const value = block(unit, prefix); value.text.inline = segmented(value.text.normalized, formats); }
for (const name of ["4.3.2.2.2", "4.3.2.4", "4.3.2.5", "4.3.4.3", "4.3.4.3.1.1"]) await update(name, (unit) => { for (const value of unit.blocks.filter((candidate) => candidate.kind === "list-item")) value.listMarker = "dash"; });
await update("4.3.5.1", (unit) => { for (const value of unit.blocks.filter((candidate) => candidate.kind === "list-item")) value.listMarker = "none"; });
await update("4.3.1.1", (unit) => format(unit, "Stato limite di resistenza", [{ kind: "em", value: "Stato limite di resistenza della connessione acciaio-calcestruzzo" }]));
await update("4.3.1.2", (unit) => format(unit, "Stato limite di esercizio", [{ kind: "em", value: "Stato limite di esercizio della connessione acciaio-calcestruzzo" }]));
await update("4.3.2.1", (unit) => format(unit, "La classificazione", [{ kind: "math", value: "§ 4.2.3", latex: "\\S 4.2.3" }]));
await update("4.3.2.3", (unit) => format(unit, "La larghezza efficace", [{ kind: "math", value: "b_eff", latex: "b_{eff}" }]));
for (const manifestName of ["4.3-step1.json", "4.3-step2.json", "4.3-step3.json"]) {
    const path = join(root, "corpus", "assets", "ntc2018", manifestName); const manifest = JSON.parse(await readFile(path, "utf8")) as { figures: Array<{ pdfPage: number; officialNumber: string; caption: string; captionInline?: Inline[] }>; tables: Array<{ pdfPage: number; officialNumber: string; caption: string; captionInline?: Inline[] }> };
    for (const asset of [...manifest.figures, ...manifest.tables]) if (asset.pdfPage >= 119 && asset.pdfPage <= 127) {
        const label = asset.caption.match(/^(Fig(?:ura)?\. ?4\.3\.[^( –-]+(?:\([ab]\))?|Tab\. ?4\.3\.[IVX]+|4\.3\.[IVX]+)/)?.[0] ?? asset.caption.split(" - ")[0] ?? asset.caption;
        const rest = asset.caption.slice(label.length);
        const captionInline: Inline[] = [{ kind: "strong", value: label }];
        if (rest) captionInline.push({ kind: "em", value: rest });
        asset.captionInline = captionInline;
        assert.equal(captionInline.map((part) => part.value).join(""), asset.caption);
    }
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}
