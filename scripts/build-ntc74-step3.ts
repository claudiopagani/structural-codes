/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
    aid,
    ev,
    inline,
    normalized,
    profile,
    raw,
    root,
    sourceId,
    unitId,
} from "./build-ntc74-step2.ts";

type Block = {
    kind: "heading" | "paragraph" | "list-item" | "formula-ref";
    page: number;
    from: number;
    to?: number;
    norm?: string;
    asset?: string;
};
type Unit = {
    number: string;
    title: string;
    heading: Block;
    blocks: Block[];
};
const f = (number: string): string => aid("formula", number);

const units: Unit[] = [
    {
        number: "7.4.5.2.1",
        title: "Regole di progetto",
        heading: {
            kind: "heading",
            page: 238,
            from: 21,
            norm: "7.4.5.2.1 Regole di progetto",
        },
        blocks: [
            { kind: "heading", page: 238, from: 22, norm: "STRUTTURE INTELAIATE" },
            { kind: "paragraph", page: 238, from: 23 },
            { kind: "heading", page: 238, from: 24 },
            { kind: "paragraph", page: 238, from: 25, to: 27 },
            { kind: "paragraph", page: 238, from: 28, to: 32 },
            { kind: "heading", page: 238, from: 33 },
            { kind: "paragraph", page: 238, from: 34, to: 36 },
            { kind: "paragraph", page: 238, from: 37, to: 38 },
            { kind: "paragraph", page: 238, from: 39 },
            { kind: "heading", page: 238, from: 40 },
            { kind: "paragraph", page: 238, from: 41, to: 42 },
            { kind: "paragraph", page: 238, from: 43, to: 46 },
            {
                kind: "heading",
                page: 238,
                from: 47,
                norm:
                    "STRUTTURE A PILASTRI INCASTRATI ALLA BASE E ORIZZONTAMENTI AD ESSI INCERNIERATI",
            },
            { kind: "paragraph", page: 238, from: 48, to: 49 },
            { kind: "paragraph", page: 238, from: 50, to: 51 },
            { kind: "paragraph", page: 238, from: 52, to: 54 },
            { kind: "paragraph", page: 238, from: 55, to: 56 },
        ],
    },
    {
        number: "7.4.5.2.2",
        title: "Valutazione della resistenza",
        heading: {
            kind: "heading",
            page: 239,
            from: 3,
            norm: "7.4.5.2.2 Valutazione della resistenza",
        },
        blocks: [
            { kind: "paragraph", page: 239, from: 4, to: 5 },
            { kind: "paragraph", page: 239, from: 6 },
            { kind: "paragraph", page: 239, from: 7, to: 8 },
        ],
    },
    {
        number: "7.4.5.3",
        title: "ELEMENTI STRUTTURALI",
        heading: {
            kind: "heading",
            page: 239,
            from: 9,
            norm: "7.4.5.3 ELEMENTI STRUTTURALI",
        },
        blocks: [
            { kind: "paragraph", page: 239, from: 10 },
            { kind: "heading", page: 239, from: 11 },
            { kind: "paragraph", page: 239, from: 12, to: 13 },
            { kind: "paragraph", page: 239, from: 14, to: 15 },
            { kind: "paragraph", page: 239, from: 16, to: 17 },
            { kind: "heading", page: 239, from: 18 },
            { kind: "paragraph", page: 239, from: 19, to: 20 },
            { kind: "paragraph", page: 239, from: 21, to: 25 },
            { kind: "heading", page: 239, from: 26 },
            { kind: "paragraph", page: 239, from: 27, to: 29 },
            { kind: "paragraph", page: 239, from: 30, to: 32 },
            { kind: "paragraph", page: 239, from: 33, to: 36 },
        ],
    },
    {
        number: "7.4.6",
        title:
            "DETTAGLI COSTRUTTIVI PER LE STRUTTURE A COMPORTAMENTO DISSIPATIVO",
        heading: {
            kind: "heading",
            page: 239,
            from: 37,
            norm:
                "7.4.6 DETTAGLI COSTRUTTIVI PER LE STRUTTURE A COMPORTAMENTO DISSIPATIVO",
        },
        blocks: [
            { kind: "paragraph", page: 239, from: 38, to: 39 },
            { kind: "list-item", page: 239, from: 40 },
            { kind: "list-item", page: 239, from: 41 },
        ],
    },
    {
        number: "7.4.6.1",
        title: "LIMITAZIONI GEOMETRICHE",
        heading: {
            kind: "heading",
            page: 239,
            from: 42,
            norm: "7.4.6.1 LIMITAZIONI GEOMETRICHE",
        },
        blocks: [],
    },
    {
        number: "7.4.6.1.1",
        title: "Travi",
        heading: {
            kind: "heading",
            page: 239,
            from: 43,
            norm: "7.4.6.1.1 Travi",
        },
        blocks: [
            {
                kind: "paragraph",
                page: 239,
                from: 44,
                to: 46,
                norm:
                    "La larghezza b della trave deve essere ≥ 20 cm e, per le travi “a spessore di solaio”, deve essere non maggiore della larghezza del pilastro, aumentata da ogni lato di metà dell’altezza della sezione trasversale della trave stessa, risultando comunque non maggiore di due volte b_c, essendo b_c la larghezza del pilastro misurata ortogonalmente all’asse della trave.",
            },
            {
                kind: "paragraph",
                page: 239,
                from: 47,
                norm:
                    "Il rapporto b/h tra larghezza e altezza della trave deve essere ≥ 0,25.",
            },
            { kind: "paragraph", page: 239, from: 48, to: 49 },
            { kind: "paragraph", page: 239, from: 50, to: 53 },
        ],
    },
    {
        number: "7.4.6.1.2",
        title: "Pilastri",
        heading: {
            kind: "heading",
            page: 240,
            from: 3,
            norm: "7.4.6.1.2 Pilastri",
        },
        blocks: [
            { kind: "paragraph", page: 240, from: 4 },
            {
                kind: "paragraph",
                page: 240,
                from: 5,
                to: 9,
                norm:
                    "Se θ, quale definito nel § 7.3.1, risulta > 0,1, la dimensione della sezione trasversale nella direzione parallela al piano d’inflessione non deve essere inferiore ad un ventesimo della maggiore tra le distanze tra il punto in cui si annulla il momento flettente e le estremità del pilastro. Quest’ultima limitazione geometrica non si applica quando gli effetti del secondo ordine siano presi in conto incrementando gli effetti dell’azione sismica di un fattore pari a 1/(1-θ) quando θ è compreso tra 0,1 e 0,2 o computati attraverso un’analisi non lineare quando θ è compreso tra 0,2 e 0,3.",
            },
            { kind: "paragraph", page: 240, from: 10, to: 11 },
        ],
    },
    {
        number: "7.4.6.1.3",
        title: "Nodi trave-pilastro",
        heading: {
            kind: "heading",
            page: 240,
            from: 12,
            norm: "7.4.6.1.3 Nodi trave-pilastro",
        },
        blocks: [{ kind: "paragraph", page: 240, from: 13, to: 15 }],
    },
    {
        number: "7.4.6.1.4",
        title: "Pareti",
        heading: {
            kind: "heading",
            page: 240,
            from: 16,
            norm: "7.4.6.1.4 Pareti",
        },
        blocks: [
            { kind: "paragraph", page: 240, from: 17 },
            { kind: "paragraph", page: 240, from: 18, to: 19 },
            { kind: "paragraph", page: 240, from: 20, to: 21 },
            { kind: "paragraph", page: 240, from: 22, to: 23 },
        ],
    },
    {
        number: "7.4.6.2",
        title: "LIMITAZIONI DI ARMATURA",
        heading: {
            kind: "heading",
            page: 240,
            from: 24,
            norm: "7.4.6.2 LIMITAZIONI DI ARMATURA",
        },
        blocks: [{ kind: "paragraph", page: 240, from: 25, to: 28 }],
    },
    {
        number: "7.4.6.2.1",
        title: "Travi",
        heading: {
            kind: "heading",
            page: 240,
            from: 29,
            norm: "7.4.6.2.1 Travi",
        },
        blocks: [
            { kind: "heading", page: 240, from: 30 },
            { kind: "paragraph", page: 240, from: 31, to: 32 },
            { kind: "paragraph", page: 240, from: 33, to: 36 },
            { kind: "formula-ref", page: 240, from: 37, to: 43, asset: f("7.4.26") },
            {
                kind: "paragraph",
                page: 240,
                from: 44,
                to: 47,
                norm:
                    "dove: ρ è il rapporto geometrico relativo all’armatura tesa, pari ad A_s/(b·h) oppure ad A_i/(b·h); ρ_comp è il rapporto geometrico relativo all’armatura compressa; f_yk è la tensione caratteristica di snervamento dell’acciaio (in MPa).",
            },
            {
                kind: "paragraph",
                page: 240,
                from: 48,
                norm:
                    "Inoltre deve essere ρ_comp ≥ 0,25ρ ovunque e nelle zone dissipative ρ_comp ≥ 1/2ρ.",
            },
            { kind: "paragraph", page: 240, from: 49, to: 53 },
            { kind: "paragraph", page: 240, from: 54, to: 55 },
            { kind: "list-item", page: 240, from: 56, to: 57 },
            { kind: "list-item", page: 240, from: 58, to: 59 },
            { kind: "paragraph", page: 241, from: 3, to: 4 },
            { kind: "paragraph", page: 241, from: 5 },
            {
                kind: "paragraph",
                page: 241,
                from: 6,
                to: 7,
                norm:
                    "Per prevenire lo sfilamento di queste armature il diametro delle barre non inclinate deve essere ≤ α_bL volte l’altezza della sezione del pilastro, essendo",
            },
            { kind: "formula-ref", page: 241, from: 8, to: 38, asset: f("7.4.27") },
            { kind: "paragraph", page: 241, from: 39 },
            {
                kind: "paragraph",
                page: 241,
                from: 40,
                norm: "ν_d è la forza assiale di progetto normalizzata;",
            },
            {
                kind: "paragraph",
                page: 241,
                from: 41,
                norm:
                    "k_D vale 1 o 2/3, rispettivamente per CD “A” e per CD “B”;",
            },
            {
                kind: "paragraph",
                page: 241,
                from: 42,
                norm:
                    "γ_Rd vale 1,2 o 1, rispettivamente per CD “A” e per CD “B”.",
            },
            { kind: "paragraph", page: 241, from: 43, to: 45 },
            { kind: "heading", page: 241, from: 46 },
            { kind: "paragraph", page: 241, from: 47, to: 49 },
            { kind: "list-item", page: 241, from: 50 },
            { kind: "list-item", page: 241, from: 51 },
            { kind: "list-item", page: 241, from: 52, to: 53 },
            { kind: "list-item", page: 241, from: 54 },
            { kind: "paragraph", page: 241, from: 55, to: 56 },
        ],
    },
    {
        number: "7.4.6.2.2",
        title: "Pilastri",
        heading: {
            kind: "heading",
            page: 241,
            from: 57,
            norm: "7.4.6.2.2 Pilastri",
        },
        blocks: [
            { kind: "paragraph", page: 241, from: 58, to: 60 },
            { kind: "paragraph", page: 241, from: 61, to: 62 },
            { kind: "heading", page: 241, from: 63 },
            { kind: "paragraph", page: 241, from: 64 },
            {
                kind: "paragraph",
                page: 241,
                from: 65,
                to: 66,
                norm:
                    "Nella sezione corrente del pilastro, la percentuale geometrica ρ di armatura longitudinale, con ρ rapporto tra l’area dell’armatura longitudinale e l’area della sezione del pilastro, deve essere compresa entro i seguenti limiti:",
            },
            { kind: "formula-ref", page: 241, from: 67, asset: f("7.4.28") },
            { kind: "paragraph", page: 241, from: 68, to: 69 },
            { kind: "heading", page: 241, from: 70 },
            { kind: "paragraph", page: 241, from: 71, to: 73 },
            { kind: "paragraph", page: 241, from: 74 },
            { kind: "paragraph", page: 241, from: 75 },
            {
                kind: "formula-ref",
                page: 241,
                from: 76,
                to: 77,
                asset: f("7.4.28:staffe-minime"),
            },
            { kind: "paragraph", page: 241, from: 78 },
            { kind: "list-item", page: 241, from: 79 },
            { kind: "list-item", page: 241, from: 80 },
            { kind: "list-item", page: 241, from: 81 },
            {
                kind: "paragraph",
                page: 242,
                from: 3,
                to: 4,
                norm:
                    "In ogni caso alle estremità di tutti i pilastri primari, per una lunghezza pari a quella delle zone dissipative, il rapporto ω_wd definito in [7.4.30] deve essere non minore di 0,08.",
            },
            { kind: "heading", page: 242, from: 5 },
            { kind: "paragraph", page: 242, from: 6, to: 8 },
            { kind: "formula-ref", page: 242, from: 9, to: 15, asset: f("7.4.29") },
            { kind: "formula-ref", page: 242, from: 16, to: 22, asset: f("7.4.30") },
            { kind: "paragraph", page: 242, from: 23 },
            {
                kind: "paragraph",
                page: 242,
                from: 24,
                to: 25,
                norm:
                    "ω_wd è il rapporto meccanico dell’armatura trasversale di confinamento all’interno della zona dissipativa (il nucleo di calcestruzzo è individuato con riferimento alla linea media delle staffe) che deve essere non minore di 0,12 in CD “A”.",
            },
            {
                kind: "paragraph",
                page: 242,
                from: 26,
                norm: "μ_φ è la domanda in duttilità di curvatura allo SLC;",
            },
            {
                kind: "paragraph",
                page: 242,
                from: 27,
                norm:
                    "ν_d è la forza assiale adimensionalizzata di progetto relativa alla combinazione sismica SLV (ν_d = N_Ed/(A_c·f_cd));",
            },
            {
                kind: "paragraph",
                page: 242,
                from: 28,
                norm: "ε_sy,d è la deformazione di snervamento dell’acciaio;",
            },
            { kind: "paragraph", page: 242, from: 29 },
            { kind: "paragraph", page: 242, from: 30 },
            { kind: "paragraph", page: 242, from: 31 },
            { kind: "paragraph", page: 242, from: 32 },
            {
                kind: "paragraph",
                page: 242,
                from: 33,
                to: 34,
                norm:
                    "α è il coefficiente di efficacia del confinamento, uguale a α = α_n·α_s, con:",
            },
            { kind: "list-item", page: 242, from: 35 },
            { kind: "formula-ref", page: 242, from: 36, to: 38, asset: f("7.4.31a") },
            { kind: "formula-ref", page: 242, from: 39, to: 40, asset: f("7.4.31b") },
            { kind: "paragraph", page: 242, from: 41, to: 42 },
            { kind: "list-item", page: 242, from: 43 },
            { kind: "formula-ref", page: 242, from: 44, asset: f("7.4.31c") },
            { kind: "formula-ref", page: 242, from: 45, to: 46, asset: f("7.4.31d") },
            {
                kind: "paragraph",
                page: 242,
                from: 47,
                to: 48,
                norm:
                    "dove: n è il numero totale di barre longitudinali contenute lateralmente da staffe o legature, b_i è la distanza tra barre consecutive contenute, β = 2 per staffe circolari singole, β = 1 per staffa a spirale.",
            },
        ],
    },
    {
        number: "7.4.6.2.3",
        title: "Nodi trave-pilastro",
        heading: {
            kind: "heading",
            page: 242,
            from: 49,
            norm: "7.4.6.2.3 Nodi trave-pilastro",
        },
        blocks: [{ kind: "paragraph", page: 242, from: 50, to: 53 }],
    },
    {
        number: "7.4.6.2.4",
        title: "Pareti",
        heading: {
            kind: "heading",
            page: 242,
            from: 54,
            norm: "7.4.6.2.4 Pareti",
        },
        blocks: [
            {
                kind: "paragraph",
                page: 242,
                from: 55,
                to: 59,
                norm:
                    "Nelle parti della parete, in pianta ed in altezza, al di fuori di una zona dissipativa, vanno seguite le regole del Capitolo 4, con un’armatura minima verticale e orizzontale, finalizzata a controllare la fessurazione da taglio, avente rapporto geometrico ρ riferito, rispettivamente, all’area della sezione orizzontale e verticale almeno pari allo 0,2%. Tuttavia, in quelle parti della sezione dove, nella situazione sismica di progetto, la deformazione a compressione ε_c è maggiore dello 0,2%, si raccomanda di fornire un rapporto geometrico di armatura verticale ρ ≥ 0,5%.",
            },
            { kind: "paragraph", page: 242, from: 60, to: 62 },
            { kind: "heading", page: 242, from: 63 },
            { kind: "paragraph", page: 242, from: 64, to: 65 },
            { kind: "heading", page: 242, from: 66 },
            { kind: "paragraph", page: 242, from: 67, to: 68 },
        ],
    },
];

const formulas: Record<string, [string, string | null, number, string]> = {
    "7.4.26": ["7.4.6.2.1", "7.4.26", 240, "\\frac{1{,}4}{f_{yk}}<\\rho<\\rho_{comp}+\\frac{3{,}5}{f_{yk}}"],
    "7.4.27": ["7.4.6.2.1", "7.4.27", 241, "\\alpha_{bL}=\\begin{cases}\\dfrac{7{,}5f_{ctm}}{\\gamma_{Rd}f_{yd}}\\dfrac{1+0{,}8\\nu_d}{1+0{,}75k_D\\rho_{comp}/\\rho}&\\text{per nodi interni}\\\\\\dfrac{7{,}5f_{ctm}}{\\gamma_{Rd}f_{yd}}\\left(1+0{,}8\\nu_d\\right)&\\text{per nodi esterni}\\end{cases}"],
    "7.4.28": ["7.4.6.2.2", "7.4.28", 241, "1\\%\\le\\rho\\le4\\%"],
    "7.4.28:staffe-minime": ["7.4.6.2.2", null, 241, "\\max\\left[6\\,\\mathrm{mm};\\;0{,}4d_{bl,max}\\sqrt{\\frac{f_{yd,l}}{f_{yd,st}}}\\right]\\quad\\text{per CD “A”, e }6\\,\\mathrm{mm}\\quad\\text{per CD “B”}"],
    "7.4.29": ["7.4.6.2.2", "7.4.29", 242, "\\alpha\\omega_{wd}\\ge30\\mu_\\phi\\nu_d\\varepsilon_{sy,d}\\frac{b_c}{b_0}-0{,}035"],
    "7.4.30": ["7.4.6.2.2", "7.4.30", 242, "\\omega_{wd}=\\frac{\\text{volume delle staffe di confinamento}}{\\text{volume del nucleo di calcestruzzo}}\\frac{f_{yd}}{f_{cd}}"],
    "7.4.31a": ["7.4.6.2.2", "7.4.31a", 242, "\\alpha_n=1-\\sum_{i=1}^{n}\\frac{b_i^2}{6b_0h_0}"],
    "7.4.31b": ["7.4.6.2.2", "7.4.31b", 242, "\\alpha_s=\\left[1-\\frac{s}{2b_0}\\right]\\left[1-\\frac{s}{2h_0}\\right]"],
    "7.4.31c": ["7.4.6.2.2", "7.4.31c", 242, "\\alpha_n=1"],
    "7.4.31d": ["7.4.6.2.2", "7.4.31d", 242, "\\alpha_s=\\left[1-\\frac{s}{2D_0}\\right]^\\beta"],
};

const output = join(root, "corpus", "units", "ntc2018");
await mkdir(output, { recursive: true });
for (const unit of units) {
    const id = unitId(unit.number);
    const blocks = [unit.heading, ...unit.blocks].map((block, index) => {
        const source = raw(block.page, block.from, block.to);
        const norm = block.norm ?? normalized(source);
        const blockId =
            index === 0
                ? "block-heading"
                : `block-editorial-${String(index).padStart(3, "0")}`;
        if (block.asset) {
            return {
                blockId: `${id}#${blockId}`,
                kind: block.kind,
                origin: "official",
                assetId: block.asset,
                evidence: ev(block.page, source, source),
            };
        }
        const segments = inline(norm);
        return {
            blockId: `${id}#${blockId}`,
            kind: block.kind,
            origin: "official",
            text: {
                raw: source,
                normalized: norm,
                normalizationVersion: profile,
                ...(segments ? { inline: segments } : {}),
            },
            evidence: ev(block.page, source, norm),
        };
    });
    const parts = unit.number.split(".");
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id,
        workId: "it-mit:dm:2018-01-17:ntc2018",
        expressionId: "it-mit:dm:2018-01-17:ntc2018:original-it",
        kind:
            parts.length === 2
                ? "section"
                : parts.length === 3
                  ? "paragraph"
                  : "subparagraph",
        numbering: {
            official: unit.number,
            sortKey: parts.map((part) => part.padStart(3, "0")).join("."),
        },
        title: unit.title,
        titleBlockId: `${id}#block-heading`,
        hierarchy: {
            parentId: unitId(parts.slice(0, -1).join(".")),
            ancestorIds: parts
                .slice(1)
                .map((_, i) => unitId(parts.slice(0, i + 1).join("."))),
            position: Number(parts.at(-1)),
        },
        validity: {
            from: "2018-03-22",
            to: null,
            status: "in-force",
            asOf: "2026-07-28",
        },
        blocks,
        citations: [],
        relations: [],
        assets: {
            formulaIds: blocks
                .filter(({ kind }) => kind === "formula-ref")
                .map(({ assetId }: any) => assetId),
            tableIds: [],
            figureIds: [],
        },
        workflow: {
            status: "extracted",
            createdBy: {
                actorId: "generator:ntc74:step3",
                kind: "script",
                toolVersion: profile,
            },
            createdAt: "2026-07-28T14:00:00Z",
            reviews: [],
            openIssues: [
                {
                    issueId: `ntc2018-${unit.number.replaceAll(".", "-")}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Trascrizione confrontata dal modello con il render ufficiale; resta obbligatoria la revisione umana indipendente.",
                },
            ],
        },
    };
    await writeFile(
        join(output, `${unit.number}.json`),
        `${JSON.stringify(record, null, 2)}\n`,
        "utf8",
    );
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "7.4-step3",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: Object.entries(formulas).map(
        ([key, [unit, officialNumber, pdfPage, latex]]) => ({
            id: f(key),
            unitId: unitId(unit),
            officialNumber,
            pdfPage,
            latex,
        }),
    ),
    tables: [],
    figures: [],
};
await writeFile(
    join(root, "corpus", "assets", "ntc2018", "7.4-step3.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
);
console.log(`ntc74-step3: generated ${units.length} units`);
