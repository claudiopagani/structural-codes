import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(repoRoot, "corpus", "units", "circ2019");
const profile = "circ3-final-editorial-profile-0.1.0";

// Canonical unit records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Unit = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = any;

function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

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

function refreshHashes(block: Block): void {
    if (!block.text || !block.evidence) return;
    block.evidence.rawSha256 = sha256(block.text.raw);
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
}

function addCorrection(block: Block, note: string): void {
    block.text.normalizationVersion = profile;
    block.evidence.transformations ??= [];
    block.evidence.transformations.push({
        operation: "manual-correction",
        ruleVersion: profile,
        note,
    });
    refreshHashes(block);
}

function cloneTextBlock(
    source: Block,
    blockId: string,
    kind: "paragraph" | "list-item",
    raw: string,
    normalized: string,
    inline?: Array<{ kind: "text" | "math"; value: string; latex?: string }>,
): Block {
    const block = structuredClone(source);
    block.blockId = blockId;
    block.kind = kind;
    block.text.raw = raw;
    block.text.normalized = normalized;
    block.text.normalizationVersion = profile;
    if (inline) block.text.inline = inline;
    else delete block.text.inline;
    block.evidence.transformations = [
        {
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Ricomposti esclusivamente i ritorni a capo tipografici del PDF.",
        },
        {
            operation: "normalize-whitespace",
            ruleVersion: profile,
            note: "Uniformati gli spazi dopo la ricomposizione.",
        },
        {
            operation: "unicode-nfc",
            ruleVersion: profile,
            note: "Testo normalizzato in Unicode NFC.",
        },
    ];
    refreshHashes(block);
    return block;
}

if (!process.argv.includes("--step1-inline-only")) {
{
    const unit = await load("c3.2.1");
    const replacements = new Map([
        ["Tabella C3.2.I", "Tabella C.3.2.I"],
        ["Tabella C3.2.II", "Tabella C.3.2.II"],
        ["formula C3.2.1", "formula C.3.2.1"],
        ["formula C3.2.2", "formula C.3.2.2"],
    ]);
    for (const block of unit.blocks) {
        if (!block.text) continue;
        let changed = false;
        for (const [from, to] of replacements) {
            if (block.text.normalized.includes(from)) {
                block.text.normalized = block.text.normalized.replaceAll(from, to);
                changed = true;
            }
            for (const segment of block.text.inline ?? []) {
                if (segment.kind === "text" && segment.value.includes(from)) {
                    segment.value = segment.value.replaceAll(from, to);
                    changed = true;
                }
            }
        }
        if (changed) {
            addCorrection(
                block,
                "Ripristinata la punteggiatura della numerazione ufficiale C.3.2 nel testo della fonte.",
            );
        }
    }
    await save("c3.2.1", unit);
}

{
    const unit = await load("c3.4.5");
    const source = unit.blocks[2];
    const splitRaw = source.text.raw.split("\nPer edifici");
    if (splitRaw.length !== 2) throw new Error("c3.4.5 raw split non trovato");
    const firstRaw = splitRaw[0];
    const secondRaw = `Per edifici${splitRaw[1]}`;
    const first =
        "Laddove adeguatamente motivato può applicarsi solamente per coperture ricadenti in località nelle quali il carico della neve al suolo è superiore a 1,5 kN/m2, e caratterizzate da trasmittanza superiore a 1 W/m2K°.";
    const second =
        "Per edifici nei quali la temperatura interna è mantenuta intenzionalmente sotto 0°C (edifici frigoriferi, impianti per il pattinaggio su ghiaccio ecc.) si raccomanda di assumere il valore del coefficiente termico pari a 1,2, indipendentemente dal valore del carico neve al suolo.";
    unit.blocks.splice(
        2,
        1,
        cloneTextBlock(
            source,
            `${unit.id}#block-editorial-002`,
            "paragraph",
            firstRaw,
            first,
            [
                {
                    kind: "text",
                    value: "Laddove adeguatamente motivato può applicarsi solamente per coperture ricadenti in località nelle quali il carico della neve al suolo è superiore a ",
                },
                {
                    kind: "math",
                    value: "1,5 kN/m2",
                    latex: "1{,}5\\,\\mathrm{kN/m^2}",
                },
                {
                    kind: "text",
                    value: ", e caratterizzate da trasmittanza superiore a ",
                },
                {
                    kind: "math",
                    value: "1 W/m2K°",
                    latex: "1\\,\\mathrm{W/(m^2 K^\\circ)}",
                },
                { kind: "text", value: "." },
            ],
        ),
        cloneTextBlock(
            source,
            `${unit.id}#block-editorial-003`,
            "paragraph",
            secondRaw,
            second,
            [
                {
                    kind: "text",
                    value: "Per edifici nei quali la temperatura interna è mantenuta intenzionalmente sotto ",
                },
                {
                    kind: "math",
                    value: "0°C",
                    latex: "0\\,{}^\\circ\\mathrm{C}",
                },
                {
                    kind: "text",
                    value: " (edifici frigoriferi, impianti per il pattinaggio su ghiaccio ecc.) si raccomanda di assumere il valore del coefficiente termico pari a ",
                },
                { kind: "math", value: "1,2", latex: "1{,}2" },
                {
                    kind: "text",
                    value: ", indipendentemente dal valore del carico neve al suolo.",
                },
            ],
        ),
    );
    await save("c3.4.5", unit);
}

{
    const unit = await load("c3.6");
    for (const [firstIndex, secondIndex] of [
        [7, 8],
        [4, 5],
    ] as const) {
        const first = unit.blocks[firstIndex];
        const second = unit.blocks[secondIndex];
        first.text.raw = `${first.text.raw}\n${second.text.raw}`;
        first.text.normalized = `${first.text.normalized} ${second.text.normalized}.`
            .replace("2015..", "2015.")
            .replace("2015 .", "2015.");
        addCorrection(
            first,
            "Unito il capoverso falsamente spezzato dall’andata a capo tipografica dopo «D.M.».",
        );
        unit.blocks.splice(secondIndex, 1);
    }
    await save("c3.6", unit);
}

for (const spec of [
    {
        id: "c3.6.1.1",
        marker: ":- la capacità",
        intro: "Si chiariscono di seguito le seguenti definizioni:",
        item:
            "la capacità di compartimentazione è riferibile ai requisiti REI nonché ad ulteriori requisiti aggiuntivi attribuibili agli elementi delimitanti un compartimento antincendio ai fini della mitigazione del rischio di incendio. Utili indicazioni in merito sono riportate nel D.M. 16 febbraio 2007, nel D.M. 3 agosto 2015 e nella UNI EN 13501-2;",
    },
    {
        id: "c3.6.1.2",
        marker: "decreti:- D.M. 9 marzo",
        intro:
            "Con riferimento al § 3.6.1.2 delle NTC, le disposizioni del Ministero dell’interno richiamate al punto precedente, sono contenute nei seguenti decreti:",
        item:
            "D.M. 9 marzo 2007: Prestazioni di resistenza al fuoco delle costruzioni nelle attività soggette al controllo del corpo nazionale dei Vigili del Fuoco;",
    },
    {
        id: "c3.6.1.5.1",
        marker: "condizioni:- curva nominale",
        intro:
            "Secondo l’incendio convenzionale di progetto adottato, si precisa che l’andamento delle temperature è valutato con riferimento a una delle due seguenti condizioni:",
        item:
            "curva nominale d’incendio, da individuare tra quelle indicate successivamente, per l’intervallo di tempo di esposizione pari alla classe di resistenza al fuoco prevista, senza alcuna fase di raffreddamento;",
    },
]) {
    const unit = await load(spec.id);
    const source = unit.blocks[1];
    const markerIndex = source.text.raw.indexOf(spec.marker);
    if (markerIndex < 0) throw new Error(`${spec.id} raw marker non trovato`);
    const separator = spec.marker.indexOf(":-") + 2;
    const rawIntro = source.text.raw.slice(0, markerIndex + separator);
    const rawItem = source.text.raw
        .slice(markerIndex + separator)
        .replace(/^\s*-\s*/u, "");
    unit.blocks.splice(
        1,
        1,
        cloneTextBlock(
            source,
            `${unit.id}#block-editorial-001`,
            "paragraph",
            rawIntro,
            spec.intro,
        ),
        cloneTextBlock(
            source,
            `${unit.id}#block-editorial-001a`,
            "list-item",
            rawItem,
            spec.item,
        ),
    );
    await save(spec.id, unit);
}

}

async function replaceInlineFormula(
    id: string,
    blockSuffix: string,
    normalized: string,
    inline: Array<{ kind: "text" | "math"; value: string; latex?: string }>,
    note: string,
): Promise<void> {
    const unit = await load(id);
    const block = unit.blocks.find((candidate: Block) =>
        candidate.blockId.endsWith(blockSuffix),
    );
    if (!block) throw new Error(`${id} ${blockSuffix} non trovato`);
    if (
        block.text.normalized === normalized &&
        JSON.stringify(block.text.inline) === JSON.stringify(inline)
    ) return;
    block.text.normalized = normalized;
    block.text.inline = inline;
    addCorrection(block, note);
    await save(id, unit);
}

await replaceInlineFormula(
    "c3.2",
    "#block-editorial-009",
    "ag = accelerazione massima al sito; Fo = valore massimo del fattore di amplificazione dello spettro in accelerazione orizzontale; TC* = periodo di inizio del tratto a velocità costante dello spettro in accelerazione orizzontale.",
    [
        { kind: "math", value: "ag =", latex: "a_g =" },
        { kind: "text", value: " accelerazione massima al sito; " },
        { kind: "math", value: "Fo =", latex: "F_0 =" },
        { kind: "text", value: " valore massimo del fattore di amplificazione dello spettro in accelerazione orizzontale; " },
        { kind: "math", value: "TC* =", latex: "T_C^* =" },
        { kind: "text", value: " periodo di inizio del tratto a velocità costante dello spettro in accelerazione orizzontale." },
    ],
    "Riuniti simbolo e segno di uguaglianza nelle tre definizioni matematiche della fonte.",
);

await replaceInlineFormula(
    "c3.2.1",
    "#block-editorial-011",
    "È immediato constatare (v. formula C.3.2.1) che, imponendo PVR = costante al variare di CU, si ottiene [TR = -CU·VN/ln(1-PVR) = -CU·VN/costante] e dunque, a parità di VN, TR varia dello stesso fattore CU per cui viene moltiplicata VN per avere VR.",
    [
        { kind: "text", value: "È immediato constatare (v. formula C.3.2.1) che, imponendo " },
        { kind: "math", value: "PVR = costante", latex: "P_{VR}=\\text{costante}" },
        { kind: "text", value: " al variare di " },
        { kind: "math", value: "CU", latex: "C_U" },
        { kind: "text", value: ", si ottiene " },
        { kind: "math", value: "[TR = -CU·VN/ln(1-PVR) = -CU·VN/costante]", latex: "\\left[T_R=-\\frac{C_U\\cdot V_N}{\\ln(1-P_{VR})}=-\\frac{C_U\\cdot V_N}{\\text{costante}}\\right]" },
        { kind: "text", value: " e dunque, a parità di " },
        { kind: "math", value: "VN", latex: "V_N" },
        { kind: "text", value: ", " },
        { kind: "math", value: "TR", latex: "T_R" },
        { kind: "text", value: " varia dello stesso fattore " },
        { kind: "math", value: "CU", latex: "C_U" },
        { kind: "text", value: " per cui viene moltiplicata " },
        { kind: "math", value: "VN", latex: "V_N" },
        { kind: "text", value: " per avere " },
        { kind: "math", value: "VR", latex: "V_R" },
        { kind: "text", value: "." },
    ],
    "Ripristinata integralmente la formula inline tra parentesi quadre e riunite le uguaglianze ai rispettivi membri.",
);

await replaceInlineFormula(
    "c3.2.1",
    "#block-editorial-012",
    "Fissata la vita nominale VN della costruzione e valutato il periodo di ritorno TR,1 corrispondente a CU = 1, si ricava il TR corrispondente al generico CU dal prodotto CU·TR,1. Al variare di CU, TR e VR variano con legge uguale.",
    [
        { kind: "text", value: "Fissata la vita nominale " },
        { kind: "math", value: "VN", latex: "V_N" },
        { kind: "text", value: " della costruzione e valutato il periodo di ritorno " },
        { kind: "math", value: "TR,1", latex: "T_{R,1}" },
        { kind: "text", value: " corrispondente a " },
        { kind: "math", value: "CU = 1", latex: "C_U=1" },
        { kind: "text", value: ", si ricava il " },
        { kind: "math", value: "TR", latex: "T_R" },
        { kind: "text", value: " corrispondente al generico " },
        { kind: "math", value: "CU", latex: "C_U" },
        { kind: "text", value: " dal prodotto " },
        { kind: "math", value: "CU·TR,1", latex: "C_U\\cdot T_{R,1}" },
        { kind: "text", value: ". Al variare di " },
        { kind: "math", value: "CU", latex: "C_U" },
        { kind: "text", value: ", " },
        { kind: "math", value: "TR", latex: "T_R" },
        { kind: "text", value: " e " },
        { kind: "math", value: "VR", latex: "V_R" },
        { kind: "text", value: " variano con legge uguale." },
    ],
    "Riunita l'uguaglianza C_U=1 in un'unica espressione matematica inline.",
);

await replaceInlineFormula(
    "c3.2.1",
    "#block-editorial-017",
    "In tal caso si ha TR = -VN/ln(1-PVR/CU); detto TR,a il periodo di ritorno ottenuto con la strategia progettuale di norma e TR,b il periodo di ritorno ottenuto con la strategia progettuale appena illustrata, il rapporto R tra i due periodi di ritorno varrebbe:",
    [
        { kind: "text", value: "In tal caso si ha " },
        { kind: "math", value: "TR = -VN/ln(1-PVR/CU)", latex: "T_R=-\\frac{V_N}{\\ln(1-P_{VR}/C_U)}" },
        { kind: "text", value: "; detto " },
        { kind: "math", value: "TR,a", latex: "T_{R,a}" },
        { kind: "text", value: " il periodo di ritorno ottenuto con la strategia progettuale di norma e " },
        { kind: "math", value: "TR,b", latex: "T_{R,b}" },
        { kind: "text", value: " il periodo di ritorno ottenuto con la strategia progettuale appena illustrata, il rapporto R tra i due periodi di ritorno varrebbe:" },
    ],
    "Ricomposta in un solo segmento la formula inline del periodo di ritorno.",
);

await replaceInlineFormula(
    "c3.2.1",
    "#block-editorial-022",
    "Per trovare come modificare, al variare di CU, i valori di PVR nel periodo di riferimento VR per ottenere gli stessi valori di TR suggeriti dalla strategia ipotizzata, basta imporre R = 1 nella formula C.3.2.2 ed indicare con P*VR i nuovi valori di PVR, così ottenendo:",
    [
        { kind: "text", value: "Per trovare come modificare, al variare di " },
        { kind: "math", value: "CU", latex: "C_U" },
        { kind: "text", value: ", i valori di " },
        { kind: "math", value: "PVR", latex: "P_{VR}" },
        { kind: "text", value: " nel periodo di riferimento " },
        { kind: "math", value: "VR", latex: "V_R" },
        { kind: "text", value: " per ottenere gli stessi valori di " },
        { kind: "math", value: "TR", latex: "T_R" },
        { kind: "text", value: " suggeriti dalla strategia ipotizzata, basta imporre " },
        { kind: "math", value: "R = 1", latex: "R=1" },
        { kind: "text", value: " nella formula C.3.2.2 ed indicare con " },
        { kind: "math", value: "P*VR", latex: "P^*_{VR}" },
        { kind: "text", value: " i nuovi valori di " },
        { kind: "math", value: "PVR", latex: "P_{VR}" },
        { kind: "text", value: ", così ottenendo:" },
    ],
    "Riunita l'uguaglianza R=1 in un'unica espressione matematica inline.",
);

await replaceInlineFormula(
    "c3.2.3.6",
    "#block-editorial-009",
    "Ai fini dell’impiego di accelerogrammi nelle analisi, una descrizione delle azioni sismiche coerente con l’evento di origine può essere ottenuta proiettando ciascuna coppia di registrazioni lungo le direzioni principali del sisma, definite come le direzioni per le quali si annulla la correlazione tra le componenti. Il coefficiente di correlazione tra due componenti accelerometriche X e Y nell’intervallo di tempo t1 < t < t2 può essere così determinato:",
    [
        { kind: "text", value: "Ai fini dell’impiego di accelerogrammi nelle analisi, una descrizione delle azioni sismiche coerente con l’evento di origine può essere ottenuta proiettando ciascuna coppia di registrazioni lungo le direzioni principali del sisma, definite come le direzioni per le quali si annulla la correlazione tra le componenti. Il coefficiente di correlazione tra due componenti accelerometriche " },
        { kind: "math", value: "X", latex: "X" },
        { kind: "text", value: " e " },
        { kind: "math", value: "Y", latex: "Y" },
        { kind: "text", value: " nell’intervallo di tempo " },
        { kind: "math", value: "t1 < t < t2", latex: "t_1<t<t_2" },
        { kind: "text", value: " può essere così determinato:" },
    ],
    "Ricomposto l'intervallo temporale e marcate le due componenti come grandezze matematiche complete.",
);

await replaceInlineFormula(
    "c3.3.4",
    "#block-editorial-001",
    "Le espressioni 3.3.2 delle NTC 2008 e [3.3.4] delle NTC 2018, sono sostanzialmente equivalenti; il coefficiente cp viene definito coefficiente di pressione invece che coefficiente di forma (come nelle NTC 2008) ma il suo ruolo e valore, come indicato al § 3.3.8, restano immutati.",
    [
        { kind: "text", value: "Le espressioni 3.3.2 delle NTC 2008 e [3.3.4] delle NTC 2018, sono sostanzialmente equivalenti; il coefficiente " },
        { kind: "math", value: "cp", latex: "c_p" },
        { kind: "text", value: " viene definito coefficiente di pressione invece che coefficiente di forma (come nelle NTC 2008) ma il suo ruolo e valore, come indicato al § 3.3.8, restano immutati." },
    ],
    "Riunito il simbolo c_p, frammentato dal layer PDF in due lettere matematiche indipendenti.",
);

await replaceInlineFormula(
    "c3.3.8.6",
    "#block-editorial-001",
    "Salvo più approfondite determinazioni, possono essere assunti per i coefficienti cp i valori seguenti.",
    [
        { kind: "text", value: "Salvo più approfondite determinazioni, possono essere assunti per i coefficienti " },
        { kind: "math", value: "cp", latex: "c_p" },
        { kind: "text", value: " i valori seguenti." },
    ],
    "Riunito il simbolo c_p, frammentato dal layer PDF in due lettere matematiche indipendenti.",
);

await replaceInlineFormula(
    "c3.4.2",
    "#block-editorial-008",
    "Pn è la probabilità annuale di superamento (approssimativamente equivalente a 1/n, dove n è il corrispondente periodo di ritorno espresso in anni;",
    [
        { kind: "math", value: "Pn", latex: "P_n" },
        { kind: "text", value: " è la probabilità annuale di superamento (approssimativamente equivalente a " },
        { kind: "math", value: "1/n", latex: "\\frac{1}{n}" },
        { kind: "text", value: ", dove " },
        { kind: "math", value: "n", latex: "n" },
        { kind: "text", value: " è il corrispondente periodo di ritorno espresso in anni;" },
    ],
    "Resa come frazione l'espressione inline 1/n mostrata nella fonte.",
);

await replaceInlineFormula(
    "c3.4.3.3.5",
    "#block-editorial-008",
    "k è un coefficiente funzione della irregolarità della forma della neve, pari a k = 3/d, con k ≤ dγ, essendo d la profondità del manto nevoso sulla copertura in m (vedasi la Figura C.3.4.7).",
    [
        { kind: "math", value: "k", latex: "k" },
        { kind: "text", value: " è un coefficiente funzione della irregolarità della forma della neve, pari a " },
        { kind: "math", value: "k = 3/d", latex: "k=\\frac{3}{d}" },
        { kind: "text", value: ", con " },
        { kind: "math", value: "k ≤ dγ", latex: "k\\le d\\gamma" },
        { kind: "text", value: ", essendo " },
        { kind: "math", value: "d", latex: "d" },
        { kind: "text", value: " la profondità del manto nevoso sulla copertura in m (vedasi la Figura C.3.4.7)." },
    ],
    "Resa come frazione l'espressione inline k=3/d e mantenuta integra la disuguaglianza seguente.",
);

console.log("circ3-final-corrections: aggiornate le unità editoriali C3");
