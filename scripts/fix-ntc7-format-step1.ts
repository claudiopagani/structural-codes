import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineKind = "text" | "em" | "strong" | "math";
type InlineSegment = { kind: InlineKind; value: string; latex?: string };
type TextBlock = {
    blockId: string;
    kind: string;
    listMarker?: "bullet" | "dash" | "none";
    text?: { normalized: string; inline?: InlineSegment[] };
    evidence: {
        transformations: Array<{ operation: string; ruleVersion: string; note: string }>;
        normalizedSha256: string;
    };
};
type Unit = { blocks: TextBlock[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(root, "corpus", "units", "ntc2018");
const profile = "ntc7-format-audit-step1-0.1.0";

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
    return block as TextBlock & { text: NonNullable<TextBlock["text"]> };
}

function currentInline(block: TextBlock & { text: NonNullable<TextBlock["text"]> }) {
    return block.text.inline ?? [{ kind: "text" as const, value: block.text.normalized }];
}

function setInline(block: TextBlock & { text: NonNullable<TextBlock["text"]> }, inline: InlineSegment[]) {
    const compact = inline.filter(({ value }) => value.length > 0);
    assert(
        compact.map(({ value }) => value).join("") === block.text.normalized,
        `Inline disallineato: ${block.blockId}`,
    );
    block.text.inline = compact;
}

function replacePlain(
    block: TextBlock & { text: NonNullable<TextBlock["text"]> },
    target: string,
    replacement: InlineSegment,
    expected = 1,
) {
    const already = currentInline(block).filter(
        (segment) => segment.kind === replacement.kind && segment.value === replacement.value && segment.latex === replacement.latex,
    ).length;
    if (already === expected) return;
    const sameKindAndValue = currentInline(block).filter(
        (segment) => segment.kind === replacement.kind && segment.value === replacement.value,
    );
    if (replacement.kind === "math" && sameKindAndValue.length === expected) {
        for (const segment of sameKindAndValue) segment.latex = replacement.latex;
        return;
    }
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

function math(block: ReturnType<typeof blockStartingWith>, value: string, latex: string, count = 1) {
    replacePlain(block, value, { kind: "math", value, latex }, count);
}

function classifyMarkers(unit: Unit) {
    for (const block of unit.blocks) {
        if (block.kind !== "list-item" || !block.text) continue;
        if (/^\s*[a-z]\)/iu.test(block.text.normalized)) block.listMarker = "none";
        else if (/^x\s/u.test((block as TextBlock & { text: NonNullable<TextBlock["text"]> }).text.normalized)) block.listMarker = "bullet";
        else if (/^\s*-\s/u.test(block.text.normalized)) {
            block.listMarker = /^x\s/u.test((block as TextBlock & { text: NonNullable<TextBlock["text"]> & { raw?: string } }).text.raw ?? "")
                ? "bullet"
                : "dash";
        }
    }
}

function correctNormalized(block: ReturnType<typeof blockStartingWith>, from: string, to: string, note: string) {
    if (!block.text.normalized.includes(from)) return;
    block.text.normalized = block.text.normalized.replace(from, to);
    block.text.inline = currentInline(block).map((segment) => ({ ...segment, value: segment.value.replace(from, to) }));
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    setInline(block, block.text.inline);
}

async function updateUnits() {
    {
        const { path, unit } = await loadUnit("7.0");
        classifyMarkers(unit);
        const threshold = blockStartingWith(unit, "Le costruzioni caratterizzate");
        style(threshold, "em", "SLV", 2);
        const sole = blockStartingWith(unit, "- si richiede");
        style(sole, "em", "SLV");
        const behavior = blockStartingWith(unit, "- si utilizza");
        style(behavior, "em", "“progettazione per comportamento strutturale non dissipativo”");
        style(behavior, "em", "“progettazione per comportamento strutturale dissipativo”");
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }

    {
        const { path, unit } = await loadUnit("7.1");
        classifyMarkers(unit);
        style(blockStartingWith(unit, "S’intende per:"), "em", "S’intende per:");
        style(blockStartingWith(unit, "- capacità di"), "strong", "capacità di un elemento strutturale o di una struttura");
        style(blockStartingWith(unit, "- domanda su"), "strong", "domanda su un elemento strutturale o su una struttura");
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }

    {
        const { path, unit } = await loadUnit("7.2.1");
        classifyMarkers(unit);
        style(blockStartingWith(unit, "Le costruzioni devono avere"), "em", "regolarità in pianta e in altezza");
        style(blockStartingWith(unit, "Per quanto riguarda gli edifici"), "strong", "regolare in pianta");
        style(blockStartingWith(unit, "Sempre riferendosi agli edifici"), "strong", "regolare in altezza");
        style(blockStartingWith(unit, "f) il rapporto"), "em", "SLV");
        style(blockStartingWith(unit, "La distanza tra costruzioni"), "em", "SLV");
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }

    {
        const { path, unit } = await loadUnit("7.2.2");
        classifyMarkers(unit);
        style(blockStartingWith(unit, "a) comportamento"), "strong", "comportamento strutturale non dissipativo");
        style(blockStartingWith(unit, "b) comportamento"), "strong", "comportamento strutturale dissipativo");
        style(blockStartingWith(unit, "Per comportamento strutturale non dissipativo"), "strong", "comportamento strutturale non dissipativo");
        style(blockStartingWith(unit, "Per comportamento strutturale dissipativo"), "strong", "comportamento strutturale dissipativo");
        style(blockStartingWith(unit, "Tali fini possono"), "em", "SLV");
        style(blockStartingWith(unit, "Gli appoggi mobili"), "em", "SLC");
        math(blockStartingWith(unit, "I collegamenti realizzati"), "1,5", "1{,}5");
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }

    {
        const { path, unit } = await loadUnit("7.2.3");
        style(blockStartingWith(unit, "Alcuni elementi strutturali"), "em", "SLC");
        math(blockStartingWith(unit, "In nessun caso la scelta"), "15%", "15\\%" );
        math(blockStartingWith(unit, "Se la distribuzione degli elementi non strutturali è fortemente irregolare in pianta"), "2", "2");
        math(blockStartingWith(unit, "Se la distribuzione degli elementi non strutturali è fortemente irregolare in altezza"), "1,4", "1{,}4");
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }

    {
        const { path, unit } = await loadUnit("7.2.4");
        math(blockStartingWith(unit, "Non ricadono nelle prescrizioni"), "30%", "30\\%" );
        math(blockStartingWith(unit, "Non ricadono nelle prescrizioni"), "10%", "10\\%" );
        math(blockStartingWith(unit, "In accordo con i criteri"), "1,5", "1{,}5");
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }

    {
        const { path, unit } = await loadUnit("7.2.5");
        classifyMarkers(unit);
        math(blockStartingWith(unit, "Le platee di fondazione"), "0,1%", "0{,}1\\%" );
        math(blockStartingWith(unit, "Le travi di fondazione"), "0,2%", "0{,}2\\%" );
        const piles = blockStartingWith(unit, "I pali in calcestruzzo");
        math(piles, "0,3%", "0{,}3\\%" );
        math(piles, "8 mm", "8\\,\\mathrm{mm}" );
        math(blockStartingWith(unit, "In tali zone dissipative"), "1%", "1\\%" );
        math(blockStartingWith(unit, "Travi o piastre di piano"), "≤ 1,00 m", "\\le1{,}00\\,\\mathrm{m}" );
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }

    {
        const { path, unit } = await loadUnit("7.2.6");
        classifyMarkers(unit);
        const floors = blockStartingWith(unit, "A meno di specifiche valutazioni");
        math(floors, "40 mm", "40\\,\\mathrm{mm}" );
        math(floors, "50 mm", "50\\,\\mathrm{mm}" );
        const spectrum = blockStartingWith(unit, "a) I valori dello spettro");
        math(spectrum, "5 %", "5\\%" );
        math(spectrum, "70 %", "70\\%" );
        math(blockStartingWith(unit, "b) Ove si effettuino"), "70 %", "70\\%" );
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }

    {
        const { path, unit } = await loadUnit("7.3");
        classifyMarkers(unit);
        const linear = blockStartingWith(unit, "- per l’analisi lineare");
        style(linear, "strong", "per l’analisi lineare");
        const nonlinear = blockStartingWith(unit, "- per l’analisi non lineare");
        correctNormalized(nonlinear, "non lineare,,", "non lineare,", "Rimossa la virgola duplicata, assente nel PDF ufficiale.");
        style(nonlinear, "strong", "per l’analisi non lineare");
        style(blockStartingWith(unit, "Il limite superiore"), "em", "SLV");
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }
}

async function updateCaptions() {
    const path = join(root, "corpus", "assets", "ntc2018", "7-step1.json");
    const manifest = JSON.parse(await readFile(path, "utf8")) as {
        tables: Array<{ officialNumber: string; caption: string; captionInline?: InlineSegment[] }>;
    };
    const captions = new Map<string, InlineSegment[]>([
        ["7.2.I", [
            { kind: "em", value: "Fattori di sovraresistenza " },
            { kind: "math", value: "γ_Rd", latex: "\\gamma_{Rd}" },
            { kind: "em", value: " (fra parentesi quadre è indicato il numero dell’equazione corrispondente)" },
        ]],
        ["7.3.I", [
            { kind: "em", value: "Limiti su " },
            { kind: "math", value: "q", latex: "q" },
            { kind: "em", value: " e modalità di modellazione dell’azione sismica" },
        ]],
    ]);
    for (const [number, inline] of captions) {
        const table = manifest.tables.find(({ officialNumber }) => officialNumber === number);
        assert(table, `Tabella mancante: ${number}`);
        assert(inline.map(({ value }) => value).join("") === table.caption, `Caption disallineata: ${number}`);
        table.captionInline = inline;
    }
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await updateUnits();
await updateCaptions();
console.log("fix-ntc7-format-step1: pagine PDF 211-219 aggiornate");
