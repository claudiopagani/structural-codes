import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitsRoot = root + "/corpus/units/ntc2018";
const profile = "ntc4-title-spacing-editorial-profile-0.1.0";

type Transformation = { operation: string; ruleVersion: string; note: string };
type Block = {
    blockId: string;
    text?: { normalized: string; normalizationVersion: string; inline?: unknown[] };
    evidence: { normalizedSha256: string; transformations?: Transformation[]; [key: string]: unknown };
};
type Unit = { title: string; blocks: Block[]; [key: string]: unknown };

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const uid = (number: string) => "urn:structural-codes:it:unit:ntc2018:" + number;

const titleCorrections = new Map<string, string>([
    ["4.1.1", "VALUTAZIONE DELLA SICUREZZA E METODI DI ANALISI"],
    ["4.1.5", "PROGETTAZIONE INTEGRATA DA PROVE E VERIFICA MEDIANTE PROVE"],
    ["4.1.6.1", "ELEMENTI MONODIMENSIONALI: TRAVI E PILASTRI"],
    ["4.1.9", "NORME ULTERIORI PER I SOLAI"],
    ["4.1.9.1", "SOLAI MISTI DI C.A. E C.A.P. E BLOCCHI FORATI IN LATERIZIO O IN CALCESTRUZZO"],
    ["4.1.9.2", "SOLAI MISTI DI C.A. E C.A.P. E BLOCCHI DIVERSI DAL LATERIZIO O CALCESTRUZZO"],
    ["4.1.9.3", "SOLAI REALIZZATI CON L’ASSOCIAZIONE DI COMPONENTI PREFABBRICATI IN C.A. E C.A.P."],
    ["4.1.11", "CALCESTRUZZO A BASSA PERCENTUALE DI ARMATURA O NON ARMATO"],
]);

async function readUnit(number: string): Promise<Unit> {
    return JSON.parse(await readFile(unitsRoot + "/" + number + ".json", "utf8")) as Unit;
}

async function writeUnit(number: string, unit: Unit): Promise<void> {
    await writeFile(unitsRoot + "/" + number + ".json", JSON.stringify(unit, null, 2) + "\n", "utf8");
}

for (const [number, title] of titleCorrections) {
    const unit = await readUnit(number);
    const headingId = uid(number) + "#block-heading";
    const heading = unit.blocks.find((block) => block.blockId === headingId);
    if (!heading?.text) throw new Error("Titolo mancante: " + headingId);

    unit.title = title;
    const normalized = `${number} ${title}`;
    heading.text.normalized = normalized;
    heading.text.normalizationVersion = profile;
    delete heading.text.inline;
    heading.evidence.normalizedSha256 = sha256(normalized);
    heading.evidence.transformations = [
        ...(heading.evidence.transformations ?? []).filter((item) => item.ruleVersion !== profile),
        {
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Corretti gli spazi nei titoli del § 4.1 confrontando direttamente il render della fonte ufficiale.",
        },
    ];
    await writeUnit(number, unit);
}

console.log(`ntc4: corrected spacing in ${titleCorrections.size} titles`);
