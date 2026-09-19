/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitRoot = join(root, "corpus", "units", "ntc2018");
const assetRoot = join(root, "corpus", "assets", "ntc2018");
const figureRoot = join(root, "corpus", "assets", "figures", "ntc2018");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const writeJson = async (path: string, value: unknown) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const cell = (text: string, extra: Record<string, unknown> = {}) => ({ text, ...extra });
const setInline = (item: any, inline: any[]) => {
    item.text = inline.map((segment) => segment.value).join("");
    item.inline = inline;
    delete item.latex;
};

function center(table: any) {
    for (const row of [...table.headers, ...table.rows, ...(table.footerRows ?? [])]) for (const item of row) item.align = "center";
}

function tableImage(filename: string, alt: string, x: number, y: number, width: number, height: number) {
    return {
        image: {
            imagePath: `figures/ntc2018/${filename}`,
            alt,
            sha256: "",
            region: { coordinateSystem: "pdf-points-top-left", x, y, width, height },
        },
    };
}

function qHeadingInline(text: string) {
    const match = text.match(/^(.*?)(q)([1-9])$/u);
    return match ? [{ kind: "text", value: match[1] }, { kind: "math", value: `${match[2]}${match[3]}`, latex: `q_{${match[3]}}` }] : undefined;
}

function fixLabeledSchemas(record: any) {
    for (const block of record.blocks) {
        if (!["paragraph", "list-item"].includes(block.kind) || !block.text?.inline) continue;
        const label = block.text.inline[0];
        if (label?.kind !== "em" || !/^Sche(?:ma|mi) di Carico [1-6]/u.test(label.value)) continue;
        if (!label.value.endsWith(":")) {
            const separator = block.text.inline[1];
            if (separator?.kind === "text" && separator.value.startsWith(": ")) {
                label.value += ":";
                block.text.inline.splice(1, 1);
            }
        }
        block.kind = "list-item";
        block.listMarker = "none";
    }
}

function inlineSlice(inline: any[], full: string, start: number, end: number) {
    const result: any[] = [];
    let cursor = 0;
    for (const segment of inline) {
        const segmentStart = cursor;
        const segmentEnd = cursor + segment.value.length;
        cursor = segmentEnd;
        if (segmentEnd <= start || segmentStart >= end) continue;
        const left = Math.max(start, segmentStart) - segmentStart;
        const right = Math.min(end, segmentEnd) - segmentStart;
        if (left === 0 && right === segment.value.length) result.push(segment);
        else if (segment.kind === "text") result.push({ kind: "text", value: segment.value.slice(left, right) });
        else result.push({ kind: "text", value: full.slice(Math.max(start, segmentStart), Math.min(end, segmentEnd)) });
    }
    return result.length ? result : [{ kind: "text", value: full.slice(start, end) }];
}

function fixCentrifugalList(record: any) {
    const marker = record.blocks.find((block: any) => block.kind === "paragraph" && block.text?.normalized?.startsWith("dove: Qtk-qtk ="));
    if (!marker || !marker.text.inline) return;
    const definitions = [
        "Qtk-qtk = valore caratteristico della forza centrifuga [kN - kN/m];",
        "Qvk-qvk = valore caratteristico dei carichi verticali [kN - kN/m];",
        "α = coefficiente di adattamento;",
        "v = velocità di progetto espressa in m/s;",
        "V = velocità di progetto espressa in km/h;",
        "f = fattore di riduzione (definito in seguito nella 5.2.10);",
        "g = accelerazione di gravità in m/s²;",
        "r = raggio di curvatura in m.",
    ];
    const full = marker.text.normalized;
    const dove = { ...marker, kind: "paragraph", text: { ...marker.text, raw: "dove:", normalized: "dove:", inline: [{ kind: "text", value: "dove:" }] } };
    dove.evidence = { ...marker.evidence, rawSha256: sha256("dove:"), normalizedSha256: sha256("dove:") };
    const labels = definitions.map((definition) => {
        const start = full.indexOf(definition);
        if (start < 0) throw new Error(`Definizione non trovata nell'estrazione: ${definition}`);
        const inline = inlineSlice(marker.text.inline, full, start, start + definition.length);
        return {
            ...marker,
            kind: "list-item",
            listMarker: "none",
            text: { ...marker.text, raw: definition, normalized: definition, inline },
            evidence: { ...marker.evidence, rawSha256: sha256(definition), normalizedSha256: sha256(definition) },
        };
    });
    const index = record.blocks.indexOf(marker);
    record.blocks.splice(index, 1, dove, ...labels);
    record.blocks.forEach((block: any, blockIndex: number) => { block.blockId = `${record.id}#block-${blockIndex === 0 ? "heading" : `editorial-${String(blockIndex).padStart(3, "0")}`}`; });
}

function appendFormattingNote(block: any, note: string) {
    block.evidence = {
        ...block.evidence,
        transformations: [...(block.evidence?.transformations ?? []), {
            operation: "manual-correction",
            ruleVersion: "ntc5-step4-editorial-formatting-0.1.0",
            note,
        }],
    };
}

function fixReductionList(record: any) {
    const marker = record.blocks.find((block: any) => block.kind === "paragraph" && block.text?.normalized?.startsWith("dove: Lf ="));
    if (!marker?.text?.inline || marker.text.normalized.includes("\tdove:")) return;
    const full = marker.text.normalized;
    const definitions = [
        { value: "Lf =", latex: "L_f=" },
        { value: "f = 1", latex: "f=1" },
        { value: "f < 1", latex: "f<1" },
        { value: "f(V) = f(300)", latex: "f(V)=f(300)" },
    ];
    const definitionTexts = [
        "Lf = lunghezza di influenza, in metri, della parte curva di binario carico sul ponte, che è la più sfavorevole per il progetto del generico elemento strutturale;",
        "f = 1 per V ≤ 120 km/h o Lf ≤ 2,88 m;",
        "f < 1 per 120 ≤ V ≤ 300 km/h e Lf > 2,88 m;",
        "f(V) = f(300) per V > 300 km/h.",
    ];
    const dove = { ...marker, kind: "paragraph", text: { ...marker.text, raw: "dove:", normalized: "dove:", inline: [{ kind: "text", value: "dove:" }] } };
    dove.evidence = { ...marker.evidence, rawSha256: sha256("dove:"), normalizedSha256: sha256("dove:") };
    const labels = definitions.map((label, index) => {
        const definition = definitionTexts[index]!;
        const start = full.indexOf(definition);
        if (start < 0) throw new Error(`Definizione non trovata nell'estrazione: ${definition}`);
        const labelStart = start + label.value.length;
        const inline = [{ kind: "math", value: label.value, latex: label.latex }, ...inlineSlice(marker.text.inline, full, labelStart, start + definition.length)];
        return {
            ...marker,
            kind: "list-item",
            listMarker: "none",
            text: { ...marker.text, raw: definition, normalized: definition, inline },
            evidence: { ...marker.evidence, rawSha256: sha256(definition), normalizedSha256: sha256(definition) },
        };
    });
    labels.forEach((block: any) => appendFormattingNote(block, "Segmentato l’elenco labeled dopo la formula [5.2.10] e allineate le descrizioni sulla colonna della label."));
    const index = record.blocks.indexOf(marker);
    record.blocks.splice(index, 1, dove, ...labels);
    record.blocks.forEach((block: any, blockIndex: number) => { block.blockId = `${record.id}#block-${blockIndex === 0 ? "heading" : `editorial-${String(blockIndex).padStart(3, "0")}`}`; });
}

function fixAerodynamicList(record: any) {
    const marker = record.blocks.find((block: any) => block.kind === "list-item" && block.text?.normalized?.startsWith("sulla superficie orizzontale ± k5"));
    const first = "sulla superficie orizzontale ± k5 · q2k, con:";
    if (!marker?.text?.inline) return;
    if (marker.text.normalized === first) {
        const index = record.blocks.indexOf(marker);
        const duplicate = record.blocks.slice(index + 1, index + 4);
        if (duplicate.length === 3 && duplicate[0].text?.inline?.[1]?.value.startsWith("lla superficie")) record.blocks.splice(index + 1, 3);
        return;
    }
    const definitions = [
        { text: "q2k determinato in accordo con il punto 5.2.2.6.2;", value: "q2k", latex: "q_{2k}" },
        { text: "k5 = 2,5 se la struttura racchiude un solo binario;", value: "k5 = 2,5", latex: "k_5=2{,}5" },
        { text: "k5 = 3,5 se la struttura racchiude due binari.", value: "k5 = 3,5", latex: "k_5=3{,}5" },
    ];
    const full = marker.text.normalized;
    const prefixInline = inlineSlice(marker.text.inline, full, 0, first.length);
    const lead = { ...marker, text: { ...marker.text, raw: `- ${first}`, normalized: first, inline: prefixInline } };
    lead.evidence = { ...marker.evidence, rawSha256: sha256(`- ${first}`), normalizedSha256: sha256(first) };
    const labels = definitions.map((definition) => {
        const start = full.indexOf(definition.text);
        const labelStart = start + definition.value.length;
        const inline = [{ kind: "math", value: definition.value, latex: definition.latex }, ...inlineSlice(marker.text.inline, full, labelStart, start + definition.text.length)];
        const block = {
            ...marker,
            kind: "list-item",
            listMarker: "none",
            text: { ...marker.text, raw: definition.text, normalized: definition.text, inline },
            evidence: { ...marker.evidence, rawSha256: sha256(definition.text), normalizedSha256: sha256(definition.text) },
        };
        appendFormattingNote(block, "Separati i valori labeled dopo il secondo punto dell’elenco e allineate le descrizioni sulla colonna della label.");
        return block;
    });
    const index = record.blocks.indexOf(marker);
    record.blocks.splice(index, 1, lead, ...labels);
    record.blocks.forEach((block: any, blockIndex: number) => { block.blockId = `${record.id}#block-${blockIndex === 0 ? "heading" : `editorial-${String(blockIndex).padStart(3, "0")}`}`; });
}

function fixCatenarySpacing(record: any) {
    for (const block of record.blocks.filter((candidate: any) => candidate.kind === "list-item" && candidate.listMarker === "none")) {
        const match = block.text?.normalized?.match(/^(\d+ catenari(?:a|e)) (per .*)$/u);
        if (!match || block.text.normalized.includes("\t")) continue;
        const normalized = `${match[1]}\t${match[2]}`;
        block.text = { ...block.text, normalized, inline: [{ kind: "text", value: `${match[1]}\t` }, { kind: "text", value: match[2] }] };
        block.evidence = { ...block.evidence, normalizedSha256: sha256(normalized) };
        appendFormattingNote(block, "Inserita una tabulazione tra label numerica e descrizione per riprodurre il respiro tipografico della fonte.");
    }
}

function superscriptNotes(table: any) {
    for (const row of [...table.headers, ...table.rows, ...(table.footerRows ?? [])]) for (const item of row) {
        const text = item.text ?? "";
        const single = text.match(/^(\d+[,.]\d+) \((\d+)\)$/u);
        const double = text.match(/^\((\d+)\) \((\d+)\)$/u);
        const note = text.match(/^\((\d+)\)$/u);
        if (single) item.latex = `${single[1].replace(",", "{,}")}^{(${single[2]})}`;
        else if (double) item.latex = `{}^{(${double[1]})}\\,{}^{(${double[2]})}`;
        else if (note) item.latex = `{}^{(${note[1]})}`;
        else if (/\(\d+\)/u.test(text)) {
            const inline: any[] = [];
            let cursor = 0;
            for (const match of text.matchAll(/\(\d+\)/gu)) {
                const start = match.index ?? 0;
                if (start > cursor) inline.push({ kind: "text", value: text.slice(cursor, start) });
                inline.push({ kind: "math", value: match[0], latex: `^{${match[0]}}` });
                cursor = start + match[0].length;
            }
            if (cursor < text.length) inline.push({ kind: "text", value: text.slice(cursor) });
            setInline(item, inline);
        }
    }
}

function inlineMathNotes(table: any) {
    table.notesInline = (table.notes ?? []).map((text: string) => {
        const inline: any[] = [];
        const label = text.match(/^\((\d+)\)\s*/u);
        let cursor = 0;
        if (label) {
            inline.push({ kind: "math", value: label[0].trim(), latex: `^{(${label[1]})}` });
            if (label[0].length > label[0].trim().length) inline.push({ kind: "text", value: " " });
            cursor = label[0].length;
        }
        for (const match of text.matchAll(/Ψ([0-2])?/gu)) {
            const start = match.index ?? 0;
            if (start > cursor) inline.push({ kind: "text", value: text.slice(cursor, start) });
            const subscript = match[1] ? `_${match[1]}` : "";
            inline.push({ kind: "math", value: match[0], latex: `\\psi${subscript}` });
            cursor = start + match[0].length;
        }
        if (cursor < text.length) inline.push({ kind: "text", value: text.slice(cursor) });
        return inline.length ? inline : [{ kind: "text", value: text }];
    });
}

async function main() {
    const step1 = await readJson(join(assetRoot, "5.1-step1.json"));
    const step2 = await readJson(join(assetRoot, "5.1-step2.json"));
    const step3 = await readJson(join(assetRoot, "5.1-step3.json"));

    for (const number of ["5.1.I", "5.1.II", "5.1.III", "5.1.IV", "5.1.V", "5.1.VI"]) center(step1.tables.find((item: any) => item.officialNumber === number));
    const tI = step1.tables.find((item: any) => item.officialNumber === "5.1.I");
    tI.headers[0] = [
        cell("Larghezza della superfi-\ncie carrabile w", { latex: "\\begin{gathered}\\text{Larghezza della superfi-}\\\\\\text{cie carrabile }w\\end{gathered}", align: "center" }),
        cell("Numero di corsie\nconvenzionali", { latex: "\\begin{gathered}\\text{Numero di corsie}\\\\\\text{convenzionali}\\end{gathered}", align: "center" }),
        cell("Larghezza di una corsia\nconvenzionale [m]", { latex: "\\begin{gathered}\\text{Larghezza di una corsia}\\\\\\text{convenzionale }[\\mathrm{m}]\\end{gathered}", align: "center" }),
        cell("Larghezza della zona\nrimanente [m]", { latex: "\\begin{gathered}\\text{Larghezza della zona}\\\\\\text{rimanente }[\\mathrm{m}]\\end{gathered}", align: "center" }),
    ];
    const tIV = step1.tables.find((item: any) => item.officialNumber === "5.1.IV");
    tIV.columnWidths = [11, 15, 11, 14, 13, 13, 23];
    tIV.headers = [
        [cell("", { rowSpan: 2, header: false, align: "center" }), cell("Carichi sulla superficie carrabile", { colSpan: 5, align: "center" }), cell("Carichi su marciapiedi e piste ciclabili non\nsormontabili", { align: "center" })],
        [cell("Carichi verticali", { colSpan: 3, align: "center" }), cell("Carichi orizzontali", { colSpan: 2, align: "center" }), cell("Carichi verticali", { align: "center" })],
        [cell("Gruppo di azioni", { align: "center" }), cell("Modello principale (schemi di carico 1, 2, 3, 4 e 6)", { align: "center" }), cell("Veicoli speciali", { align: "center" }), cell("Folla (Schema di carico 5)", { align: "center" }), cell("Frenatura", { align: "center" }), cell("Forza centrifuga", { align: "center" }), cell("Carico uniformemente distribuito", { align: "center" })],
    ];
    tIV.rows[0][1].text = "Valore\ncaratteristico";
    tIV.rows[1][1].text = "Valore\nfrequente";
    tIV.rows[2][1].text = "Valore\nfrequente";
    tIV.rows[1][4].text = "Valore\ncaratteristico";
    tIV.rows[2][5].text = "Valore\ncaratteristico";
    tIV.rows[5][1].text = "Da definirsi\nper il singolo\nprogetto";
    tIV.rows[5][2].text = "Valore caratteristico\no nominale";
    setInline(tIV.rows[0][6], [
        { kind: "text", value: "Schema di carico 5 con valore di\ncombinazione " },
        { kind: "math", value: "2,5 kN/m²", latex: "2{,}5\\,\\mathrm{kN/m^2}" },
    ]);
    for (const cellRef of [tIV.rows[3][6], tIV.rows[4][3], tIV.rows[4][6]]) setInline(cellRef, [
        { kind: "text", value: "Schema di carico 5 con valore\ncaratteristico " },
        { kind: "math", value: "5,0 kN/m²", latex: "5{,}0\\,\\mathrm{kN/m^2}" },
    ]);
    delete tIV.rows[4][1].shade;
    for (const [row, column] of [[0, 1], [1, 4], [2, 5], [3, 6], [4, 3], [4, 6], [5, 1], [5, 2]] as const) tIV.rows[row][column].shade = "gray";
    const tV = step1.tables.find((item: any) => item.officialNumber === "5.1.V");
    tV.headers[0][4] = cell("A_1", { latex: "A_{1}", align: "center" });
    tV.headers[0][5] = cell("A_2", { latex: "A_{2}", align: "center" });
    if (!tV.rows[0][0].rowSpan) {
        for (let index = 0; index < tV.rows.length; index += 2) {
            tV.rows[index][0].rowSpan = 2;
            tV.rows[index][2].rowSpan = 2;
            tV.rows[index + 1].splice(2, 1);
            tV.rows[index + 1].splice(0, 1);
        }
    }
    const tVI = step1.tables.find((item: any) => item.officialNumber === "5.1.VI");
    tVI.columnWidths = [14, 28, 19, 19, 20];
    tVI.headers[0][1] = cell("Gruppo di azioni\n(Tab. 5.1.IV)", { latex: "\\begin{gathered}\\text{Gruppo di azioni}\\\\\\text{(Tab. 5.1.IV)}\\end{gathered}", align: "center" });
    tVI.headers[0][2] = cell("Coefficiente\nΨ0 di combi-\nnazione", { latex: "\\begin{gathered}\\text{Coefficiente}\\\\\\psi_0\\text{ di combi-}\\\\\\text{nazione}\\end{gathered}", align: "center" });
    tVI.headers[0][3] = cell("Coefficiente\nΨ1 (valori\nfrequenti)", { latex: "\\begin{gathered}\\text{Coefficiente}\\\\\\psi_1\\text{ (valori}\\\\\\text{frequenti)}\\end{gathered}", align: "center" });
    tVI.headers[0][4] = cell("Coefficiente\nΨ2 (valori quasi\npermanenti)", { latex: "\\begin{gathered}\\text{Coefficiente}\\\\\\psi_2\\text{ (valori quasi}\\\\\\text{permanenti)}\\end{gathered}", align: "center" });
    tVI.rows[0][0].text = "Azioni da\ntraffico\n(Tab. 5.1.IV)";
    if (!tVI.rows[0][0].rowSpan) {
        for (const [start, length] of [[0, 8], [8, 3], [11, 2]] as const) {
            tVI.rows[start][0].rowSpan = length;
            for (let index = start + length - 1; index > start; index -= 1) tVI.rows[index].splice(0, 1);
        }
    }

    const tVII = step2.tables.find((item: any) => item.officialNumber === "5.1.VII");
    tVII.columnWidths = [26, 24, 30, 20];
    tVII.headers[0][1] = cell("Distanza tra\ngli assi (m)", { latex: "\\begin{gathered}\\text{Distanza tra}\\\\\\text{gli assi }(\\mathrm{m})\\end{gathered}", align: "center" });
    tVII.headers[0][2] = cell("Carico frequente\nper asse (kN)", { latex: "\\begin{gathered}\\text{Carico frequente}\\\\\\text{per asse }(\\mathrm{kN})\\end{gathered}", align: "center" });
    tVII.headers[0][3].text = "Tipo di ruota\n(Tab. 5.1.IX)";
    const vii = [[100, 135, 80, 32], [100, 177, 85, 37], [86, 220, 100, 42], [86, 270, 100, 38], [78, 312, 115, 42]] as const;
    tVII.rows.forEach((row: any[], index: number) => {
        const [x, y, width, height] = vii[index]!;
        Object.assign(row[0], tableImage(`tab5.1.vii-vehicle-${index + 1}.png`, `Sagoma del veicolo ${index + 1}`, x, y, width, height));
    });
    const tVIII = step2.tables.find((item: any) => item.officialNumber === "5.1.VIII");
    tVIII.headers = [
        [cell("", { colSpan: 4 }), cell("COMPOSIZIONE DEL TRAFFICO", { colSpan: 3 })],
        [cell("Sagoma del veicolo"), cell("Tipo di\npneumatico\n(Tab. 5.1.IX)", { verticalText: true }), cell("Interassi [m]", { verticalText: true }), cell("Valori equi-\nvalenti dei ca-\nrichi per asse\n[kN]", { verticalText: true }), cell("Lunga\npercorrenza", { verticalText: true }), cell("Media\npercorrenza", { verticalText: true }), cell("Traffico\nlocale", { verticalText: true })],
    ];
    const viii = [[90, 289, 85, 38], [95, 333, 70, 35], [88, 385, 80, 45], [86, 445, 80, 40], [80, 505, 90, 45]] as const;
    tVIII.rows.forEach((row: any[], index: number) => {
        const [x, y, width, height] = viii[index]!;
        Object.assign(row[0], tableImage(`tab5.1.viii-vehicle-${index + 1}.png`, `Sagoma del veicolo equivalente ${index + 1}`, x, y, width, height));
        const tyreCell = row[1];
        const tyreLines = String(tyreCell.text ?? "").split("\n");
        if (tyreLines.length > 1) tyreCell.latex = `\\begin{gathered}${tyreLines.map((line: string) => `\\text{${line}}`).join("\\\\")}\\end{gathered}`;
    });
    const tIX = step2.tables.find((item: any) => item.officialNumber === "5.1.IX");
    const ix = [[155, 128, 210, 78], [155, 208, 210, 85], [155, 298, 210, 75]] as const;
    tIX.rows.forEach((row: any[], index: number) => {
        const [x, y, width, height] = ix[index]!;
        Object.assign(row[1], tableImage(`tab5.1.ix-type-${String.fromCharCode(97 + index)}.png`, `Dimensioni del tipo di pneumatico ${row[0].text}`, x, y, width, height));
    });
    tIX.notes = [];
    tVII.notes = [];
    tVIII.notes = [];
    const tX = step2.tables.find((item: any) => item.officialNumber === "5.1.X");
    tX.columnWidths = [57, 43];
    tX.headers[0][1].text = "Flusso annuo di veicoli di\npeso superiore a 100 kN\nsulla corsia di marcia lenta";
    tX.headers[0][1].latex = "\\begin{gathered}\\text{Flusso annuo di veicoli di}\\\\\\text{peso superiore a }100\\,\\mathrm{kN}\\\\\\text{sulla corsia di marcia lenta}\\end{gathered}";
    tX.rows[0][0].text = "1 - Strade ed autostrade con 2 o più corsie per senso di marcia,\ncaratterizzate da intenso traffico pesante";
    tX.rows[1][0].text = "2 - Strade ed autostrade caratterizzate da traffico pesante di\nmedia intensità";
    tX.rows[2][0].text = "3 - Strade principali caratterizzate da traffico pesante di mo-\ndesta intensità";
    tX.rows[3][0].text = "4 - Strade locali caratterizzate da traffico pesante di intensità\nmolto ridotta";
    const t52I = step2.tables.find((item: any) => item.officialNumber === "5.2.I");
    for (const table of [tVII, tVIII, tIX, tX, t52I]) center(table);

    const t52II = step3.tables.find((item: any) => item.officialNumber === "5.2.II");
    if (!t52II.rows[1][0].rowSpan) {
        for (const [start, length] of [[1, 3], [4, 3], [8, 5], [14, 9], [24, 8], [32, 2]] as const) {
            t52II.rows[start][0].rowSpan = length;
            for (let index = start + length - 1; index > start; index -= 1) t52II.rows[index].splice(0, 1);
        }
    }

    const t52IIb = step3.tables.find((item: any) => item.officialNumber === "5.2.II.b");
    t52IIb.columnWidths = [7, 9, 8, 8, 8, 32, 28];
    if (t52IIb.headers.length === 1) {
        t52IIb.headers = [
            [
                cell("Valore\ndi\nα", { latex: "\\begin{gathered}\\text{Valore}\\\\\\text{di}\\\\\\alpha\\end{gathered}", rowSpan: 2, align: "center" }),
                cell("Massima velo-\ncità della linea\n[km/h]", { rowSpan: 2, align: "center" }),
                cell("Azione centrifuga basata su", { colSpan: 4, align: "center" }),
                cell("carico verticale\nassociato", { rowSpan: 2, align: "center" }),
            ],
            [
                cell("V", { latex: "V", align: "center" }),
                cell("α", { latex: "\\alpha", align: "center" }),
                cell("f", { latex: "f", align: "center" }),
                cell("", { header: false, align: "center" }),
            ],
        ];
    }
    t52IIb.headers[0][0] = cell("Valore\ndi\nα", { latex: "\\begin{gathered}\\text{Valore}\\\\\\text{di}\\\\\\alpha\\end{gathered}", rowSpan: 2, align: "center" });
    if (!t52IIb.rows[0][0].rowSpan) {
        t52IIb.rows[0][0].rowSpan = 2;
        t52IIb.rows[0][6].rowSpan = 2;
        t52IIb.rows[1].splice(6, 1);
        t52IIb.rows[1].splice(0, 1);
        t52IIb.rows[2][0].rowSpan = 3;
        t52IIb.rows[2][1].rowSpan = 2;
        t52IIb.rows[2][6].rowSpan = 2;
        t52IIb.rows[3].splice(6, 1);
        t52IIb.rows[3].splice(1, 1);
        t52IIb.rows[3].splice(0, 1);
        t52IIb.rows[4].splice(0, 1);
    }
    const multiline = (item: any, first: string, second: string, latexFirst: string, latexSecond: string) => {
        item.text = `${first}\n${second}`;
        item.latex = `\\begin{gathered}${latexFirst}\\\\${latexSecond}\\end{gathered}`;
    };
    multiline(t52IIb.rows[2][5], "1 × f ×", "(LM71 “+” SW/0)", "1\\times f\\times", "(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})");
    multiline(t52IIb.rows[3][3], "α × 1 ×", "(LM71 “+” SW/0)", "\\alpha\\times1\\times", "(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})");
    multiline(t52IIb.rows[4][4], "α × 1 ×", "(LM71 “+” SW/0)", "\\alpha\\times1\\times", "(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})");
    multiline(t52IIb.rows[2][6], "Φ × 1 × 1 ×", "(LM71 “+” SW/0)", "\\Phi\\times1\\times1\\times", "(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})");
    multiline(t52IIb.rows[4][5], "Φ × α × 1 ×", "(LM71 “+” SW/0)", "\\Phi\\times\\alpha\\times1\\times", "(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})");
    center(t52IIb);

    const t52III = step3.tables.find((item: any) => item.officialNumber === "5.2.III");
    t52III.headers = [
        [
            cell("Numero\ndi binari", { rowSpan: 2, align: "center" }),
            cell("Binari\nCarichi", { rowSpan: 2, align: "center" }),
            cell("Traffico normale", { colSpan: 2, align: "center" }),
            cell("Traffico pesante(2)", { rowSpan: 2, align: "center" }),
        ],
        [cell("caso a(1)", { align: "center" }), cell("caso b(1)", { align: "center" })],
    ];
    if (!t52III.rows[1][0].rowSpan) {
        t52III.rows[1][0].rowSpan = 2;
        t52III.rows[2].splice(0, 1);
        t52III.rows[3][0].rowSpan = 3;
        t52III.rows[4].splice(0, 1);
        t52III.rows[5].splice(0, 1);
    }
    t52III.columnWidths = [12, 12, 30, 30, 16];
    center(t52III);
    superscriptNotes(t52III);
    inlineMathNotes(t52III);

    const step4 = await readJson(join(assetRoot, "5.1-step4.json"));
    const t52IV = step4.tables.find((item: any) => item.officialNumber === "5.2.IV");
    t52IV.headers = [
        [
            cell("TIPO DI\nCARICO", { align: "center" }),
            cell("Azioni verticali", { colSpan: 2, align: "center" }),
            cell("Azioni orizzontali", { colSpan: 3, align: "center" }),
            cell("Commenti", { rowSpan: 2, align: "center" }),
        ],
        [
            cell("Gruppi di\ncarico", { align: "center" }),
            cell("Carico\nverticale\n(1)", { align: "center" }),
            cell("Treno\nscarico", { align: "center" }),
            cell("Frenatura e\navviamento", { align: "center" }),
            cell("Centrifuga", { align: "center" }),
            cell("Serpeggio", { align: "center" }),
        ],
    ];
    for (const [row, column] of [[0, 1], [1, 2], [2, 3]] as const) t52IV.rows[row][column].shade = "gray";
    center(t52IV);
    superscriptNotes(t52IV);
    inlineMathNotes(t52IV);

    const t52V = step4.tables.find((item: any) => item.officialNumber === "5.2.V");
    t52V.headers = [[cell("", { header: false, align: "center" }), cell("Coefficiente", { colSpan: 2, align: "center" }), cell("EQU(1)", { align: "center" }), cell("A1", { align: "center" }), cell("A2", { align: "center" })]];
    if (!t52V.rows[0][0].rowSpan) {
        for (let index = 0; index < t52V.rows.length; index += 2) {
            t52V.rows[index][0].rowSpan = 2;
            t52V.rows[index][2].rowSpan = 2;
            t52V.rows[index + 1].splice(2, 1);
            t52V.rows[index + 1].splice(0, 1);
        }
    }
    center(t52V);
    superscriptNotes(t52V);
    inlineMathNotes(t52V);

    const t52VI = step4.tables.find((item: any) => item.officialNumber === "5.2.VI");
    if (t52VI.columnCount === 4) {
        const groups = ["Azioni singole\nda traffico", "Azioni singole\nda traffico", "Gruppi di\ncarico", "Gruppi di\ncarico", "Gruppi di\ncarico", "Gruppi di\ncarico", "Azioni del vento", "Azioni da\nneve", "Azioni da\nneve", "Azioni termiche"];
        const descriptions = ["Carico sul rilevato a tergo delle\nspalle", "Azioni aerodinamiche generate\ndal transito dei convogli", "gr1", "gr2", "gr3", "gr4", "FWk", "in fase di esecuzione", "SLU e SLE", "Tk"];
        t52VI.rows = t52VI.rows.map((row: any[], index: number) => [cell(groups[index]!, index === 0 || index === 2 || index === 7 ? { align: "center" } : { align: "center" }), cell(descriptions[index]!, { latex: index >= 2 && index <= 5 ? `gr_${index - 1}` : index === 6 ? "F_{Wk}" : index === 9 ? "T_k" : undefined, align: "center" }), ...row.slice(1)]);
        t52VI.columnCount = 5;
        t52VI.headers = [[cell("Azioni", { align: "center" }), cell("", { header: false, align: "center" }), cell("Ψ0", { latex: "\\Psi_0", align: "center" }), cell("Ψ1", { latex: "\\Psi_1", align: "center" }), cell("Ψ2", { latex: "\\Psi_2", align: "center" })]];
        t52VI.rows[0][0].rowSpan = 2;
        t52VI.rows[2][0].rowSpan = 4;
        t52VI.rows[7][0].rowSpan = 2;
        for (const index of [1, 3, 4, 5, 8]) t52VI.rows[index].splice(0, 1);
    }
    center(t52VI);
    superscriptNotes(t52VI);
    t52VI.columnWidths = [18, 42, 13, 13, 14];
    inlineMathNotes(t52VI);

    const t52VII = step4.tables.find((item: any) => item.officialNumber === "5.2.VII");
    if (t52VII.columnCount === 4) {
        t52VII.rows = t52VII.rows.map((row: any[]) => [cell("Azioni singole\nda traffico", { align: "center" }), cell(row[0].text, { align: "center" }), ...row.slice(1)]);
        t52VII.columnCount = 5;
        t52VII.headers = [[cell("", { header: false, align: "center" }), cell("Azioni", { align: "center" }), cell("Ψ0", { latex: "\\Psi_0", align: "center" }), cell("Ψ1", { latex: "\\Psi_1", align: "center" }), cell("Ψ2", { latex: "\\Psi_2", align: "center" })]];
        t52VII.rows[0][0].rowSpan = 6;
    }
    if (t52VII.rows[0][0].rowSpan && t52VII.rows[1]?.length === 5) for (let index = 1; index < t52VII.rows.length; index += 1) t52VII.rows[index].splice(0, 1);
    center(t52VII);
    superscriptNotes(t52VII);
    t52VII.columnWidths = [18, 47, 12, 12, 11];
    inlineMathNotes(t52VII);

    const t52VIII = step4.tables.find((item: any) => item.officialNumber === "5.2.VIII");
    t52VIII.headers = [
        [cell("Velocità\n[km/h]", { rowSpan: 2, align: "center" }), cell("Variazione\nangolare massima", { rowSpan: 2, align: "center" }), cell("Raggio minimo di curvatura", { colSpan: 2, align: "center" })],
        [cell("Singola campata", { align: "center" }), cell("Più campate", { align: "center" })],
    ];
    t52VIII.columnWidths = [15, 25, 30, 30];
    center(t52VIII);

    for (const number of ["5.1.3.3", "5.1.3.4", "5.1.3.5", "5.1.3.6", "5.1.3.7", "5.1.3.8", "5.1.3.9", "5.1.3.10", "5.1.3.11"]) {
        const record = await readJson(join(unitRoot, `${number}.json`));
        const inline = qHeadingInline(record.blocks[0].text.normalized);
        if (inline) record.blocks[0].text.inline = inline;
        await writeJson(join(unitRoot, `${number}.json`), record);
    }
    const schemaUnit = await readJson(join(unitRoot, "5.1.3.3.3.json"));
    fixLabeledSchemas(schemaUnit);
    await writeJson(join(unitRoot, "5.1.3.3.3.json"), schemaUnit);
    const centrifugalUnit = await readJson(join(unitRoot, "5.2.2.3.1.json"));
    fixCentrifugalList(centrifugalUnit);
    fixReductionList(centrifugalUnit);
    await writeJson(join(unitRoot, "5.2.2.3.1.json"), centrifugalUnit);
    const aerodynamicUnit = await readJson(join(unitRoot, "5.2.2.6.5.json"));
    if (aerodynamicUnit.title.endsWith(" 20 M")) aerodynamicUnit.title = aerodynamicUnit.title.slice(0, -1) + "m";
    const aerodynamicHeading = aerodynamicUnit.blocks[0];
    if (aerodynamicHeading.text.normalized.endsWith(" 20 M")) {
        aerodynamicHeading.text.normalized = aerodynamicHeading.text.normalized.slice(0, -1) + "m";
        aerodynamicHeading.evidence.normalizedSha256 = sha256(aerodynamicHeading.text.normalized);
        appendFormattingNote(aerodynamicHeading, "Corretta in minuscolo l’unità m (metri) nel titolo, come nella fonte ufficiale.");
    }
    fixAerodynamicList(aerodynamicUnit);
    await writeJson(join(unitRoot, "5.2.2.6.5.json"), aerodynamicUnit);
    const catenaryUnit = await readJson(join(unitRoot, "5.2.2.9.1.json"));
    fixCatenarySpacing(catenaryUnit);
    await writeJson(join(unitRoot, "5.2.2.9.1.json"), catenaryUnit);

    for (const figure of step1.figures) {
        const regions: Record<string, [number, number, number, number]> = {
            "5.1.3.a": [149.114, 455, 185.886, 82.509],
            "5.1.3.b": [335, 455, 125, 80],
        };
        const region = regions[figure.officialNumber];
        if (!region) continue;
        figure.region = { coordinateSystem: "pdf-points-top-left", x: region[0], y: region[1], width: region[2], height: region[3] };
        figure.sha256 = sha256(await readFile(join(figureRoot, figure.imagePath.split("/").at(-1))));
    }
    for (const figure of step2.figures) {
        const regions: Record<string, [number, number, number, number]> = { "5.1.4": [155, 510, 290, 110], "5.2.5": [235, 305, 150, 110], "5.2.6": [235, 480, 150, 145] };
        const region = regions[figure.officialNumber];
        if (!region) continue;
        figure.region = { coordinateSystem: "pdf-points-top-left", x: region[0], y: region[1], width: region[2], height: region[3] };
        figure.sha256 = sha256(await readFile(join(figureRoot, figure.imagePath.split("/").at(-1))));
    }
    await writeJson(join(assetRoot, "5.1-step1.json"), step1);
    await writeJson(join(assetRoot, "5.1-step2.json"), step2);
    await writeJson(join(assetRoot, "5.1-step3.json"), step3);
    await writeJson(join(assetRoot, "5.1-step4.json"), step4);
    for (const table of step2.tables) for (const row of [...table.headers, ...table.rows]) for (const item of row) if (item.image) item.image.sha256 = sha256(await readFile(join(root, "corpus", "assets", item.image.imagePath)));
    await writeJson(join(assetRoot, "5.1-step2.json"), step2);
    console.log("NTC5 editorial fixes: asset e unità aggiornati nel perimetro richiesto.");
}

await main();
