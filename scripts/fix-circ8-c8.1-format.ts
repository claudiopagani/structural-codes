import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const path = join(root, "corpus", "units", "circ2019", "c8.1.json");
const profile = "circ8-c8.1-style-profile-0.1.0";
const unit = JSON.parse(await readFile(path, "utf8")) as { blocks: Array<{ blockId: string; text?: { normalized: string; normalizationVersion?: string; inline?: Array<{ kind: string; value: string }> }; evidence?: { transformations?: Array<{ operation: string; ruleVersion: string; note: string }> } }> };

const paragraphOne = unit.blocks.find((block) => block.blockId.endsWith("#block-editorial-001"));
if (!paragraphOne?.text || !paragraphOne.evidence) throw new Error("C8.1: primo capoverso non trovato");
paragraphOne.text.inline = [
    { kind: "text", value: "Le " },
    { kind: "em", value: "costruzioni esistenti" },
    { kind: "text", value: " sono definite, nel § 8.1 delle NTC, come quelle costruzioni per le quali “" },
    { kind: "em", value: "alla data della redazione della valutazione di sicurezza e/o del progetto d’intervento" },
    { kind: "text", value: "” la struttura sia stata “" },
    { kind: "em", value: "completamente realizzata" },
    { kind: "text", value: "”." },
];
paragraphOne.text.normalizationVersion = profile;

const paragraphThree = unit.blocks.find((block) => block.blockId.endsWith("#block-editorial-003"));
if (!paragraphThree?.text || !paragraphThree.evidence) throw new Error("C8.1: terzo capoverso non trovato");
paragraphThree.text.inline = [
    { kind: "text", value: "In termini del tutto generali, con l’espressione " },
    { kind: "em", value: "struttura completamente realizzata" },
    { kind: "text", value: " può intendersi una struttura per la quale, alla data della redazione della valutazione di sicurezza e/o del progetto di intervento, sia stato redatto il certificato di collaudo statico ai sensi delle Norme Tecniche vigenti all’epoca della costruzione; se all’epoca della costruzione l’obbligo del collaudo statico non sussisteva, devono essere state almeno interamente realizzate le strutture e i muri portanti e le strutture degli orizzontamenti e delle coperture." },
];
paragraphThree.text.normalizationVersion = profile;

for (const block of [paragraphOne, paragraphThree]) {
    const evidence = block.evidence;
    if (!evidence) throw new Error("C8.1: evidence mancante");
    evidence.transformations = (evidence.transformations ?? []).filter((item) => item.operation !== "inline-emphasis");
    if (!evidence.transformations.some((item) => item.operation === "manual-correction" && item.note.includes("corsivi verificati"))) {
        evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note: "Segmentati i corsivi verificati sul render ufficiale, senza modificare il testo normalizzato." });
    }
}

await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
console.log("fix-circ8-c8.1-format: intro C8 e corsivi di C8.1 aggiornati");
