import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");
const figureDirectory = join(root, "corpus", "assets", "figures", "circ2019");
const evidenceRenderDirectory = join(root, "evidence", "circ-7-2019", "renders");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ42-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type FormulaRow = { number: string; page: number; latex: string; raw: string; region: Region };
type BlockKind = "heading" | "paragraph" | "formula-ref" | "figure-ref";
type GeneratedBlock = { blockId: string; kind: BlockKind; origin: "official"; text?: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] }; evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown }; assetId?: string };

const uid = (number: string) => "urn:structural-codes:it:unit:circ2019:" + number.toLowerCase();
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:circ2019:" + number.toLowerCase();
const figureId = (number: string) => "urn:structural-codes:it:asset:figure:circ2019:" + number.toLowerCase();
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const hash = (value: string) => sha256OfText(value);

function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) {
  return {
    sourceId,
    pdfPage: page,
    printedPage: String(page - 4),
    region,
    extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" },
    transformations: [
      { operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; formule e figure restano blocchi distinti." },
      ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con i render ufficiali." }] : []),
      { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
    ],
    rawSha256: hash(raw),
    normalizedSha256: hash(normalized),
  };
}

function block(number: string, suffix: string, kind: Exclude<BlockKind, "formula-ref" | "figure-ref">, page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock {
  return { blockId: uid(number) + "#block-" + suffix, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) };
}

function formulaBlock(number: string, suffix: string, formula: FormulaRow): GeneratedBlock {
  return { blockId: uid(number) + "#block-" + suffix, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

function figureBlock(number: string, suffix: string, asset: string, page: number, caption: string, region: Region): GeneratedBlock {
  return { blockId: uid(number) + "#block-" + suffix, kind: "figure-ref", origin: "official", assetId: asset, evidence: evidence(page, caption, caption, region, true) };
}

const formula126: FormulaRow = { number: "C4.2.126", page: 142, latex: "d_s=0{,}7\\cdot d_w-1{,}5\\cdot\\sum t\\ge0{,}55\\cdot d_w", raw: "d_s = 0,7·d_w − 1,5·Σt ≥ 0,55·d_w [C4.2.126]", region: reg(145, 180, 325, 45) };
const formula127: FormulaRow = { number: "C4.2.127", page: 142, latex: "F_{b,Rd}=\\frac{\\alpha\\cdot f_{tk}\\cdot d\\cdot t}{\\gamma_{M2}}", raw: "F_b,Rd = α·f_tk·d·t/γ_M2 [C4.2.127]", region: reg(145, 585, 325, 45) };
const formula128: FormulaRow = { number: "C4.2.128", page: 142, latex: "\\begin{aligned}\\alpha&=3{,}6\\cdot\\sqrt{\\frac{t}{d}}\\le2{,}1&&\\text{per }t_1=t\\\\\\alpha&=2{,}1&&\\text{per }t_1\\ge2{,}5\\cdot t\\end{aligned}", raw: "α = 3,6·√(t/d) ≤ 2,1 per t_1 = t; α = 2,1 per t_1 ≥ 2,5·t [C4.2.128]", region: reg(145, 630, 325, 65) };
const formula129: FormulaRow = { number: "C4.2.129", page: 142, latex: "F_{t,Rd}=\\frac{f_{tk}\\cdot e_1\\cdot t}{1{,}2\\cdot\\gamma_{M2}}", raw: "F_t,Rd = f_tk·e_1·t/(1,2·γ_M2) [C4.2.129]", region: reg(145, 700, 325, 45) };
const formula130: FormulaRow = { number: "C4.2.130", page: 143, latex: "F_{n,Rd}=\\frac{A_{net}\\cdot f_{tk}}{\\gamma_{M2}}", raw: "F_n,Rd = A_net·f_tk/γ_M2 [C4.2.130]", region: reg(145, 90, 325, 45) };
const formula131: FormulaRow = { number: "C4.2.131", page: 143, latex: "\\frac{1}{10}\\text{''}\\;(\\phi2{,}6\\,\\mathrm{mm})\\le d\\le\\frac{1}{4}\\text{''}\\;(\\phi6{,}4\\,\\mathrm{mm})", raw: "1/10\" (φ2,6 mm) ≤ d ≤ 1/4\" (φ6,4 mm) [C4.2.131]", region: reg(145, 145, 325, 45) };
const formula132: FormulaRow = { number: "C4.2.132", page: 143, latex: "e_1\\ge1{,}5\\cdot d\\ ;\\quad p_1\\ge3\\cdot d\\ ;\\quad e_2\\ge1{,}5\\cdot d\\ ;\\quad p_2\\ge3\\cdot d", raw: "e_1 ≥ 1,5·d; p_1 ≥ 3·d; e_2 ≥ 1,5·d; p_2 ≥ 3·d [C4.2.132]", region: reg(145, 205, 325, 45) };

const figure34 = figureId("C4.2.34");
const figure35 = figureId("C4.2.35");
const figure34Region = reg(170, 225, 270, 98);
const figure35Region = reg(170, 315, 270, 195);

const unit7 = "C4.2.12.1.7";
const unit71 = "C4.2.12.1.7.1";
const unit711 = "C4.2.12.1.7.1.1";

const blocks7: GeneratedBlock[] = [
  block(unit7, "heading", "heading", 141, "C4.2.12.1.7. Unioni", [text("C4.2.12.1.7. Unioni")], reg(73.9, 555, 450, 25)),
  block(unit7, "p1", "paragraph", 141, "Nelle unioni dei profilati formati a freddo e delle lamiere grecate si possono impiegare, oltre ai mezzi d’unione classici, bulloni e saldature a cordoni d’angolo, trattati nelle NTC, altri mezzi di collegamento quali viti autofilettanti o automaschianti, chiodi sparati, chiodi ciechi, saldature per punti (a resistenza o per fusione) e bottoni di saldatura.", [text("Nelle unioni dei profilati formati a freddo e delle lamiere grecate si possono impiegare, oltre ai mezzi d’unione classici, bulloni e saldature a cordoni d’angolo, trattati nelle NTC, altri mezzi di collegamento quali viti autofilettanti o automaschianti, chiodi sparati, chiodi ciechi, saldature per punti (a resistenza o per fusione) e bottoni di saldatura.")], reg(73.9, 580, 450, 35)),
  block(unit7, "p2", "paragraph", 141, "Poiché nelle unioni che interessano i profilati formati a freddo e le lamiere grecate possono intervenire elementi strutturali aventi spessori inferiori a 4 mm (minimo ammesso nelle NTC per gli elementi delle strutture di acciaio) sono necessari alcuni adattamenti ai piccoli spessori delle indicazioni delle Norme Tecniche anche per l’impiego dei bulloni e delle saldature.", [text("Poiché nelle unioni che interessano i profilati formati a freddo e le lamiere grecate possono intervenire elementi strutturali aventi spessori inferiori a 4 mm (minimo ammesso nelle NTC per gli elementi delle strutture di acciaio) sono necessari alcuni adattamenti ai piccoli spessori delle indicazioni delle Norme Tecniche anche per l’impiego dei bulloni e delle saldature.")], reg(73.9, 620, 450, 40)),
  block(unit7, "p3", "paragraph", 141, "Data la varietà delle soluzioni tecnologiche disponibili per i mezzi di unione quali viti autofilettanti o automaschianti, chiodi sparati, chiodi ciechi, bottoni di saldatura, alcune grandezze della resistenza delle unioni sono basate su attendibili risultati sperimentali, disponibili in letteratura, altre sono invece da determinarsi sperimentalmente (con procedure EOTA) per le applicazioni specifiche.", [text("Data la varietà delle soluzioni tecnologiche disponibili per i mezzi di unione quali viti autofilettanti o automaschianti, chiodi sparati, chiodi ciechi, bottoni di saldatura, alcune grandezze della resistenza delle unioni sono basate su attendibili risultati sperimentali, disponibili in letteratura, altre sono invece da determinarsi sperimentalmente (con procedure EOTA) per le applicazioni specifiche.")], reg(73.9, 665, 450, 45)),
  block(unit7, "symbols-heading", "heading", 141, "Simboli adottati nel seguito", [text("Simboli adottati nel seguito")], reg(73.9, 715, 450, 20)),
  block(unit7, "symbol-t", "paragraph", 141, "t — spessore minimo delle membrature interessate nel collegamento", [math("t", "t"), text(" — spessore minimo delle membrature interessate nel collegamento")], reg(73.9, 735, 450, 20)),
  block(unit7, "symbol-t1", "paragraph", 141, "t_1 — spessore massimo delle membrature interessate nel collegamento", [math("t_1", "t_1"), text(" — spessore massimo delle membrature interessate nel collegamento")], reg(73.9, 755, 450, 20)),
  block(unit7, "symbol-tstar", "paragraph", 142, "t* — spessore del materiale base nel quale sono ancorate le viti autofilettanti oppure i bottoni di saldatura", [math("t*", "t^*"), text(" — spessore del materiale base nel quale sono ancorate le viti autofilettanti oppure i bottoni di saldatura")], reg(73.9, 80, 450, 20)),
  block(unit7, "symbol-d0", "paragraph", 142, "d_0 — diametro del foro per il mezzo di collegamento (Figura C4.2.34)", [math("d_0", "d_0"), text(" — diametro del foro per il mezzo di collegamento (Figura C4.2.34)")], reg(73.9, 100, 450, 20)),
  block(unit7, "symbol-d", "paragraph", 142, "d — diametro del mezzo di collegamento (chiodo, vite, ecc.)", [math("d", "d"), text(" — diametro del mezzo di collegamento (chiodo, vite, ecc.)")], reg(73.9, 120, 450, 20)),
  block(unit7, "symbol-dw", "paragraph", 142, "d_w — diametro della testa della vite di collegamento o diametro della rondella sotto testa o diametro visibile del punto di saldatura (Figura C4.2.35)", [math("d_w", "d_w"), text(" — diametro della testa della vite di collegamento o diametro della rondella sotto testa o diametro visibile del punto di saldatura (Figura C4.2.35)")], reg(73.9, 140, 450, 30)),
  block(unit7, "symbol-ds", "paragraph", 142, "d_s — diametro efficace del punto o bottone di saldatura,", [math("d_s", "d_s"), text(" — diametro efficace del punto o bottone di saldatura,")], reg(73.9, 170, 450, 20)),
  formulaBlock(unit7, "formula-126", formula126),
  block(unit7, "symbol-dp", "paragraph", 142, "d_p — diametro della saldatura del bottone,", [math("d_p", "d_p"), text(" — diametro della saldatura del bottone,")], reg(73.9, 220, 450, 20)),
  block(unit7, "symbol-s", "paragraph", 142, "s — passo della filettatura delle viti autofilettanti o automaschianti.", [math("s", "s"), text(" — passo della filettatura delle viti autofilettanti o automaschianti.")], reg(73.9, 240, 450, 20)),
  figureBlock(unit7, "figure-34", figure34, 142, "Figura C4.2.34 – Parametri significativi per i collegamenti", figure34Region),
  figureBlock(unit7, "figure-35", figure35, 142, "Figura C4.2.35 – Saldature a bottone", figure35Region),
  block(unit7, "p4", "paragraph", 142, "In Figura C4.2.34 sono indicati gli interassi e le varie distanze che interessano il dimensionamento dei collegamenti; in Figura C4.2.35 sono indicati i diametri dei punti e bottoni di saldatura.", [text("In Figura C4.2.34 sono indicati gli interassi e le varie distanze che interessano il dimensionamento dei collegamenti; in Figura C4.2.35 sono indicati i diametri dei punti e bottoni di saldatura.")], reg(73.9, 515, 450, 35)),
];

const blocks71: GeneratedBlock[] = [
  block(unit71, "heading", "heading", 142, "C4.2.12.1.7.1. Chiodi ciechi", [text("C4.2.12.1.7.1. Chiodi ciechi")], reg(73.9, 555, 450, 25)),
];

const blocks711: GeneratedBlock[] = [
  block(unit711, "heading", "heading", 142, "C4.2.12.1.7.1.1. Chiodi ciechi soggetti a taglio", [text("C4.2.12.1.7.1.1. Chiodi ciechi soggetti a taglio")], reg(73.9, 580, 450, 25)),
  block(unit711, "p1", "paragraph", 142, "La resistenza a rifollamento è data da", [text("La resistenza a rifollamento è data da")], reg(73.9, 610, 450, 20)),
  formulaBlock(unit711, "formula-127", formula127),
  block(unit711, "p2", "paragraph", 142, "dove", [text("dove")], reg(73.9, 650, 80, 20)),
  formulaBlock(unit711, "formula-128", formula128),
  block(unit711, "p3", "paragraph", 142, "nei casi intermedi (t ≤ t_1<2,5 t) α può essere determinato per interpolazione lineare.", [text("nei casi intermedi ("), math("t ≤ t_1<2,5 t", "t\\le t_1<2{,}5\\,t"), text(") "), math("α", "\\alpha"), text(" può essere determinato per interpolazione lineare.")], reg(73.9, 705, 450, 25)),
  block(unit711, "p4", "paragraph", 142, "La resistenza allo strappo della lamiera collegata è data da", [text("La resistenza allo strappo della lamiera collegata è data da")], reg(73.9, 730, 450, 25)),
  formulaBlock(unit711, "formula-129", formula129),
  block(unit711, "p5", "paragraph", 143, "essendo e_1 indicato in Figura C4.2.34.", [text("essendo "), math("e_1", "e_1"), text(" indicato in Figura C4.2.34.")], reg(73.9, 80, 450, 20)),
  block(unit711, "p6", "paragraph", 143, "La resistenza a trazione della sezione netta è data da", [text("La resistenza a trazione della sezione netta è data da")], reg(73.9, 105, 450, 20)),
  formulaBlock(unit711, "formula-130", formula130),
  block(unit711, "p7", "paragraph", 143, "Le formule [C4.2.127], [C4.2.129] e [C4.2.130] per chiodi ciechi sono valide per diametri d compresi nell’intervallo", [text("Le formule [C4.2.127], [C4.2.129] e [C4.2.130] per chiodi ciechi sono valide per diametri "), math("d", "d"), text(" compresi nell’intervallo")], reg(73.9, 135, 450, 30)),
  formulaBlock(unit711, "formula-131", formula131),
  block(unit711, "p8", "paragraph", 143, "e per geometrie del collegamento che rispettino le condizioni", [text("e per geometrie del collegamento che rispettino le condizioni")], reg(73.9, 185, 450, 25)),
  formulaBlock(unit711, "formula-132", formula132),
  block(unit711, "p9", "paragraph", 143, "Informazioni sulla resistenza a taglio, a trazione, ecc. dei chiodi ciechi devono essere dedotte sperimentalmente, con adeguata base statistica (al riguardo potrà farsi utile riferimento a documenti resi disponibili dall’EOTA), sulle specifiche produzioni.", [text("Informazioni sulla resistenza a taglio, a trazione, ecc. dei chiodi ciechi devono essere dedotte sperimentalmente, con adeguata base statistica (al riguardo potrà farsi utile riferimento a documenti resi disponibili dall’EOTA), sulle specifiche produzioni.")], reg(73.9, 245, 450, 45)),
];

function makeUnit(number: string, title: string, parentId: string | null, ancestors: string[], position: number, blocks: GeneratedBlock[], formulaIds: string[], figureIds: string[]) {
  return {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id: uid(number),
    workId,
    expressionId,
    kind: "subparagraph",
    numbering: { official: number, sortKey: number.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") },
    title,
    titleBlockId: uid(number) + "#block-heading",
    hierarchy: { parentId, ancestorIds: ancestors, position },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
    blocks,
    citations: [],
    relations: [],
    assets: { formulaIds, tableIds: [], figureIds },
    workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2y", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." }, ...((formulaIds.length || figureIds.length) ? [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-assets-review", type: "asset-review", severity: "blocking", note: "Formule e figure del blocco richiedono revisione umana indipendente." }] : [])] },
  };
}

const formulaRows = [formula126, formula127, formula128, formula129, formula130, formula131, formula132];
const records = [
  makeUnit(unit7, "Unioni", uid("C4.2.12.1"), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1")], 7, blocks7, [formulaId(formula126.number)], [figure34, figure35]),
  makeUnit(unit71, "Chiodi ciechi", uid(unit7), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid(unit7)], 1, blocks71, [], []),
  makeUnit(unit711, "Chiodi ciechi soggetti a taglio", uid(unit71), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid(unit7), uid(unit71)], 1, blocks711, formulaRows.slice(1).map((formula) => formulaId(formula.number)), []),
];
const manifest = {
  $schema: "urn:structural-codes:schema:asset-manifest:v2",
  schemaVersion: "2.0.0-alpha.1",
  recordType: "asset-manifest",
  document: "circ2019",
  section: "C4.2-step2y",
  sourceId,
  status: "transcribed-unreviewed",
  formulas: formulaRows.map((formula) => ({ id: formulaId(formula.number), unitId: uid(formula.number === formula126.number ? unit7 : unit711), officialNumber: formula.number, pdfPage: formula.page, latex: formula.latex })),
  tables: [],
  figures: [
    { id: figure34, unitId: uid(unit7), officialNumber: "C4.2.34", pdfPage: 142, caption: "Figura C4.2.34 – Parametri significativi per i collegamenti", alt: "Parametri significativi per i collegamenti", imagePath: "figures/circ2019/figc4.2.34.png", region: figure34Region, sha256: "c404bd80fa08d341933a1d25438de94881e5dfb9368f8c80d0a0aa600df5ab02" },
    { id: figure35, unitId: uid(unit7), officialNumber: "C4.2.35", pdfPage: 142, caption: "Figura C4.2.35 – Saldature a bottone", alt: "Saldature a bottone", imagePath: "figures/circ2019/figc4.2.35.png", region: figure35Region, sha256: "ef8bd04b1d722a64c9c58f06dd5a8a3087b22f52ea30feb42ecaed0054438949" },
  ],
};
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await Promise.all([...records.map((record) => writeFile(join(unitDirectory, record.numbering.official.toLowerCase() + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8")), writeFile(join(assetDirectory, "C4.2-step2y.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8"), copyFile(join(evidenceRenderDirectory, "page-0142-x170-y225-w270-h98@4x.png"), join(figureDirectory, "figc4.2.34.png")), copyFile(join(evidenceRenderDirectory, "page-0142-x170-y315-w270-h195@4x.png"), join(figureDirectory, "figc4.2.35.png"))]);
console.log("Circolare C4.2 step2y: generate 3 unità, 7 formule e 2 figure.");
