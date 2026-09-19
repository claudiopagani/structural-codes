import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/* eslint-disable @typescript-eslint/no-explicit-any */
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(repoRoot, "corpus", "units", "circ2019");
const assetPath = join(repoRoot, "corpus", "assets", "circ2019", "C11-step2.json");

type AnyRecord = Record<string, any>;

async function readJson(path: string): Promise<AnyRecord> {
    return JSON.parse(await readFile(path, "utf8")) as AnyRecord;
}

async function writeJson(path: string, value: AnyRecord): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function unit(number: string): Promise<AnyRecord> {
    return readJson(join(unitDir, `${number.toLowerCase()}.json`));
}

function table(manifest: AnyRecord, officialNumber: string): AnyRecord {
    const result = manifest.tables.find((candidate: AnyRecord) => candidate.officialNumber === officialNumber);
    if (!result) throw new Error(`Tabella non trovata: ${officialNumber}`);
    return result;
}

function forEachCell(asset: AnyRecord, callback: (cell: AnyRecord, column: number) => void): void {
    for (const row of [...asset.headers, ...asset.rows, ...(asset.footerRows ?? [])]) {
        row.forEach((cell: AnyRecord, index: number) => callback(cell, index));
    }
}

function center(asset: AnyRecord): void {
    forEachCell(asset, (cell) => { cell.align = "center"; });
}

function addTransformation(block: AnyRecord, note: string): void {
    block.evidence ??= {};
    block.evidence.transformations ??= [];
    block.evidence.transformations = block.evidence.transformations.filter((transformation: AnyRecord, index: number, all: AnyRecord[]) => all.findIndex((candidate) => candidate.note === transformation.note) === index);
    if (block.evidence.transformations.some((transformation: AnyRecord) => transformation.note === note)) return;
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: "circ11-editorial-formatting-0.2.0", note });
}

const manifest = await readJson(assetPath);
center(table(manifest, "C11.2.6.I"));
const c1134112 = table(manifest, "C11.3.4.11.2.I");
c1134112.columnWidths = [31, 15, 24, 15, 15];
forEachCell(c1134112, (cell, index) => { if (index > 0) cell.align = "center"; });
c1134112.rows[0][0].text = "Nastri e lamiere di acciaio per impieghi strutturali,\nzincati per immersione a caldo in continuo.\nCondizioni tecniche di fornitura.";
c1134112.rows[4][0].text = "Prodotti piani laminati a caldo di acciai ad alto limite\ndi snervamento per formatura a freddo.\nCondizioni di fornitura degli acciai ottenuti mediante\nlaminazione termomeccanica.";
c1134112.rows[8][0].text = "Prodotti piani laminati a caldo di acciai ad alto limite\ndi snervamento per formatura a freddo.\nCondizioni di fornitura degli acciai normalizzati o\nlaminati normalizzati.";
for (const figure of manifest.figures.filter((candidate: AnyRecord) => candidate.id.includes("c11.3.2.10.4"))) {
    figure.caption = null;
    delete figure.captionInline;
}
const figureBAsset = manifest.figures.find((candidate: AnyRecord) => candidate.id.includes("c11.3.2.10.4.b"));
if (figureBAsset) {
    figureBAsset.region = { coordinateSystem: "pdf-points-top-left", x: 221, y: 410, width: 189, height: 60 };
    figureBAsset.imagePath = "figures/circ2019/c11.3.2.10.4-b.png";
    figureBAsset.sha256 = "c3958234c4546a2ba2a7794dd0b40a922b463bb5fb0a519043bd764f06e12bfa";
}
await writeJson(assetPath, manifest);

const c111 = await unit("C11.1");
const reference = c111.blocks.find((block: AnyRecord) => block.blockId.endsWith("#block-029"));
const footnote = c111.blocks.find((block: AnyRecord) => block.kind === "footnote" && block.text?.normalized?.startsWith("1 http"));
if (!reference || !footnote) throw new Error("Richiamo o nota C11.1 non trovati");
reference.text.inline = [
    { kind: "text", value: "Mediante lo strumento informatico messo a disposizione dalla Commissione Europea (" },
    { kind: "em", value: "NANDO - New Approach Notified and Designated Organisations" },
    { kind: "math", value: "1", latex: "^{1}" },
    { kind: "text", value: "), è possibile verificare:" },
];
footnote.text.inline = [
    { kind: "math", value: "1", latex: "^{1}" },
    { kind: "text", value: " http://ec.europa.eu/growth/tools-databases/nando/index.cfm?fuseaction=directive.notifiedbody&dir_id=33" },
];
addTransformation(reference, "Reso apice il richiamo alla nota (1), mantenendo invariato il testo normalizzato.");
addTransformation(footnote, "Reso apice il numero della nota (1), mantenendo invariato il testo normalizzato.");
await writeJson(join(unitDir, "c11.1.json"), c111);

const c11315 = await unit("C11.3.1.5");
for (const block of c11315.blocks) {
    const normalized = block.text?.normalized ?? "";
    if (block.kind === "list-item" && (normalized.startsWith("copia ") || normalized.startsWith("certificato ") || normalized.startsWith("documento "))) block.listLevel = 1;
}
await writeJson(join(unitDir, "c11.3.1.5.json"), c11315);

const c1132104 = await unit("C11.3.2.10.4");
const figureA = c1132104.blocks.find((block: AnyRecord) => block.assetId?.includes("c11.3.2.10.4.a"));
const figureB = c1132104.blocks.find((block: AnyRecord) => block.assetId?.includes("c11.3.2.10.4.b"));
const firstBullet = c1132104.blocks.find((block: AnyRecord) => block.text?.normalized?.startsWith("le barre di acciaio nervato"));
const secondBullet = c1132104.blocks.find((block: AnyRecord) => block.text?.normalized?.startsWith("nelle barre di acciaio dentellate"));
if (!figureA || !figureB || !firstBullet || !secondBullet) throw new Error("Figure o voci elenco C11.3.2.10.4 non trovate");
c1132104.blocks.find((block: AnyRecord) => block === figureB).evidence.region = { coordinateSystem: "pdf-points-top-left", x: 221, y: 410, width: 189, height: 60 };
c1132104.blocks.find((block: AnyRecord) => block === figureB).evidence.rawSha256 = "c3958234c4546a2ba2a7794dd0b40a922b463bb5fb0a519043bd764f06e12bfa";
c1132104.blocks.find((block: AnyRecord) => block === figureB).evidence.normalizedSha256 = "c3958234c4546a2ba2a7794dd0b40a922b463bb5fb0a519043bd764f06e12bfa";
c1132104.blocks = c1132104.blocks.filter((block: AnyRecord) => block !== figureA && block !== figureB && block !== secondBullet);
const firstIndex = c1132104.blocks.indexOf(firstBullet);
c1132104.blocks.splice(firstIndex + 1, 0, figureA, secondBullet, figureB);
addTransformation(c1132104.blocks.find((block: AnyRecord) => block.kind === "heading"), "Rimosse le didascalie non presenti nella fonte e riordinata la seconda figura sotto la relativa voce di elenco.");
await writeJson(join(unitDir, "c11.3.2.10.4.json"), c1132104);

console.log("fix-circ11-editorial: tabelle, note, elenchi e figure C11 aggiornati");
