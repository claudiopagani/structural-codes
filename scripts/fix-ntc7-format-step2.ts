/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineKind = "text" | "em" | "strong" | "math";
type InlineSegment = { kind: InlineKind; value: string; latex?: string };
type TextValue = { raw?: string; normalized: string; inline?: InlineSegment[] };
type Block = {
    blockId: string;
    kind: string;
    listMarker?: "bullet" | "dash" | "none";
    listLevel?: number;
    indentLevel?: number;
    text?: TextValue;
    evidence?: { pdfPage?: number; rawSha256?: string; normalizedSha256?: string; transformations?: Array<Record<string, string>>; [key: string]: unknown };
};
type Unit = { blocks: Block[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(root, "corpus", "units", "ntc2018");

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function sha256(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

async function loadUnit(number: string) {
    const path = join(unitDir, `${number}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}

function blockStartingWith(unit: Unit, prefix: string) {
    const block = unit.blocks.find((candidate) => candidate.text?.normalized.startsWith(prefix));
    assert(block?.text, `Blocco non trovato: ${prefix}`);
    return block as Block & { text: TextValue };
}

function currentInline(block: Block & { text: TextValue }) {
    return block.text.inline ?? [{ kind: "text" as const, value: block.text.normalized }];
}

function setInline(block: Block & { text: TextValue }, inline: InlineSegment[]) {
    const compact = inline.filter(({ value }) => value.length > 0);
    assert(compact.map(({ value }) => value).join("") === block.text.normalized, `Inline disallineato: ${block.blockId}`);
    block.text.inline = compact;
}

function replacePlain(block: Block & { text: TextValue }, target: string, replacement: InlineSegment, expected = 1) {
    const already = currentInline(block).filter(
        (segment) => segment.kind === replacement.kind && segment.value === replacement.value && segment.latex === replacement.latex,
    ).length;
    if (already === expected) return;
    assert(already === 0, `Segmento già presente in quantità inattesa: ${target}`);
    let count = 0;
    const result: InlineSegment[] = [];
    for (const segment of currentInline(block)) {
        if (segment.kind !== "text") {
            result.push(segment);
            continue;
        }
        let cursor = 0;
        while (cursor < segment.value.length) {
            const index = segment.value.indexOf(target, cursor);
            if (index < 0 || count === expected) {
                result.push({ kind: "text", value: segment.value.slice(cursor) });
                break;
            }
            result.push({ kind: "text", value: segment.value.slice(cursor, index) });
            result.push(replacement);
            count += 1;
            cursor = index + target.length;
        }
    }
    assert(count === expected, `Occorrenze inattese di “${target}”: ${count}/${expected} in ${block.blockId}`);
    setInline(block, result);
}

function style(block: ReturnType<typeof blockStartingWith>, kind: "em" | "strong", value: string, count = 1) {
    replacePlain(block, value, { kind, value }, count);
}

function alignedLabel(block: ReturnType<typeof blockStartingWith>, label: string) {
    assert(block.text.inline?.[0]?.kind === "math", `Etichetta matematica mancante: ${block.blockId}`);
    assert(block.text.inline[0].value === label, `Etichetta inattesa: ${block.blockId}`);
    block.kind = "list-item";
    block.listMarker = "none";
}

function sliceInline(inline: InlineSegment[], start: number, end: number) {
    const result: InlineSegment[] = [];
    let offset = 0;
    for (const segment of inline) {
        const segmentEnd = offset + segment.value.length;
        const from = Math.max(start, offset) - offset;
        const to = Math.min(end, segmentEnd) - offset;
        if (to > from) result.push({ ...segment, value: segment.value.slice(from, to) });
        offset = segmentEnd;
    }
    return result;
}

function splitWhere(unit: Unit) {
    const block = unit.blocks.find((candidate) => candidate.text?.normalized.startsWith("dove: P è"));
    if (!block?.text) return;
    const prefix = "dove:";
    const separatorLength = prefix.length + 1;
    const originalRaw = block.text.raw ?? block.text.normalized;
    const originalInline = currentInline(block as Block & { text: TextValue });
    const prefixBlock: Block = {
        ...block,
        blockId: `${block.blockId}-where`,
        kind: "paragraph",
        listMarker: undefined,
        listLevel: undefined,
        indentLevel: undefined,
        text: { ...block.text, raw: prefix, normalized: prefix, inline: sliceInline(originalInline, 0, prefix.length) },
        evidence: block.evidence ? {
            ...block.evidence,
            rawSha256: sha256(prefix),
            normalizedSha256: sha256(prefix),
            transformations: [...(block.evidence.transformations ?? []), { operation: "manual-correction", ruleVersion: "ntc7-format-audit-step2-0.1.0", note: "Separato il capoverso introduttivo ‘dove:’ dalla lista delle definizioni." }],
        } : undefined,
    };
    const remainderRaw = originalRaw.slice(separatorLength);
    block.text = { ...block.text, raw: remainderRaw, normalized: block.text.normalized.slice(separatorLength), inline: sliceInline(originalInline, separatorLength, block.text.normalized.length) };
    if (block.evidence) {
        block.evidence.rawSha256 = sha256(remainderRaw);
        block.evidence.normalizedSha256 = sha256(block.text.normalized);
        block.evidence.transformations = [...(block.evidence.transformations ?? []), { operation: "manual-correction", ruleVersion: "ntc7-format-audit-step2-0.1.0", note: "Separato il capoverso introduttivo ‘dove:’ dalla lista delle definizioni." }];
    }
    const index = unit.blocks.indexOf(block);
    unit.blocks.splice(index, 0, prefixBlock);
}

function classifyMarkers(unit: Unit) {
    for (const block of unit.blocks) {
        if (block.kind !== "list-item" || !block.text) continue;
        const page = block.evidence?.pdfPage ?? 0;
        if (page < 220 || page > 229) continue;
        const normalized = block.text.normalized.trimStart();
        const raw = (block.text.raw ?? "").trimStart();
        if (/^x\s/u.test(raw)) block.listMarker = "bullet";
        else if (/^(?:-|ȭ)\s/u.test(raw) || /^-\s/u.test(normalized)) block.listMarker = "dash";
        else block.listMarker = "none";
    }
}

async function updateUnit(number: string, edit: (unit: Unit) => void) {
    const { path, unit } = await loadUnit(number);
    classifyMarkers(unit);
    edit(unit);
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

await updateUnit("7.3.1", (unit) => {
    style(blockStartingWith(unit, "Valori del fattore"), "em", "Valori del fattore di comportamento q");
    style(blockStartingWith(unit, "Effetti delle non linearità"), "em", "Effetti delle non linearità geometriche");
    style(blockStartingWith(unit, "Per le costruzioni regolari"), "strong", "regolari in pianta");
    style(blockStartingWith(unit, "Per le costruzioni regolari"), "strong", "non regolari in pianta");
    for (const prefix of ["Il limite superiore", "q_0 è", "d_{Er} è"]) style(blockStartingWith(unit, prefix), "em", "SLV");
    const demands = blockStartingWith(unit, "Qualora la domanda");
    style(demands, "em", "SLV", 3);
    style(demands, "em", "SLD", 3);
    style(blockStartingWith(unit, "Il valore di q utilizzato"), "em", "SLV", 1);
    for (const [prefix, label] of [["q_0 è", "q_0"], ["K_R è", "K_R"]] as const) alignedLabel(blockStartingWith(unit, prefix), label);
    splitWhere(unit);
    for (const [prefix, label] of [["P è", "P"], ["d_{Er} è", "d_{Er}"], ["V è", "V"], ["h è", "h"]] as const) alignedLabel(blockStartingWith(unit, prefix), label);
});

await updateUnit("7.3.2", (unit) => {
    style(blockStartingWith(unit, "a) dinamicamente"), "em", "a)");
    style(blockStartingWith(unit, "b) staticamente"), "em", "b)");
});

await updateUnit("7.3.3.2", (unit) => {
    for (const [prefix, label] of [["F_h =", "F_h = S_d(T_1) W λ/g"], ["F_i è", "F_i"], ["W_i e", "W_i"], ["z_i e", "z_i"], ["S_d(T_1) è", "S_d(T_1)"], ["W è", "W"], ["λ è", "λ"], ["g è", "g"]] as const) alignedLabel(blockStartingWith(unit, prefix), label);
});

for (const number of ["7.3.3.1", "7.3.4", "7.3.5", "7.3.6"]) {
    await updateUnit(number, () => undefined);
}

await updateUnit("7.3.3.3", (unit) => {
    style(blockStartingWith(unit, "Gli spostamenti d_E"), "em", "SLV");
    style(blockStartingWith(unit, "Gli spostamenti allo SLC"), "em", "SLC");
    style(blockStartingWith(unit, "Gli spostamenti allo SLC"), "em", "SLV");
});

await updateUnit("7.3.4.1", (unit) => {
    style(blockStartingWith(unit, "L’analisi non lineare dinamica consiste"), "em", "SLC");
});

await updateUnit("7.3.4.2", (unit) => {
    style(blockStartingWith(unit, "Gruppo 1"), "em", "Gruppo 1 - Distribuzioni principali:");
    style(blockStartingWith(unit, "Gruppo 2"), "em", "Gruppo 2 - Distribuzioni secondarie:");
    for (const marker of ["a)", "b)", "c)"]) style(blockStartingWith(unit, `${marker} distribuzione`), "em", marker);
    for (const prefix of ["distribuzione proporzionale", "distribuzione corrispondente a un andamento"]) blockStartingWith(unit, prefix).listLevel = 1;
});

await updateUnit("7.3.6.1", (unit) => {
    for (const marker of ["a)", "b)", "c)", "d)", "e)"]) style(blockStartingWith(unit, `${marker} per`), "em", marker);
    style(blockStartingWith(unit, "Per le CU I"), "em", "SLD");
    style(blockStartingWith(unit, "Per le CU III"), "em", "SLO");
    style(blockStartingWith(unit, "Si deve verificare che i singoli elementi strutturali e la struttura nel suo insieme possiedano una capacità in resistenza"), "em", "SLV");
    style(blockStartingWith(unit, "- a 1,2 volte"), "strong", "SLV");
    style(blockStartingWith(unit, "- alla domanda"), "strong", "SLC");
    alignedLabel(blockStartingWith(unit, "d_r è"), "d_r");
    alignedLabel(blockStartingWith(unit, "h è"), "h");
});

for (const number of ["7.3.6.2", "7.3.6.3", "7.4.2.1", "7.4.2.2"]) {
    await updateUnit(number, () => undefined);
}

await updateUnit("7.4.1", (unit) => {
    const dissipative = blockStartingWith(unit, "Nel caso di comportamento strutturale dissipativo");
    style(dissipative, "em", "SLV");
    style(dissipative, "em", "SLC");
});

await updateUnit("7.4.3.1", (unit) => {
    const labels = [
        "strutture a telaio",
        "strutture a pareti",
        "strutture miste telaio-pareti",
        "strutture a pendolo inverso",
        "strutture a pendolo inverso intelaiate monopiano",
        "strutture deformabili torsionalmente",
    ];
    for (const label of labels) style(blockStartingWith(unit, label), "strong", label);
    const mixed = blockStartingWith(unit, "strutture miste telaio-pareti");
    style(mixed, "strong", "strutture miste equivalenti a telai");
    style(mixed, "strong", "strutture miste equivalenti a pareti");
    style(blockStartingWith(unit, "Una struttura a pareti"), "strong", "struttura a pareti estese debolmente armate");
    for (const prefix of ["r² =", "lₛ² ="]) {
        const definition = blockStartingWith(unit, prefix);
        definition.kind = "list-item";
        definition.listMarker = "none";
        definition.listLevel = 1;
        definition.indentLevel = 1;
    }
});

await updateUnit("7.4.3.2", (unit) => {
    style(blockStartingWith(unit, "Ai fini della determinazione"), "em", "a pareti accoppiate");
    style(blockStartingWith(unit, "a) Strutture"), "em", "a)");
    style(blockStartingWith(unit, "b) Strutture"), "em", "b)");
    for (const prefix of ["- strutture a telaio di un piano", "- strutture a telaio con più piani ed una sola campata", "- strutture a telaio con più piani e più campate", "- strutture con solo due pareti", "- altre strutture a pareti", "- strutture a pareti accoppiate"]) {
        blockStartingWith(unit, prefix).listLevel = 1;
    }
});

await updateUnit("7.4.4.1.1", (unit) => {
    style(blockStartingWith(unit, "Flessione"), "em", "Flessione");
    style(blockStartingWith(unit, "Taglio"), "em", "Taglio");
});

async function updateCaptions() {
    {
        const path = join(root, "corpus", "assets", "ntc2018", "7-step2.json");
        const manifest = JSON.parse(await readFile(path, "utf8"));
        const table = manifest.tables.find((value: any) => value.officialNumber === "7.3.II");
        assert(table, "Tabella 7.3.II mancante");
        for (const cell of table.headers[0]) if (cell.colSpan === 2) cell.align = "center";
        for (const cell of table.headers[1].slice(1)) cell.align = "center";
        for (const row of table.rows) {
            if (row.length === 1 && row[0].colSpan === 3) {
                row[0].shade = "gray";
                row[0].align = "center";
                continue;
            }
            for (const cell of row.slice(1)) cell.align = "center";
        }
        table.captionInline = [
            { kind: "em", value: "Valori massimi del valore di base " },
            { kind: "math", value: "q_0", latex: "q_0" },
            { kind: "em", value: " del fattore di comportamento allo SLV per diverse tecniche costruttive ed in funzione della tipologia strutturale e della classe di duttilità CD" },
        ];
        assert(table.captionInline.map((value: InlineSegment) => value.value).join("") === table.caption, "Caption 7.3.II disallineata");
        await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }
    {
        const path = join(root, "corpus", "assets", "ntc2018", "7-step3.json");
        const manifest = JSON.parse(await readFile(path, "utf8"));
        const table = manifest.tables.find((value: any) => value.officialNumber === "7.3.III");
        assert(table, "Tabella 7.3.III mancante");
        for (const cell of [...table.headers.flat(), ...table.rows.flat()]) cell.align = "center";
        table.captionInline = [{ kind: "em", value: table.caption }];
        await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }
    {
        const path = join(root, "corpus", "assets", "ntc2018", "7-step3.json");
        const manifest = JSON.parse(await readFile(path, "utf8"));
        const labels = new Map([
            ["7.3.6.1-7.3.11a", "per tamponature fragili"],
            ["7.3.6.1-7.3.11b", "per tamponature duttili"],
        ]);
        for (const formula of manifest.formulas ?? []) {
            const label = labels.get(formula.id.split(":").at(-1) ?? "");
            if (label && !formula.latex.includes(label)) formula.latex += `\\quad\\text{${label}}`;
        }
        await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }
    {
        const path = join(root, "corpus", "assets", "ntc2018", "7.4-step1.json");
        const manifest = JSON.parse(await readFile(path, "utf8"));
        const figure = manifest.figures.find((value: any) => value.officialNumber === "7.4.1");
        assert(figure, "Figura 7.4.1 mancante");
        figure.captionInline = [
            { kind: "strong", value: "Fig. 7.4.1 – " },
            { kind: "em", value: "Larghezza collaborante delle travi" },
        ];
        assert(figure.captionInline.map((value: InlineSegment) => value.value).join("") === figure.caption, "Caption Fig. 7.4.1 disallineata");
        await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }
}

await updateCaptions();
console.log("fix-ntc7-format-step2: pagine PDF 220-229 aggiornate");
