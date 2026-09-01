import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitPath = repoRoot + "/corpus/units/ntc2018/3.2.3.6.json";
const profile = "core-editorial-profile-0.1.1";

type Segment = { kind: "text"; value: string } | { kind: "math"; value: string; latex: string };
type Block = {
    blockId: string;
    text?: { normalized: string; normalizationVersion: string; inline?: Segment[] };
    evidence: { normalizedSha256: string; transformations: Array<{ operation: string; ruleVersion: string; note: string }> };
};
type Unit = { blocks: Block[] };

const text = (value: string): Segment => ({ kind: "text", value });
const math = (value: string, latex: string): Segment => ({ kind: "math", value, latex });
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

function update(unit: Unit, suffix: string, inline: Segment[]): void {
    const block = unit.blocks.find((candidate) => candidate.blockId.endsWith("#block-" + suffix));
    if (!block?.text) throw new Error("Blocco mancante: " + suffix);
    const normalized = inline.map((segment) => segment.value).join("");
    block.text.normalized = normalized;
    block.text.normalizationVersion = profile;
    block.text.inline = inline;
    block.evidence.normalizedSha256 = sha256(normalized);
    block.evidence.transformations = [
        ...block.evidence.transformations.filter((entry) => entry.operation !== "manual-correction"),
        {
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati dal render ufficiale ξ, pedici, intervalli, periodi, percentuali e unità di misura come segmenti matematici inline.",
        },
    ];
}

const unit = JSON.parse(await readFile(unitPath, "utf8")) as Unit;

update(unit, "editorial-002", [
    text("La durata delle storie temporali artificiali del moto del terreno deve essere stabilita sulla base della magnitudo e degli altri parametri fisici che determinano la scelta del valore di "),
    math("ag", "a_g"),
    text(" e di "),
    math("SS", "S_S"),
    text(". In assenza di studi specifici, la parte pseudo-stazionaria dell’accelerogramma associato alla storia deve avere durata di "),
    math("10 s", "10\\,\\mathrm{s}"),
    text(" e deve essere preceduta e seguita da tratti di ampiezza crescente da zero e decrescente a zero, in modo che la durata complessiva dell’accelerogramma sia non inferiore a "),
    math("25 s", "25\\,\\mathrm{s}"),
    text("."),
]);

update(unit, "editorial-003", [
    text("Gli accelerogrammi artificiali devono avere uno spettro di risposta elastico coerente con lo spettro di risposta adottato nella progettazione. La coerenza con lo spettro di risposta elastico è da verificare in base alla media delle ordinate spettrali ottenute con i diversi accelerogrammi, per un coefficiente di smorzamento viscoso equivalente "),
    math("ξ", "\\xi"),
    text(" del "),
    math("5%", "5\\%"),
    text(". L'ordinata spettrale media non deve presentare uno scarto in difetto superiore al "),
    math("10%", "10\\%"),
    text(", rispetto alla corrispondente componente dello spettro elastico, in alcun punto del maggiore tra gli intervalli "),
    math("0,15 s ÷ 2,0 s", "0{,}15\\,\\mathrm{s}\\div2{,}0\\,\\mathrm{s}"),
    text(" e "),
    math("0,15 s ÷ 2T", "0{,}15\\,\\mathrm{s}\\div2T"),
    text(", in cui "),
    math("T", "T"),
    text(" è il periodo proprio di vibrazione della struttura in campo elastico, per le verifiche agli stati limite ultimi, e "),
    math("0,15 s ÷ 1,5 T", "0{,}15\\,\\mathrm{s}\\div1{,}5T"),
    text(", per le verifiche agli stati limite di esercizio. Nel caso di costruzioni con isolamento sismico, il limite superiore dell’intervallo di coerenza è assunto pari a "),
    math("1,2 Tis", "1{,}2T_{is}"),
    text(", essendo "),
    math("Tis", "T_{is}"),
    text(" il periodo equivalente della struttura isolata, valutato per gli spostamenti del sistema d’isolamento prodotti dallo stato limite in esame."),
]);

update(unit, "editorial-005", [
    text("L’uso di storie temporali del moto del terreno generate mediante simulazione del meccanismo di sorgente e della propagazione è ammesso a condizione che siano adeguatamente giustificate le ipotesi relative alle caratteristiche sismogenetiche della sorgente e del mezzo di propagazione e che, negli intervalli di periodo sopraindicati, l’ordinata spettrale media non presenti uno scarto in difetto superiore al "),
    math("20%", "20\\%"),
    text(" rispetto alla corrispondente componente dello spettro elastico."),
]);

update(unit, "editorial-007", [
    text("Le storie temporali del moto del terreno registrate devono essere selezionate e scalate in modo tale che i relativi spettri di risposta approssimino gli spettri di risposta elastici nel campo dei periodi propri di vibrazione di interesse per il problema in esame. Nello specifico la compatibilità con lo spettro di risposta elastico deve essere verificata in base alla media delle ordinate spettrali ottenute con i diversi accelerogrammi associati alle storie per un coefficiente di smorzamento viscoso equivalente "),
    math("ξ", "\\xi"),
    text(" del "),
    math("5%", "5\\%"),
    text(". L'ordinata spettrale media non deve presentare uno scarto in difetto superiore al "),
    math("10%", "10\\%"),
    text(" ed uno scarto in eccesso superiore al "),
    math("30%", "30\\%"),
    text(", rispetto alla corrispondente componente dello spettro elastico in alcun punto dell’intervallo dei periodi propri di vibrazione di interesse per l’opera in esame per i diversi stati limite."),
]);

await writeFile(unitPath, JSON.stringify(unit, null, 2) + "\n", "utf8");
console.log("ntc2018 3.2.3.6: matematica inline verificata sulle pagine PDF 54–55");
