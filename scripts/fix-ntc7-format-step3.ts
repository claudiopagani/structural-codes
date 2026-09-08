import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineKind = "text" | "em" | "strong" | "math";
type Inline = { kind: InlineKind; value: string; latex?: string };
type Block = { blockId: string; kind: string; listMarker?: "bullet" | "dash" | "none"; text?: { raw?: string; normalized: string; inline?: Inline[] }; evidence?: { pdfPage?: number } };
type Unit = { blocks: Block[] };
const root = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(root, "corpus", "units", "ntc2018");
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function find(unit: Unit, prefix: string) { const b = unit.blocks.find((x) => x.text?.normalized.startsWith(prefix)); assert(b?.text, prefix); return b as Block & { text: NonNullable<Block["text"]> }; }
function inline(b: ReturnType<typeof find>) { return b.text.inline ?? [{ kind: "text" as const, value: b.text.normalized }]; }
function set(b: ReturnType<typeof find>, parts: Inline[]) { const clean = parts.filter((x) => x.value); assert(clean.map((x) => x.value).join("") === b.text.normalized, `Inline: ${b.blockId}`); b.text.inline = clean; }
function replace(b: ReturnType<typeof find>, target: string, part: Inline, expected = 1) {
    const present = inline(b).filter((x) => x.kind === part.kind && x.value === part.value && x.latex === part.latex).length;
    if (present === expected) return;
    assert(present === 0, `Già presente: ${target}`);
    let count = 0; const out: Inline[] = [];
    for (const source of inline(b)) {
        if (source.kind !== "text") { out.push(source); continue; }
        let cursor = 0;
        while (cursor < source.value.length) {
            const at = source.value.indexOf(target, cursor);
            if (at < 0 || count === expected) { out.push({ kind: "text", value: source.value.slice(cursor) }); break; }
            out.push({ kind: "text", value: source.value.slice(cursor, at) }, part); count++; cursor = at + target.length;
        }
    }
    assert(count === expected, `${target}: ${count}/${expected}`); set(b, out);
}
const style = (b: ReturnType<typeof find>, kind: "em" | "strong", value: string, count = 1) => replace(b, value, { kind, value }, count);
const math = (b: ReturnType<typeof find>, value: string, latex: string, count = 1) => replace(b, value, { kind: "math", value, latex }, count);
function markers(unit: Unit) { for (const b of unit.blocks) { if (b.kind !== "list-item" || !b.text || (b.evidence?.pdfPage ?? 0) < 230 || (b.evidence?.pdfPage ?? 0) > 239) continue; const raw = (b.text.raw ?? "").trimStart(); const norm = b.text.normalized.trimStart(); b.listMarker = /^x\s/u.test(raw) ? "bullet" : (/^(?:-|ȭ)\s/u.test(raw) || /^-\s/u.test(norm) ? "dash" : "none"); } }
async function edit(number: string, callback: (unit: Unit) => void = () => undefined) { const path = join(unitDir, `${number}.json`); const unit = JSON.parse(await readFile(path, "utf8")) as Unit; markers(unit); callback(unit); await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8"); }

await edit("7.4.4.1.1");
await edit("7.4.4.1.2", (u) => style(find(u, "La domanda in duttilità"), "em", "SLC"));
await edit("7.4.4.2.1", (u) => {
    style(find(u, "Presso-flessione"), "em", "Presso-flessione");
    style(find(u, "Taglio"), "em", "Taglio");
    const limits = find(u, "Per le strutture in CD"); math(limits, "55%", "55\\%"); math(limits, "65%", "65\\%");
    math(find(u, "Il confronto capacità-domanda"), "30%", "30\\%");
});
await edit("7.4.4.3", (u) => { style(find(u, "interamente confinati"), "strong", "interamente confinati:"); style(find(u, "non interamente confinati"), "strong", "non interamente confinati:"); });
await edit("7.4.4.3.1", (u) => {
    style(find(u, "a) la maggiore"), "em", "a)"); style(find(u, "b) la minore"), "em", "b)");
    math(find(u, "Per evitare che"), "6 mm", "6\\,\\mathrm{mm}");
});
await edit("7.4.4.4.1", (u) => math(find(u, "Gli orizzontamenti"), "30%", "30\\%"));
await edit("7.4.4.5.1", (u) => {
    for (const label of ["Presso-flessione", "Taglio", "Verifica a taglio-compressione del calcestruzzo dell’anima", "Verifica a taglio-trazione dell’armatura dell’anima", "Verifica a scorrimento nelle zone dissipative"]) style(find(u, label), "em", label);
    style(find(u, "Per le pareti estese debolmente armate"), "strong", "pareti estese debolmente armate");
    style(find(u, "Nelle pareti estese debolmente armate"), "strong", "pareti estese debolmente armate");
    for (const marker of ["a)", "b)", "c)"]) style(find(u, `${marker} `), "em", marker);
});
await edit("7.4.4.5.2");
await edit("7.4.4.6");
await edit("7.4.5.1");
await edit("7.4.5.2", (u) => { for (const marker of ["a)", "b)", "c)"]) style(find(u, `${marker} collegamenti`), "em", marker); });
await edit("7.4.5.2.1", (u) => { for (const label of ["Collegamenti lontani dalle zone dissipative o di tipo a)", "Collegamenti sovradimensionati o di tipo b)", "Collegamenti che dissipano energia o di tipo c)"]) style(find(u, label), "em", label); });
await edit("7.4.6");
await edit("7.4.6.1.1", (u) => replace(find(u, "La larghezza"), "≥ ", { kind: "math", value: "≥ ", latex: "\\ge " }));

for (const manifestName of ["7.4-step1.json", "7.4-step2.json"]) {
    const path = join(root, "corpus", "assets", "ntc2018", manifestName);
    const manifest = JSON.parse(await readFile(path, "utf8"));
    for (const figure of manifest.figures ?? []) {
        if (figure.pdfPage < 230 || figure.pdfPage > 239) continue;
        const prefix = `Fig. ${figure.officialNumber} – `;
        assert(figure.caption.startsWith(prefix), `Caption ${figure.officialNumber}`);
        figure.captionInline = [{ kind: "strong", value: prefix }, { kind: "em", value: figure.caption.slice(prefix.length) }];
    }
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
console.log("fix-ntc7-format-step3: pagine PDF 230-239 aggiornate");
