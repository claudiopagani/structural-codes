import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Inline = { kind: string; value: string; latex?: string };
type Block = { blockId: string; kind: string; listMarker?: string; listLevel?: number; indentLevel?: number; text?: { normalized: string; inline?: Inline[]; paragraphs?: Array<{ normalized: string }> }; evidence?: { pdfPage?: number } };
type Unit = { blocks: Block[] };
type Cell = { text: string; align?: string; verticalText?: boolean; rowSpan?: number; colSpan?: number; latex?: string; inline?: Inline[]; strong?: boolean; shade?: string; noWrap?: boolean };
type Table = { officialNumber: string; headers: Cell[][]; rows: Cell[][]; notes?: string[]; notesInline?: Inline[][]; columnWidths?: number[] };
type AssetManifest = { tables: Table[] };

const root = process.cwd();
const unit = async (number: string): Promise<Unit> => JSON.parse(await readFile(join(root, "corpus", "units", "circ2019", `${number}.json`), "utf8")) as Unit;

test("Circolare C8 conserva l’introduzione prima di C8.1 e i corsivi di C8.1", async () => {
    const c8 = await unit("c8");
    assert.deepEqual(c8.blocks.map(({ kind }) => kind), ["heading", "paragraph", "paragraph", "paragraph", "paragraph"]);
    assert.equal(c8.blocks[1]?.text?.normalized.startsWith("Le costruzioni esistenti rappresentano certamente"), true);
    assert.equal(c8.blocks.slice(1).every((block) => block.evidence?.pdfPage === 254), true);

    const c81 = await unit("c8.1");
    const first = c81.blocks.find((block) => block.blockId.endsWith("#block-editorial-001"));
    const third = c81.blocks.find((block) => block.blockId.endsWith("#block-editorial-003"));
    assert.deepEqual(first?.text?.inline?.filter(({ kind }) => kind === "em").map(({ value }) => value), ["costruzioni esistenti", "alla data della redazione della valutazione di sicurezza e/o del progetto d’intervento", "completamente realizzata"]);
    assert.deepEqual(third?.text?.inline?.filter(({ kind }) => kind === "em").map(({ value }) => value), ["struttura completamente realizzata"]);
});

test("C8.2 e C8.5 conservano capoversi, enfasi e struttura delle tabelle", async () => {
    const c82 = await unit("c8.2");
    const note = c82.blocks.find((block) => block.kind === "footnote");
    assert.equal(note?.text?.paragraphs?.length, 2);
    assert.equal(note?.text?.paragraphs?.[1]?.normalized.startsWith("Per quanto riguarda le costruzioni esistenti di c.a."), true);

    for (const number of ["c8.5.2.1", "c8.5.2.2"]) {
        const current = await unit(number);
        const indagini = current.blocks.filter((block) => /^Indagini (limitate|estese|esaustive):/u.test(block.text?.normalized ?? ""));
        assert.equal(indagini.length, 3);
        assert.equal(indagini.every((block) => block.text?.inline?.[0]?.kind === "strong-em"), true);
    }
    const c8522 = await unit("c8.5.2.2");
    const underlined = c8522.blocks.find((block) => block.text?.inline?.some((segment) => segment.kind === "underline"));
    assert.equal(underlined?.text?.inline?.filter(({ kind }) => kind === "underline").length, 4);
    assert.equal(underlined?.text?.inline?.some(({ kind, value }) => kind === "underline" && value === "Per gli elementi aventi funzione strutturale la geometria esterna deve essere"), true);
    const informationLead = c8522.blocks.find((block) => block.text?.normalized.includes("il rilievo dei dettagli costruttivi è finalizzato a conseguire le seguenti informazioni"));
    assert.equal(informationLead?.text?.inline?.some(({ kind, value }) => kind === "underline" && value === "il rilievo dei dettagli costruttivi è finalizzato a conseguire le seguenti informazioni:"), true);

    const c8531 = await unit("c8.5.3.1");
    const prove = c8531.blocks.filter((block) => /^Prove (limitate|estese|esaustive):/u.test(block.text?.normalized ?? ""));
    assert.equal(prove.length, 3);
    assert.equal(prove.every((block) => block.text?.inline?.[0]?.kind === "strong-em"), true);
    const consolidationTitles = [
        "Consolidamento con iniezioni di miscele leganti",
        "Consolidamento con intonaco armato",
        "Consolidamento con diatoni artificiali o tirantini antiespulsivi",
        "Consolidamento con ristilatura armata e connessione dei paramenti",
    ];
    assert.equal(consolidationTitles.every((title) => c8531.blocks.find((block) => block.kind === "heading" && block.text?.normalized === title)?.text?.inline?.[0]?.kind === "strong-em"), true);

    const assets = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C8.5-step1.json"), "utf8")) as AssetManifest;
    const tableI = assets.tables.find((table) => table.officialNumber === "C8.5.I");
    const tableII = assets.tables.find((table) => table.officialNumber === "C8.5.II");
    assert.equal(tableI?.headers.length, 3);
    assert.equal(tableI?.headers[0]?.[0]?.rowSpan, 3);
    assert.equal(tableI?.headers.flat().every((cell) => cell.align === "center" || cell === tableI.headers[0]?.[0]), true);
    assert.deepEqual(tableI?.columnWidths, [23, 13, 13, 13, 13, 13, 12]);
    assert.equal(tableI?.headers[1]?.length, 6);
    assert.equal(tableI?.headers[1]?.[2]?.latex, "\\left(\\mathrm{N/mm^2}\\right)");
    assert.equal(tableI?.headers[1]?.[5]?.latex, "\\left(\\mathrm{kN/m^3}\\right)");
    assert.equal(tableI?.headers[0]?.[3]?.rowSpan, undefined);
    assert.equal(tableI?.headers[0]?.[6]?.rowSpan, undefined);
    assert.equal(tableI?.rows.every((row) => row.slice(1).every((cell) => cell.noWrap === true)), true);
    assert.equal(tableI?.notesInline?.[1]?.some(({ kind, value }) => kind === "math" && value === "f"), true);
    assert.equal(tableII?.headers[1]?.every((cell) => cell.verticalText && cell.align === "center"), true);
    assert.deepEqual(tableII?.headers[1]?.map((cell) => cell.text), [
        "Malta buona",
        "Ricorsi o\nlistature",
        "Connessione\ntrasversale",
        "Iniezione di\nmiscele leganti (*)",
        "Intonaco armato (**)",
        "Ristilatura armata\ncon connessione\ndei paramenti (**)",
        "Massimo\ncoefficiente\ncomplessivo",
    ]);
    assert.equal(tableII?.rows.every((row) => row.slice(1).every((cell) => cell.align === "center")), true);
    assert.equal(tableII?.notesInline?.[2]?.some(({ kind, value }) => kind === "math" && value === "f_m^{0,35}"), true);
});

test("C8.5.3.2–C8.5.5.1 conservano enfasi, elenchi annidati e note di tabella", async () => {
    for (const number of ["c8.5.3.2", "c8.5.3.3"]) {
        const current = await unit(number);
        const labels = current.blocks.filter((block) => /^(Calcestruzzo|Acciaio|Unioni di elementi d’acciaio|Prove limitate|Prove estese|Prove esaustive):/u.test(block.text?.normalized ?? ""));
        assert.equal(labels.length, number === "c8.5.3.2" ? 6 : 3);
        assert.equal(labels.every((block) => block.text?.inline?.[0]?.kind === "strong-em"), true);
    }
    for (const number of ["c8.5.4", "c8.5.4.2"]) {
        const current = await unit(number);
        const phrases = number === "c8.5.4"
            ? ["indagini limitate", "prove limitate", "indagini estese", "prove estese", "indagini esaustive", "prove esaustive"]
            : ["indagini limitate", "prove limitate", "indagine estesa", "prove estese", "indagine esaustiva", "prove esaustive"];
        assert.equal(phrases.every((phrase) => current.blocks.some((block) => block.text?.inline?.some(({ kind, value }) => kind === "strong-em" && value === phrase))), true);
    }

    const c8541 = await unit("c8.5.4.1");
    const lcLabels = c8541.blocks.filter((block) => /^LC[123]:/u.test(block.text?.normalized ?? ""));
    assert.equal(lcLabels.length, 3);
    assert.equal(lcLabels.every((block) => block.kind === "list-item" && block.listMarker === "none" && block.listLevel === 0 && block.text?.inline?.[0]?.kind === "strong-em"), true);
    const nested = c8541.blocks.filter((block) => block.listMarker === "dash");
    assert.equal(nested.length, 2);
    assert.equal(nested.every((block) => block.listLevel === 1 && !block.text?.normalized.startsWith("-")), true);
    const lc3Nested = c8541.blocks.find((block) => block.blockId.endsWith("#block-006-nested"));
    assert.equal(lc3Nested?.kind, "list-item");
    assert.equal(lc3Nested?.listMarker, "none");
    assert.equal(lc3Nested?.listLevel, 1);
    assert.equal(lc3Nested?.indentLevel, 1);
    assert.equal(c8541.blocks.filter((block) => block.kind === "formula-ref" && block.indentLevel === 1).every((block) => block.listLevel === undefined), true);
    assert.equal(c8541.blocks.some((block) => block.text?.normalized.startsWith("(*)")), false);
    assert.equal(c8541.blocks.some((block) => block.text?.normalized.startsWith("(**)")), false);

    const c8551 = await unit("c8.5.5.1");
    const labeled = c8551.blocks.filter((block) => block.kind === "list-item");
    assert.equal(labeled.length, 2);
    assert.equal(labeled.every((block) => block.listMarker === "none" && block.text?.inline?.[0]?.kind === "math"), true);
    const underlined = c8551.blocks.find((block) => block.text?.normalized.startsWith("in cui "));
    assert.equal(underlined?.text?.inline?.some(({ kind }) => kind === "underline"), true);

    const assets = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C8.5-step2.json"), "utf8")) as AssetManifest;
    const tableIII = assets.tables.find((table) => table.officialNumber === "C8.5.III");
    const tableIV = assets.tables.find((table) => table.officialNumber === "C8.5.IV");
    const tableV = assets.tables.find((table) => table.officialNumber === "C8.5.V");
    const tableVI = assets.tables.find((table) => table.officialNumber === "C8.5.VI");
    assert.equal(tableIII?.notes?.length, 2);
    assert.equal(tableIII?.notesInline?.[0]?.[0]?.latex, "^{(*)}");
    assert.equal(tableIII?.notesInline?.[1]?.[0]?.latex, "^{(**)}");
    assert.equal(tableIII?.rows.every((row) => row.length === 3 ? row[0]?.align === "left" && row.slice(1).every((cell) => cell.align === "center") : row.every((cell) => cell.align === "center")), true);
    assert.equal(tableIII?.rows.flat().some((cell) => cell.text === "f (*)" && cell.inline?.some(({ kind, value }) => kind === "math" && value === "(*)")), true);
    assert.equal(tableIV?.headers[0]?.[0]?.text, "Livello di\nconoscenza");
    assert.equal(tableIV?.headers[0]?.[1]?.text, "Geometrie\n(carpenterie)");
    assert.equal(tableIV?.headers.flat().every((cell) => cell.align === "center"), true);
    for (const table of [tableV, tableVI]) {
        assert.equal(table?.headers.flat().every((cell) => cell.align === "center"), true);
        assert.equal(table?.headers[0]?.[1]?.inline?.some(({ latex }) => latex === "^{(a)}"), true);
        assert.equal(table?.headers[0]?.[2]?.inline?.some(({ latex }) => latex === "^{(d)}"), true);
    }
});

test("C8.7.1 conserva i label matematici e gli elenchi annidati", async () => {
    const c871211 = await unit("c8.7.1.2.1.1");
    assert.equal(c871211.blocks[0]?.text?.inline?.[1]?.kind, "strong-em");
    assert.equal(c871211.blocks[1]?.text?.inline?.some(({ kind, value }) => kind === "math" && value === "q"), true);
    assert.equal(c871211.blocks[3]?.text?.inline?.some(({ kind, latex }) => kind === "math" && latex === "\\alpha_0"), true);
    assert.equal(c871211.blocks.filter((block) => block.listMarker === "none").length, 15);

    const c871216 = await unit("c8.7.1.2.1.6");
    const slv = c871216.blocks.find((block) => block.text?.normalized.startsWith("SLV:"));
    assert.equal(slv?.kind, "list-item");
    assert.equal(slv?.listMarker, "none");
    assert.equal(slv?.listLevel, 0);
    assert.equal(c871216.blocks.some((block) => block.text?.normalized.startsWith("SLC:") && block.text?.inline?.some(({ latex }) => latex === "\\mathbf{SLC}")), true);
    assert.equal(c871216.blocks.filter((block) => block.listMarker === "dash").every((block) => block.listLevel === 1), true);

    const c87131 = await unit("c8.7.1.3.1");
    const slc = c87131.blocks.find((block) => block.text?.normalized.startsWith("SLC:"));
    assert.equal(slc?.kind, "list-item");
    assert.equal(slc?.listMarker, "none");
    assert.equal(slc?.listLevel, 0);
    assert.equal(c87131.blocks.filter((block) => ["SLC:", "SLV:", "SLD:", "SLO:"].some((label) => block.text?.normalized.startsWith(label))).every((block) => block.text?.inline?.[0]?.kind === "strong-em"), true);
    assert.equal(c87131.blocks.filter((block) => block.listMarker === "dash").every((block) => block.listLevel === 1), true);

    const c87121 = await unit("c8.7.1.2.1");
    const approach = c87121.blocks.find((block) => block.text?.normalized.startsWith("Nel caso di analisi statica"));
    assert.deepEqual(approach?.text?.inline?.filter(({ kind }) => kind === "strong-em").map(({ value }) => value), ["approccio cinematico lineare", "approccio cinematico non lineare"]);
});

test("C8.7.2.4.2–C8.7.6.3 conservano matematica, capoversi, elenchi e tabelle", async () => {
    const c87242 = await unit("c8.7.2.4.2");
    const capacities = c87242.blocks.find((block) => block.text?.normalized.includes("member deformation capacities"));
    assert.equal(capacities?.text?.inline?.some(({ kind, value }) => kind === "em" && value === "member deformation capacities"), true);
    assert.equal(capacities?.text?.inline?.filter(({ kind, latex }) => kind === "math" && latex === "\\theta_y").length, 2);

    const c873 = await unit("c8.7.3");
    assert.equal(c873.blocks.filter((block) => block.kind === "paragraph").length, 2);
    assert.equal(c873.blocks[2]?.text?.normalized.startsWith("L’analisi statica non lineare"), true);
    assert.equal(c873.blocks[2]?.text?.normalized.includes("La verifica deve condursi"), true);

    const c8741 = await unit("c8.7.4.1");
    const numbered = c8741.blocks.slice(3, 8);
    assert.equal(numbered.length, 5);
    assert.equal(numbered.every((block) => block.kind === "list-item" && block.listMarker === "none" && /^\d+\.\s/u.test(block.text?.normalized ?? "") && block.listLevel === 0), true);
    assert.deepEqual(c8741.blocks.slice(9, 10).map((block) => [block.kind, block.text?.normalized]), [["heading", "1. Formazione dei diaframmi di piano"]]);
    const cordoli = c8741.blocks.filter((block) => /^Cordoli /u.test(block.text?.normalized ?? ""));
    assert.equal(cordoli.length, 4);
    assert.equal(cordoli.every((block) => block.kind === "list-item" && block.listMarker === "dash" && block.text?.inline?.[0]?.kind === "strong-em"), true);
    assert.equal(c8741.blocks.some((block) => block.text?.inline?.some(({ kind, value }) => kind === "strong-em" && value === "nuove aperture")), true);
    assert.equal(c8741.blocks.find((block) => block.text?.normalized.includes("adeguatamente le fondazioni"))?.text?.normalized.startsWith("L’intervento va realizzato"), true);
    assert.equal(c8741.blocks.find((block) => block.text?.normalized.includes("iniezioni di miscele cementizie"))?.text?.normalized.startsWith("Gli interventi di consolidamento"), true);
    assert.equal(c8741.blocks.find((block) => block.text?.normalized.includes("fabbricato, è consigliabile"))?.text?.normalized.startsWith("Nel caso di cedimenti"), true);

    const c87421 = await unit("c8.7.4.2.1");
    assert.equal(c87421.blocks.filter((block) => block.text?.normalized.includes("elemento incamiciato") || block.text?.normalized.includes("carico assiale") || block.text?.normalized.includes("proprietà meccaniche del calcestruzzo")).every((block) => block.kind === "list-item" && block.listMarker === "dash"), true);
    assert.equal(c87421.blocks.filter((block) => block.text?.normalized.startsWith("capacità in termini")).every((block) => block.listMarker === "dash" && block.listLevel === 0), true);
    assert.equal(c87421.blocks.filter((block) => block.kind === "formula-ref").every((block) => block.indentLevel === 1), true);

    const c87422 = await unit("c8.7.4.2.2");
    assert.equal(c87422.blocks.find((block) => block.text?.normalized.startsWith("Per le proprietà del calcestruzzo confinato"))?.kind, "paragraph");
    assert.equal(c87422.blocks.find((block) => block.text?.normalized.startsWith("per la resistenza del calcestruzzo confinato"))?.kind, "paragraph");
    const deformation = c87422.blocks.find((block) => block.text?.normalized.startsWith("per la deformazione ultima"));
    assert.equal(deformation?.listMarker, "dash");
    assert.equal(deformation?.text?.inline?.[0]?.kind, "strong");
    assert.equal(c87422.blocks.filter((block) => /^(?:a|b)\)/u.test(block.text?.normalized ?? "")).length, 2);

    const assets = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C8.7-step3b.json"), "utf8")) as AssetManifest;
    const tableI = assets.tables.find((table) => table.officialNumber === "C8.7.6.3.I");
    const tableII = assets.tables.find((table) => table.officialNumber === "C8.7.6.3.II");
    assert.equal(tableI?.headers.length, 1);
    assert.equal(tableI?.headers.flat().every((cell) => cell.align === "center" && cell.shade === undefined && cell.strong === true), true);
    assert.equal(tableI?.rows.filter((row) => row[0]?.colSpan === 12).every((row) => row[0]?.shade === "gray" && row[0]?.strong === true), true);
    assert.equal(tableI?.notesInline?.[3]?.some(({ kind, latex }) => kind === "math" && latex === "\\frac{h_c}{x_{\\min}}"), true);
    assert.equal(tableII?.headers.flat().every((cell) => cell.align === "center" && cell.shade === undefined && cell.strong === true), true);
    assert.equal(tableII?.rows.flat().every((cell) => cell.align === "center"), true);
});

test("C8.8 conserva capoversi, titoli corsivi e matematica inline", async () => {
    const c884 = await unit("c8.8.4");
    assert.equal(c884.blocks.length, 2);
    assert.equal(c884.blocks[1]?.text?.normalized.endsWith("indagini effettuate."), true);

    const c8853 = await unit("c8.8.5.3");
    for (const title of ["Ponti a travi semplicemente appoggiate", "Ponti con impalcato continuo"]) {
        const item = c8853.blocks.find((block) => block.text?.normalized.includes(title));
        assert.equal(item?.text?.inline?.some(({ kind, value }) => kind === "em" && value === title), true);
    }

    const c887 = await unit("c8.8.7");
    const final = c887.blocks.find((block) => block.text?.normalized.includes("ζ_E=0,80"));
    assert.equal(final?.text?.inline?.some(({ kind, latex }) => kind === "math" && latex === "\\zeta_E=0{,}80"), true);
    const c8855 = await unit("c8.8.5.5");
    assert.equal(c8855.blocks.slice(2, 4).every((block) => block.kind === "list-item" && block.listMarker === "dash"), true);
    assert.ok(c8855.blocks[3]?.text?.inline?.some((segment) => segment.kind === "math" && segment.latex === "\\theta>\\theta_y"));
});
