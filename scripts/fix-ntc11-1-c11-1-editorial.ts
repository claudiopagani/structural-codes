import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em"; value: string };
type Transformation = { operation: string; ruleVersion: string; note: string };
type Evidence = { sourceId: string; pdfPage: number; printedPage: string; rawSha256: string; normalizedSha256: string; transformations: Transformation[]; [key: string]: unknown };
type Block = { blockId: string; kind: string; listMarker?: "dash" | "none"; listLevel?: number; text?: { raw: string; normalized: string; inline?: Inline[]; [key: string]: unknown }; evidence?: Evidence; [key: string]: unknown };
type Unit = { blocks: Block[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc11-1-c11-1-editorial-formatting-0.1.0";
const dashNote = "Il trattino tipografico della fonte è rappresentato dal marcatore strutturale; il testo della voce conserva soltanto la descrizione.";
const labelNote = "La label ufficiale è mantenuta nel testo e resa senza un marcatore aggiuntivo, per allineare la descrizione.";
const italicNote = "Ripristinato il corsivo verificato nel render della fonte ufficiale.";

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function recordEvidence(block: Block, note: string, rawChanged = false): void {
    assert.ok(block.text && block.evidence, `Evidence assente: ${block.blockId}`);
    if (rawChanged) block.evidence.rawSha256 = sha256(block.text.raw);
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
    if (!block.evidence.transformations.some((entry) => entry.operation === "manual-correction" && entry.ruleVersion === profile && entry.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

function setDash(block: Block): void {
    assert.ok(block.text, `Testo assente: ${block.blockId}`);
    block.kind = "list-item";
    if (/^[–—-]\s+/u.test(block.text.normalized)) {
        block.text.normalized = block.text.normalized.replace(/^[–—-]\s+/u, "");
    }
    block.text.inline = [{ kind: "text", value: block.text.normalized }];
    block.listMarker = "dash";
    delete block.listLevel;
    recordEvidence(block, dashNote);
}

function setLabel(block: Block, label: string): void {
    assert.ok(block.text, `Testo assente: ${block.blockId}`);
    block.kind = "list-item";
    if (!block.text.normalized.startsWith(label)) block.text.normalized = `${label} ${block.text.normalized}`;
    block.text.inline = [{ kind: "text", value: block.text.normalized }];
    block.listMarker = "none";
    delete block.listLevel;
    recordEvidence(block, labelNote);
}

function italicize(block: Block, phrases: string[]): void {
    assert.ok(block.text, `Testo assente: ${block.blockId}`);
    const positions = phrases.map((phrase) => {
        const index = block.text!.normalized.indexOf(phrase);
        assert.notEqual(index, -1, `Frase assente per il corsivo: ${phrase}`);
        return { phrase, index, end: index + phrase.length };
    }).sort((left, right) => left.index - right.index);
    assert.ok(positions.every((entry, index) => index === 0 || positions[index - 1]!.end <= entry.index), `Corsivi sovrapposti: ${block.blockId}`);
    const inline: Inline[] = [];
    let cursor = 0;
    for (const entry of positions) {
        if (cursor < entry.index) inline.push({ kind: "text", value: block.text.normalized.slice(cursor, entry.index) });
        inline.push({ kind: "em", value: entry.phrase });
        cursor = entry.end;
    }
    if (cursor < block.text.normalized.length) inline.push({ kind: "text", value: block.text.normalized.slice(cursor) });
    block.text.inline = inline;
    recordEvidence(block, italicNote);
}

function splitMergedFootnote(unit: Unit): void {
    const index = 37;
    const merged = unit.blocks[index]!;
    assert.equal(merged.kind, "footnote");
    assert.ok(merged.text && merged.evidence);
    const rawBreak = merged.text.raw.indexOf("\n");
    assert.ok(rawBreak > 0, "Nota e capoverso non separabili");
    const footnoteRaw = merged.text.raw.slice(0, rawBreak);
    const continuationRaw = merged.text.raw.slice(rawBreak + 1);
    const continuationNormalized = merged.text.normalized.slice(footnoteRaw.length).trimStart();
    assert.ok(continuationNormalized.startsWith("Le NTC prevedono"));
    merged.text.raw = footnoteRaw;
    merged.text.normalized = footnoteRaw;
    delete merged.text.inline;
    recordEvidence(merged, "Separata la nota a piè pagina dal capoverso iniziale della pagina successiva.", true);
    const continuation: Block = {
        ...structuredClone(merged),
        blockId: `${merged.blockId}a`,
        kind: "paragraph",
        text: { ...merged.text, raw: continuationRaw, normalized: continuationNormalized },
        evidence: {
            ...structuredClone(merged.evidence),
            pdfPage: 318,
            printedPage: "314",
            rawSha256: sha256(continuationRaw),
            normalizedSha256: sha256(continuationNormalized),
            transformations: [{ operation: "manual-correction", ruleVersion: profile, note: "Separato il capoverso dalla nota a piè pagina della pagina precedente." }],
        },
    };
    unit.blocks.splice(index + 1, 0, continuation);
    italicize(continuation, ["“altri laboratori, dotati di adeguata competenza ed idonee attrezzature”"]);
}

async function updateUnit(document: "ntc2018" | "circ2019", name: string, edit: (unit: Unit) => void): Promise<void> {
    const path = join(root, "corpus", "units", document, `${name}.json`);
    const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
    edit(unit);
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

await updateUnit("ntc2018", "11.1", (unit) => {
    const items = unit.blocks.filter((block) => block.kind === "list-item");
    assert.equal(items.length, 9);
    for (const item of items.slice(0, 3)) setDash(item);
    for (const item of items.slice(3)) setLabel(item, item.text!.normalized.slice(0, 2));
    italicize(unit.blocks[1]!, ["Resistenza meccanica e stabilità"]);
    for (const item of items.slice(0, 3)) italicize(item, [item.text!.normalized]);
    italicize(unit.blocks[18]!, ["Relazione sui materiali"]);
    italicize(unit.blocks[20]!, ["Relazione a struttura ultimata"]);
    italicize(unit.blocks[28]!, ["mandatario"]);
});

await updateUnit("circ2019", "c11.1", (unit) => {
    if (unit.blocks.some((block) => block.blockId.endsWith("#block-037a"))) return;
    for (const [index, label] of [[2, "A)"], [3, "B)"], [4, "C)"]] as const) setLabel(unit.blocks[index]!, label);
    for (const index of [11, 12, 24, 25, 30, 31, 32, 33, 34, 39, 40, 41]) setDash(unit.blocks[index]!);
    const emphasis = new Map<number, string[]>([
        [7, ["«Fabbricante»"]],
        [8, ["«Norma europea armonizzata»", "“Norma armonizzata”", "“Allegato ZA”", "“armonizzata”"]],
        [9, ["«Marcatura CE»", "ETA - European Technical Assessment"]],
        [10, ["«Valutazione Tecnica Europea (ETA)»", "“Valutazione documentata della prestazione di un prodotto da costruzione in relazione alle sue caratteristiche essenziali conformemente al rispettivo documento per la valutazione europea”"]],
        [13, ["Technical Assessment Bodies", "European Assessment Document", "gli orientamenti per il benestare tecnico europeo"]],
        [16, ["«Valutazione e verifica della costanza della prestazione»", "I sistemi di valutazione e verifica della costanza della prestazione"]],
        [17, ["«Certificato di costanza della prestazione del prodotto»", "«Certificato di conformità del controllo della produzione in fabbrica»"]],
        [18, ["«Dichiarazione di Prestazione»"]],
        [19, ["«Certificato di Valutazione Tecnica»", "“equivalenza”", "“Resistenza al fuoco”"]],
        [20, ["«Attestato di Qualificazione»"]],
        [21, ["«Controllo della produzione in fabbrica (FPC)»"]],
        [22, ["«Equivalenza»"]],
        [23, ["«Organismi notificati»"]],
        [29, ["NANDO - New Approach Notified and Designated Organisations"]],
        [35, ["l’acquisizione e verifica"]],
        [39, ["i provini"]],
        [40, ["i saggi"]],
        [41, ["i campioni"]],
        [46, ["prodotti occasionali", "non in serie", "a piè d’opera"]],
        [47, ["“Adeguamento della normativa nazionale alle disposizioni del regolamento (UE) n. 305/2011, che fissa condizioni armonizzate per la commercializzazione dei prodotti da costruzione e che abroga la direttiva 89/106/CEE”", "“L'impiego nelle opere di un prodotto da costruzione è soggetto, per i materiali e prodotti per uso strutturale, alle norme tecniche per le costruzioni adottate in applicazione dell'articolo 52 del decreto del Presidente della Repubblica 6 giugno 2001, n. 380, e successive modificazioni, …”", "“Controllo, Vigilanza e Sanzioni”"]],
    ]);
    for (const [index, phrases] of emphasis) italicize(unit.blocks[index]!, phrases);
    splitMergedFootnote(unit);
});
