import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(repoRoot, "corpus", "units", "circ2019");
const profile = "circ41-formula-audit-0.1.0";

// I record canonici contengono forme di blocco eterogenee.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Unit = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = any;
type MathSpec = { value: string; latex: string };

const sha256 = (value: string): string =>
    createHash("sha256").update(value).digest("hex");

async function load(id: string): Promise<Unit> {
    return JSON.parse(await readFile(join(unitDir, `${id}.json`), "utf8"));
}

async function save(id: string, unit: Unit): Promise<void> {
    await writeFile(
        join(unitDir, `${id}.json`),
        `${JSON.stringify(unit, null, 2)}\n`,
        "utf8",
    );
}

function buildInline(
    normalized: string,
    math: MathSpec[],
): Array<{ kind: "text" | "math"; value: string; latex?: string }> {
    const inline: Array<{
        kind: "text" | "math";
        value: string;
        latex?: string;
    }> = [];
    let cursor = 0;
    for (const spec of math) {
        const index = normalized.indexOf(spec.value, cursor);
        if (index < 0) throw new Error(`Segmento non trovato: ${spec.value}`);
        if (index > cursor) {
            inline.push({ kind: "text", value: normalized.slice(cursor, index) });
        }
        inline.push({ kind: "math", value: spec.value, latex: spec.latex });
        cursor = index + spec.value.length;
    }
    if (cursor < normalized.length) {
        inline.push({ kind: "text", value: normalized.slice(cursor) });
    }
    return inline;
}

async function replaceInline(
    id: string,
    suffix: string,
    normalized: string,
    math: MathSpec[],
    note: string,
): Promise<void> {
    const unit = await load(id);
    const block = unit.blocks.find((item: Block) =>
        item.blockId.endsWith(suffix),
    );
    if (!block) throw new Error(`${id} ${suffix} non trovato`);
    const inline = buildInline(normalized, math);
    if (
        block.text.normalized === normalized &&
        JSON.stringify(block.text.inline) === JSON.stringify(inline)
    ) return;
    block.text.normalized = normalized;
    block.text.inline = inline;
    block.text.normalizationVersion = profile;
    block.evidence.transformations ??= [];
    block.evidence.transformations.push({
        operation: "manual-correction",
        ruleVersion: profile,
        note,
    });
    block.evidence.rawSha256 = sha256(block.text.raw);
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
    await save(id, unit);
}

await replaceInline(
    "c4.1",
    "#block-editorial-004",
    "Per le verifiche allo Stato Limite Ultimo (SLU), il coefficiente parziale di sicurezza per il calcestruzzo γc resta fissato a 1,5, in accordo con la UNI EN 1992; il coefficiente αcc resta fissato a 0,85, a differenza di quello proposto dalla UNI EN 1992.",
    [
        { value: "γc", latex: "\\gamma_c" },
        { value: "1,5", latex: "1{,}5" },
        { value: "αcc", latex: "\\alpha_{cc}" },
        { value: "0,85", latex: "0{,}85" },
    ],
    "Ripristinati i simboli gamma_c e alpha_cc corrotti dal layer PDF.",
);

await replaceInline(
    "c4.1.2.2.2",
    "#block-editorial-016",
    "I valori di K per calcestruzzo molto sollecitato (ρ = 1,5%) o poco sollecitato (ρ = 0,5%) sono riportati nella Tabella C4.1.I, insieme ai valori limite di l/h calcolati assumendo fck = 30 MPa e [500 As,eff/(fyk As,calc)] = 1.",
    [
        { value: "ρ = 1,5%", latex: "\\rho=1{,}5\\%" },
        { value: "ρ = 0,5%", latex: "\\rho=0{,}5\\%" },
        { value: "l/h", latex: "\\frac{l}{h}" },
        { value: "fck = 30 MPa", latex: "f_{ck}=30\\,\\mathrm{MPa}" },
        { value: "[500 As,eff/(fyk As,calc)] = 1", latex: "\\left[\\frac{500A_{s,eff}}{f_{yk}A_{s,calc}}\\right]=1" },
    ],
    "Riunite le uguaglianze e le frazioni inline della nota alla Tabella C4.1.I.",
);

await replaceInline(
    "c4.1.2.2.4.5",
    "#block-editorial-009",
    "σs è la tensione nell'armatura tesa, calcolata considerando la sezione fessurata; αe è il rapporto Es/Ecm; ρeff = As/Ac,eff, dove Ac,eff è l'area efficace di calcestruzzo teso attorno all'armatura, di altezza hc,eff = min[2,5(h-d), (h-x)/3, h/2] (vedere Figura C4.1.10); in trazione, le due aree efficaci all'estradosso e all'intradosso sono considerate separatamente; kt è un fattore dipendente dalla durata del carico e vale:",
    [
        { value: "σs", latex: "\\sigma_s" },
        { value: "αe", latex: "\\alpha_e" },
        { value: "Es/Ecm", latex: "E_s/E_{cm}" },
        { value: "ρeff = As/Ac,eff", latex: "\\rho_{eff}=A_s/A_{c,eff}" },
        { value: "Ac,eff", latex: "A_{c,eff}" },
        { value: "hc,eff = min[2,5(h-d), (h-x)/3, h/2]", latex: "h_{c,eff}=\\min\\left[2{,}5(h-d),\\frac{h-x}{3},\\frac{h}{2}\\right]" },
        { value: "kt", latex: "k_t" },
    ],
    "Ricomposte le definizioni matematiche complete della verifica di fessurazione.",
);

await replaceInline(
    "c4.1.2.2.4.5",
    "#block-editorial-010",
    "kt = 0,6 per carichi di breve durata, kt = 0,4 per carichi di lunga durata.",
    [
        { value: "kt = 0,6", latex: "k_t=0{,}6" },
        { value: "kt = 0,4", latex: "k_t=0{,}4" },
    ],
    "Riunite le due uguaglianze del fattore k_t.",
);

await replaceInline(
    "c4.1.2.2.4.5",
    "#block-editorial-017",
    "c è il ricoprimento dell'armatura; k1 = 0,8 per barre ad aderenza migliorata e k1 = 1,6 per barre lisce; k2 = 0,5 nel caso di flessione e k2 = 1,0 nel caso di trazione semplice.",
    [
        { value: "c", latex: "c" },
        { value: "k1 = 0,8", latex: "k_1=0{,}8" },
        { value: "k1 = 1,6", latex: "k_1=1{,}6" },
        { value: "k2 = 0,5", latex: "k_2=0{,}5" },
        { value: "k2 = 1,0", latex: "k_2=1{,}0" },
    ],
    "Riunite le quattro uguaglianze dei coefficienti k_1 e k_2.",
);

await replaceInline(
    "c4.1.2.2.4.5",
    "#block-editorial-021",
    "k3 = 3,4; k4 = 0,425.",
    [
        { value: "k3 = 3,4", latex: "k_3=3{,}4" },
        { value: "k4 = 0,425", latex: "k_4=0{,}425" },
    ],
    "Riunite le uguaglianze dei coefficienti k_3 e k_4.",
);

await replaceInline(
    "c4.1.2.2.5",
    "#block-editorial-004",
    "Nei casi in cui si ritenga possibile effettuare un’unica verifica indipendente dal tempo, si può assumere un coefficiente di omogeneizzazione n fra i moduli di elasticità di acciaio e calcestruzzo, pari a n = 15.",
    [
        { value: "n", latex: "n" },
        { value: "n = 15", latex: "n=15" },
    ],
    "Riunita l'uguaglianza del coefficiente di omogeneizzazione.",
);

await replaceInline(
    "c4.1.2.3.6",
    "#block-editorial-001",
    "Nella formula [4.1.35] si intende con f’cd la resistenza di progetto a compressione ridotta del calcestruzzo d’anima, valutata come ν·fcd, assumendo ν = 0,5.",
    [
        { value: "f’cd", latex: "f'_{cd}" },
        { value: "ν·fcd", latex: "\\nu\\cdot f_{cd}" },
        { value: "ν = 0,5", latex: "\\nu=0{,}5" },
    ],
    "Ricomposti il prodotto e l'uguaglianza della resistenza ridotta a torsione.",
);

await replaceInline(
    "c4.1.9.1.1",
    "#block-editorial-003",
    "le pareti esterne, sia orizzontali che verticali, devono avere uno spessore minimo di 8 mm. Le pareti interne, sia orizzontali che verticali, devono avere uno spessore minimo di 7 mm. Tutte le intersezioni dovranno essere raccordate con raggio di curvatura, al netto delle tolleranze, maggiore di 3 mm. Il rapporto tra l’area complessiva dei fori e l’area lorda delimitata dal perimetro della sezione dei blocchi non deve risultare maggiore di 0,6 + 0,625·h (dove h è l’altezza del blocco in metri, h ≤ 0,32 m).",
    [
        { value: "0,6 + 0,625·h", latex: "0{,}6+0{,}625\\cdot h" },
        { value: "h", latex: "h" },
        { value: "h ≤ 0,32 m", latex: "h\\le0{,}32\\,\\mathrm{m}" },
    ],
    "Ripristinati il prodotto e la disuguaglianza completa dei limiti geometrici dei blocchi.",
);

await replaceInline(
    "c4.1.9.1.3",
    "#block-editorial-006",
    "Il valore della dilatazione per umidità, misurata secondo quanto stabilito dalla UNI 9730-3, deve essere < 0,4 mm/m.",
    [
        { value: "< 0,4 mm/m", latex: "<0{,}4\\,\\mathrm{mm/m}" },
    ],
    "Riunita la disuguaglianza con valore e unità di misura.",
);

await replaceInline(
    "c4.1.12.1.3.2.1",
    "#block-editorial-007",
    "d è l’altezza utile della sezione, in mm; ρl = Asl/(bw d) è il rapporto geometrico di armatura longitudinale (≤ 0,02); σcp = NEd/Ac è la tensione media di compressione nella sezione (≤ 0,2 fcd); bw è la larghezza minima della sezione, in mm.",
    [
        { value: "d", latex: "d" },
        { value: "ρl = Asl/(bw d)", latex: "\\rho_l=\\frac{A_{sl}}{b_wd}" },
        { value: "≤ 0,02", latex: "\\le0{,}02" },
        { value: "σcp = NEd/Ac", latex: "\\sigma_{cp}=\\frac{N_{Ed}}{A_c}" },
        { value: "≤ 0,2 fcd", latex: "\\le0{,}2f_{cd}" },
        { value: "bw", latex: "b_w" },
    ],
    "Riunite le due limitazioni parentetiche con i rispettivi valori e simboli.",
);

console.log("circ41-formula-audit: corrette le formule inline delle pagine 84-99");
