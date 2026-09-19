import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/* eslint-disable @typescript-eslint/no-explicit-any */
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(repoRoot, "corpus", "units", "ntc2018");
const assetPath = join(repoRoot, "corpus", "assets", "ntc2018", "11-step2.json");
type AnyRecord = Record<string, any>;

async function readJson(path: string): Promise<AnyRecord> {
    return JSON.parse(await readFile(path, "utf8")) as AnyRecord;
}

async function writeJson(path: string, value: AnyRecord): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function addTransformation(block: AnyRecord, note: string): void {
    block.evidence ??= {};
    block.evidence.transformations ??= [];
    if (block.evidence.transformations.some((item: AnyRecord) => item.note === note)) return;
    block.evidence.transformations.push({
        operation: "manual-correction",
        ruleVersion: "ntc11-editorial-formatting-0.3.0",
        note,
    });
}

function updateText(block: AnyRecord, raw: string, normalized: string, inline: AnyRecord[]): void {
    block.text.raw = raw;
    block.text.normalized = normalized;
    block.text.inline = inline;
    if (block.evidence) {
        block.evidence.rawSha256 = hash(raw);
        block.evidence.normalizedSha256 = hash(normalized);
    }
}

function math(text: string, latex: string, extra: AnyRecord = {}): AnyRecord {
    return { text, latex, ...extra };
}

function cell(text: string, extra: AnyRecord = {}): AnyRecord {
    return { text, ...extra };
}

function center(table: AnyRecord): void {
    for (const row of [...table.headers, ...table.rows]) {
        for (const currentCell of row) currentCell.align = "center";
    }
}

async function splitQualityControlEntries(): Promise<void> {
    const path = join(unitDir, "11.2.2.json");
    const unit = await readJson(path);
    const recovery = new Map<string, [string, string]>([
        ["003", ["Serve a determinare, prima dell’inizio della costruzione delle opere, la miscela per produrre il calcestruzzo in accordo con le pre-\nscrizioni di progetto.", "Serve a determinare, prima dell’inizio della costruzione delle opere, la miscela per produrre il calcestruzzo in accordo con le prescrizioni di progetto."]],
        ["004", ["Riguarda il controllo da eseguire sul calcestruzzo durante la produzione con processo industrializzato del calcestruzzo stesso.", "Riguarda il controllo da eseguire sul calcestruzzo durante la produzione con processo industrializzato del calcestruzzo stesso."]],
        ["005", ["Riguarda il controllo da eseguire sul calcestruzzo utilizzato per l’esecuzione dell’opera, con prelievo effettuato contestualmente al\ngetto dei relativi elementi strutturali.", "Riguarda il controllo da eseguire sul calcestruzzo utilizzato per l’esecuzione dell’opera, con prelievo effettuato contestualmente al getto dei relativi elementi strutturali."]],
        ["006", ["Sono prove che vengono eseguite, ove necessario, a complemento delle prove di accettazione.", "Sono prove che vengono eseguite, ove necessario, a complemento delle prove di accettazione."]],
    ]);
    for (const suffix of ["003", "004", "005", "006"]) {
        const blockId = `${unit.id}#block-${suffix}`;
        const block = unit.blocks.find((candidate: AnyRecord) => candidate.blockId === blockId);
        if (!block) throw new Error(`Blocco non trovato: ${blockId}`);
        const descriptionId = `${blockId}-description`;
        const existingDescription = unit.blocks.find((candidate: AnyRecord) => candidate.blockId === descriptionId);
        if (existingDescription?.text?.normalized) {
            existingDescription.kind = "paragraph";
            if (existingDescription.text.inline?.[0]?.kind === "text") existingDescription.text.inline[0].value = String(existingDescription.text.inline[0].value).trimStart();
            addTransformation(existingDescription, "Separata la descrizione dal titolo corsivo, mantenendo l’a capo verificato nel render ufficiale.");
            continue;
        }
        const source = JSON.parse(JSON.stringify(block)) as AnyRecord;
        const title = block.text.inline?.[0];
        if (!title || title.kind !== "em") throw new Error(`Titolo corsivo non trovato: ${blockId}`);
        const descriptionInline = (source.text.inline as AnyRecord[]).slice(1).map((segment) => ({ ...segment }));
        if (descriptionInline[0]?.kind === "text") descriptionInline[0].value = String(descriptionInline[0].value).trimStart();
        let descriptionNormalized = descriptionInline.map((segment) => segment.value ?? "").join("").trim();
        const rawLines = String(source.text.raw).split("\n");
        const titleRaw = rawLines.shift()?.trim() ?? title.value;
        let descriptionRaw = rawLines.join("\n").trim();
        if (!descriptionNormalized || !descriptionRaw) {
            const fallback = recovery.get(suffix);
            if (!fallback) throw new Error(`Descrizione non ricostruibile: ${blockId}`);
            [descriptionRaw, descriptionNormalized] = fallback;
            descriptionInline.splice(0, descriptionInline.length, { kind: "text", value: descriptionNormalized });
        }

        block.kind = "heading";
        updateText(block, titleRaw, title.value, [{ ...title }]);
        addTransformation(block, "Separato il titolo corsivo dalla descrizione, mantenendo l’a capo verificato nel render ufficiale.");

        if (existingDescription) {
            existingDescription.kind = "paragraph";
            updateText(existingDescription, descriptionRaw, descriptionNormalized, descriptionInline);
            addTransformation(existingDescription, "Separata la descrizione dal titolo corsivo, mantenendo l’a capo verificato nel render ufficiale.");
            continue;
        }
        const description = source;
        description.blockId = descriptionId;
        description.kind = "paragraph";
        updateText(description, descriptionRaw, descriptionNormalized, descriptionInline);
        addTransformation(description, "Separata la descrizione dal titolo corsivo, mantenendo l’a capo verificato nel render ufficiale.");
        const index = unit.blocks.indexOf(block);
        unit.blocks.splice(index + 1, 0, description);
    }
    await writeJson(path, unit);
}

async function updateTables(): Promise<void> {
    const manifest = await readJson(assetPath);
    const table = (number: string): AnyRecord => {
        const result = manifest.tables.find((candidate: AnyRecord) => candidate.officialNumber === number);
        if (!result) throw new Error(`Tabella non trovata: ${number}`);
        return result;
    };

    const tableIb = table("11.3.Ib");
    tableIb.rows[2] = [
        math("(ft/fy)k", "(f_t/f_y)_k", { colSpan: 2, rowSpan: 2, align: "right" }),
        math("≥ 1,15", "\\ge1{,}15", { align: "center" }),
        math("10.0", "10.0", { rowSpan: 2, align: "center" }),
    ];
    tableIb.rows[3] = [math("< 1,35", "<1{,}35", { align: "center" })];
    tableIb.rows[4] = [
        cell("", { align: "left" }),
        math("(fy/fynom)k", "(f_y/f_{y\\,\\mathrm{nom}})_k", { align: "right" }),
        math("≤ 1,25", "\\le1{,}25", { align: "center" }),
        math("10.0", "10.0", { align: "center" }),
    ];
    tableIb.rows[8] = [
        math("per 16 < Ø ≤ 25 mm", "\\text{per }16<\\varnothing\\le25\\;\\mathrm{mm}", { colSpan: 2, align: "right" }),
        math("8 Ø", "8\\varnothing", { align: "center" }),
        cell("", { align: "center" }),
    ];
    tableIb.rows[9] = [
        math("per 25 < Ø ≤ 40 mm", "\\text{per }25<\\varnothing\\le40\\;\\mathrm{mm}", { colSpan: 2, align: "right" }),
        math("10 Ø", "10\\varnothing", { align: "center" }),
        cell("", { align: "center" }),
    ];

    const tableVIa = table("11.3.VI a");
    tableVIa.rows.at(-1)![1] = math(
        "per 5 mm ≤ Ø ≤ 6 mm ≥ 0.035\\nper 6 mm ≤ Ø ≤ 12 mm ≥ 0.040\\nper Ø ≥ 12 mm ≥ 0.056",
        "\\begin{aligned}\\text{per }5\\;\\mathrm{mm}\\le\\varnothing\\le6\\;\\mathrm{mm}&\\ge0.035\\\\\\text{per }6\\;\\mathrm{mm}\\le\\varnothing\\le12\\;\\mathrm{mm}&\\ge0.040\\\\\\text{per }\\varnothing\\ge12\\;\\mathrm{mm}&\\ge0.056\\end{aligned}",
        { align: "left" },
    );

    center(table("11.3.X"));

    const tableXII = table("11.3.XII");
    tableXII.columnWidths = [25, 17, 18, 18, 22];
    tableXII.rows[0][0] = cell("Materiale Base:\nSpessore minimo delle membrature", { rowSpan: 5, align: "left" });
    tableXII.rows[1][0] = math("S275,\ns ≤ 30 mm", "\\begin{gathered}\\mathrm{S275},\\\\s\\le30\\;\\mathrm{mm}\\end{gathered}", { align: "left" });

    await writeJson(assetPath, manifest);
}

async function nestPrestressingDefinitions(): Promise<void> {
    const path = join(unitDir, "11.3.3.2.json");
    const unit = await readJson(path);
    for (const suffix of ["009", "010", "011", "012"]) {
        const block = unit.blocks.find((candidate: AnyRecord) => candidate.blockId.endsWith(`#block-${suffix}`));
        if (!block) throw new Error(`Blocco non trovato: 11.3.3.2 #block-${suffix}`);
        block.listLevel = 1;
        block.indentLevel = 1;
        addTransformation(block, "Ricostruito l’elenco labeled innestato delle definizioni di xk, x̄, k e s secondo il render ufficiale.");
    }
    await writeJson(path, unit);
}

async function nestIsolatorIntroduction(): Promise<void> {
    const path = join(unitDir, "11.9.1.json");
    const unit = await readJson(path);
    const block = unit.blocks.find((candidate: AnyRecord) => candidate.text?.normalized?.startsWith("In generale, ai fini della presente norma"));
    if (!block) throw new Error("Introduzione dell’elenco degli isolatori non trovata");
    block.kind = "list-item";
    block.listMarker = "none";
    block.listLevel = 1;
    addTransformation(block, "Ricondotta l’introduzione dell’elenco degli isolatori all’elemento innestato sotto DISPOSITIVI DI ISOLAMENTO, come verificato nel render ufficiale.");
    await writeJson(path, unit);
}

await splitQualityControlEntries();
await updateTables();
await nestPrestressingDefinitions();
await nestIsolatorIntroduction();
console.log("fix-ntc11-followup-editorial: 11.2.2, 11.3.Ib, 11.3.3.2, 11.3.X, 11.3.XII e 11.9.1 aggiornati");
