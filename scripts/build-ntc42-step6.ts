import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(root, "corpus", "units", "ntc2018");
const assetDir = join(root, "corpus", "assets", "ntc2018");
const sourceId = "gu-so8-2018-ntc";
const workId = "it-mit:dm:2018-01-17:ntc2018";
const expressionId = "it-mit:dm:2018-01-17:ntc2018:original-it";
const profile = "ntc42-editorial-profile-0.2.0";
const createdAt = "2026-08-10T00:00:00Z";
type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Opt = { page: number; printedPage: string; wrap?: boolean; discretionaryHyphen?: boolean; manual?: boolean; pageBreak?: boolean };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
const uid = (n: string) => "urn:structural-codes:it:unit:ntc2018:" + n;
const fid = (n: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + n;
const tid = (n: string) => "urn:structural-codes:it:asset:table:ntc2018:" + n;
const gid = (n: string) => "urn:structural-codes:it:asset:figure:ntc2018:" + n;
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const pg = (page: number, printedPage: string, options: Omit<Opt, "page" | "printedPage"> = {}): Opt => ({ page, printedPage, ...options });
const t = (value: string): Inline => ({ kind: "text", value });
const m = (value: string, latex: string): Inline => ({ kind: "math", value, latex });

function transformations(o: Opt) {
  const result: Array<{ operation: string; ruleVersion: string; note: string }> = [];
  if (o.wrap) result.push({ operation: "join-line-wrap", ruleVersion: profile, note: "Unite le righe appartenenti allo stesso capoverso; i capoversi distinti restano blocchi separati." });
  if (o.discretionaryHyphen) result.push({ operation: "remove-discretionary-hyphen", ruleVersion: profile, note: "Ricomposte le parole spezzate dal trattino tipografico del PDF." });
  if (o.pageBreak) result.push({ operation: "join-page-break", ruleVersion: profile, note: "Unita una continuazione testuale attraversata da un cambio pagina." });
  if (o.wrap || o.discretionaryHyphen || o.manual) result.push({ operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione e la correzione dei glifi." });
  if (o.manual) result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, simboli e matematica confrontati con il render ufficiale." });
  if (o.wrap || o.manual || o.pageBreak) result.push({ operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." });
  return result;
}

function evidence(o: Opt, region: Region, raw: string, normalized: string) {
  return {
    sourceId,
    pdfPage: o.page,
    printedPage: o.printedPage,
    region,
    extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" },
    transformations: transformations(o),
    rawSha256: sha256OfText(raw),
    normalizedSha256: sha256OfText(normalized),
  };
}

function textBlock(n: string, suffix: string, kind: "heading" | "paragraph" | "list-item", o: Opt, region: Region, normalized: string, inline: Inline[] = [t(normalized)], raw = normalized) {
  return {
    blockId: uid(n) + "#block-" + suffix,
    kind,
    origin: "official",
    text: { raw, normalized, normalizationVersion: profile, ...(inline.length > 0 ? { inline } : {}) },
    evidence: evidence(o, region, raw, normalized),
  };
}

function formulaBlock(n: string, number: string, o: Opt, region: Region) {
  const raw = "[" + number + "]";
  return {
    blockId: uid(n) + "#block-formula-" + number.replaceAll(".", "-"),
    kind: "formula-ref",
    origin: "official",
    assetId: fid(number),
    evidence: {
      ...evidence({ ...o, manual: true }, region, raw, raw),
      extraction: { method: "manual-transcription", tool: "codex-source-transcription", toolVersion: profile },
    },
  };
}

function assetBlock(n: string, suffix: string, kind: "table-ref" | "figure-ref", assetId: string, o: Opt, region: Region) {
  const note = kind === "table-ref" ? "Tabella strutturata dal render ufficiale; revisione umana cella per cella ancora obbligatoria." : "Crop raster ufficiale verificato sul render; revisione umana del posizionamento ancora obbligatoria.";
  return {
    blockId: uid(n) + "#block-" + suffix,
    kind,
    origin: "official",
    assetId,
    evidence: {
      ...evidence({ ...o, manual: true }, region, note, note),
      extraction: { method: "manual-transcription", tool: "codex-source-transcription", toolVersion: profile },
    },
  };
}

function parent(n: string) {
  const parts = n.split(".");
  return parts.length === 1 ? null : uid(parts.slice(0, -1).join("."));
}

function ancestors(n: string) {
  const parts = n.split(".");
  return parts.slice(1).map((_, index) => uid(parts.slice(0, index + 1).join(".")));
}

function unit(n: string, title: string, blocks: unknown[], formulas: string[] = [], tables: string[] = [], figures: string[] = []) {
  return {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id: uid(n),
    workId,
    expressionId,
    kind: "subparagraph",
    numbering: { official: n, sortKey: n.split(".").map((part) => part.padStart(3, "0")).join(".") },
    title,
    titleBlockId: uid(n) + "#block-heading",
    hierarchy: { parentId: parent(n), ancestorIds: ancestors(n), position: Number(n.split(".").at(-1)) },
    validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-10" },
    blocks,
    citations: [],
    relations: [],
    assets: { formulaIds: formulas.map(fid), tableIds: tables.map(tid), figureIds: figures.map(gid) },
    workflow: {
      status: "extracted",
      createdBy: { actorId: "codex:ntc42-step6", kind: "automated-agent", toolVersion: profile },
      createdAt,
      reviews: [],
      openIssues: [
        { issueId: "ntc2018-" + n.replaceAll(".", "-") + "-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
        ...tables.map(() => ({ issueId: "ntc2018-" + n.replaceAll(".", "-") + "-assets", type: "asset-review", severity: "blocking", note: "La tabella è strutturata e richiede verifica umana cella per cella." })),
        ...figures.map(() => ({ issueId: "ntc2018-" + n.replaceAll(".", "-") + "-figures", type: "asset-review", severity: "blocking", note: "Il crop ufficiale è registrato; resta la revisione umana del posizionamento." })),
      ],
    },
  };
}

const p115 = pg(115, "111", { wrap: true, manual: true });
const p116 = pg(116, "112", { wrap: true, manual: true });
const p117 = pg(117, "113", { wrap: true, manual: true });
const p118 = pg(118, "114", { wrap: true, manual: true });
const p119 = pg(119, "115", { wrap: true, manual: true });

const continuationBlocks = [
  textBlock("4.2.8.1.1", "heading-shear-tension", "heading", p115, reg(82.954, 105.564, 195.779, 7.476), "Unioni con bulloni o chiodi soggette a taglio e/o a trazione"),
  textBlock("4.2.8.1.1", "p18", "paragraph", p115, reg(82.954, 118.17, 428.6, 18.44), "La resistenza di progetto a taglio dei bulloni e dei chiodi Fv,Rd, per ogni piano di taglio che interessa il gambo dell’elemento di connessione, può essere assunta pari a:", [t("La resistenza di progetto a taglio dei bulloni e dei chiodi "), m("Fv,Rd", "F_{v,Rd}"), t(", per ogni piano di taglio che interessa il gambo dell’elemento di connessione, può essere assunta pari a:")]),
  formulaBlock("4.2.8.1.1", "4.2.63", p115, reg(125, 137, 245, 16)),
  formulaBlock("4.2.8.1.1", "4.2.64", p115, reg(125, 151, 245, 16)),
  formulaBlock("4.2.8.1.1", "4.2.65", p115, reg(125, 164, 245, 16)),
  textBlock("4.2.8.1.1", "p19", "paragraph", p115, reg(82.953, 182.21, 428.6, 18.5), "Ares indica l’area resistente della vite e si adotta quando il piano di taglio interessa la parte filettata della vite. Nei casi in cui il piano di taglio interessa il gambo non filettato della vite si ha", [m("Ares", "A_{res}"), t(" indica l’area resistente della vite e si adotta quando il piano di taglio interessa la parte filettata della vite. Nei casi in cui il piano di taglio interessa il gambo non filettato della vite si ha")], "A res indica l’area resistente della vite e si adotta quando il piano di taglio interessa la parte filettata della vite. Nei casi in cui il pi-\nano di taglio interessa il gambo non filettato della vite si ha"),
  formulaBlock("4.2.8.1.1", "4.2.66", p115, reg(125, 201, 245, 16)),
  textBlock("4.2.8.1.1", "p20", "paragraph", p115, reg(82.954, 219, 428.6, 27.6), "dove A indica l’area nominale del gambo della vite e ftbk, invece, indica la resistenza a rottura del materiale impiegato per realizzare il bullone. Con ftrk è indicata la resistenza caratteristica del materiale utilizzato per i chiodi, mentre A0 indica la sezione del foro.", [t("dove "), m("A", "A"), t(" indica l’area nominale del gambo della vite e "), m("ftbk", "f_{tbk}"), t(", invece, indica la resistenza a rottura del materiale impiegato per realizzare il bullone. Con "), m("ftrk", "f_{trk}"), t(" è indicata la resistenza caratteristica del materiale utilizzato per i chiodi, mentre "), m("A0", "A_0"), t(" indica la sezione del foro.")]),
  textBlock("4.2.8.1.1", "p21", "paragraph", p115, reg(82.954, 253.88, 428.6, 7.48), "La resistenza di progetto a rifollamento Fb,Rd del piatto dell’unione, bullonata o chiodata, può essere assunta pari a:", [t("La resistenza di progetto a rifollamento "), m("Fb,Rd", "F_{b,Rd}"), t(" del piatto dell’unione, bullonata o chiodata, può essere assunta pari a:")]),
  formulaBlock("4.2.8.1.1", "4.2.67", p115, reg(180, 260, 185, 17)),
  textBlock("4.2.8.1.1", "p22", "paragraph", p115, reg(82.954, 278.358, 428.6, 108), "dove: d è il diametro nominale del gambo del bullone, t è lo spessore della piastra collegata, ftk è la resistenza caratteristica a rottura del materiale della piastra collegata, α=min {e1/(3 d0) ; ftbk/ftk ; 1} per bulloni di bordo nella direzione del carico applicato, α=min {p1/(3 d0) − 0,25 ; ftbk/ftk ; 1} per bulloni interni nella direzione del carico applicato, k=min {2,8 e2/d0 − 1,7 ; 2,5} per bulloni di bordo nella direzione perpendicolare al carico applicato, k=min {1,4 p2/d0 − 1,7 , 2,5} per bulloni interni nella direzione perpendicolare al carico applicato, essendo e1, e2, p1 e p2 indicati in Fig. 4.2.5 e d0 il diametro nominale del foro di alloggiamento del bullone.", [t("dove: "), m("d", "d"), t(" è il diametro nominale del gambo del bullone, "), m("t", "t"), t(" è lo spessore della piastra collegata, "), m("ftk", "f_{tk}"), t(" è la resistenza caratteristica a rottura del materiale della piastra collegata, "), m("α=min {e1/(3 d0) ; ftbk/ftk ; 1}", "\\alpha=\\min\\{e_1/(3d_0);f_{tbk}/f_{tk};1\\}"), t(" per bulloni di bordo nella direzione del carico applicato, "), m("α=min {p1/(3 d0) − 0,25 ; ftbk/ftk ; 1}", "\\alpha=\\min\\{p_1/(3d_0)-0{,}25;f_{tbk}/f_{tk};1\\}"), t(" per bulloni interni nella direzione del carico applicato, "), m("k=min {2,8 e2/d0 − 1,7 ; 2,5}", "k=\\min\\{2{,}8e_2/d_0-1{,}7;2{,}5\\}"), t(" per bulloni di bordo nella direzione perpendicolare al carico applicato, "), m("k=min {1,4 p2/d0 − 1,7 , 2,5}", "k=\\min\\{1{,}4p_2/d_0-1{,}7;2{,}5\\}"), t(" per bulloni interni nella direzione perpendicolare al carico applicato, essendo "), m("e1, e2, p1 e p2", "e_1,e_2,p_1,p_2"), t(" indicati in Fig. 4.2.5 e "), m("d0", "d_0"), t(" il diametro nominale del foro di alloggiamento del bullone.")]),
  textBlock("4.2.8.1.1", "p23", "paragraph", p115, reg(82.951, 397.07, 428.6, 7.48), "La resistenza di progetto a trazione degli elementi di connessione Ft,Rd può essere assunta pari a:", [t("La resistenza di progetto a trazione degli elementi di connessione "), m("Ft,Rd", "F_{t,Rd}"), t(" può essere assunta pari a:")]),
  formulaBlock("4.2.8.1.1", "4.2.68", p115, reg(155, 403, 210, 16)),
  formulaBlock("4.2.8.1.1", "4.2.69", p115, reg(155, 417, 210, 16)),
  textBlock("4.2.8.1.1", "p24", "paragraph", p115, reg(82.951, 435.05, 428.6, 17.5), "Inoltre, nelle unioni bullonate soggette a trazione è necessario verificare la piastra a punzonamento; ciò non è richiesto per le unioni chiodate. La resistenza di progetto a punzonamento del piatto collegato è pari a", [t("Inoltre, nelle unioni bullonate soggette a trazione è necessario verificare la piastra a punzonamento; ciò non è richiesto per le unioni chiodate. La resistenza di progetto a punzonamento del piatto collegato è pari a")], "Inoltre, nelle unioni bullonate soggette a trazione è necessario verificare la piastra a punzonamento; ciò non è richiesto per le u-\nnioni chiodate. La resistenza di progetto a punzonamento del piatto collegato è pari a"),
  formulaBlock("4.2.8.1.1", "4.2.70", p115, reg(175, 452, 205, 18)),
  textBlock("4.2.8.1.1", "p25", "paragraph", p115, reg(82.958, 471.188, 428.6, 18.5), "dove dm è il minimo tra il diametro del dado e il diametro medio della testa del bullone; tp è lo spessore del piatto e ftk è la tensione di rottura dell’acciaio del piatto.", [t("dove "), m("dm", "d_m"), t(" è il minimo tra il diametro del dado e il diametro medio della testa del bullone; "), m("tp", "t_p"), t(" è lo spessore del piatto e "), m("ftk", "f_{tk}"), t(" è la tensione di rottura dell’acciaio del piatto.")]),
  textBlock("4.2.8.1.1", "p26", "paragraph", p115, reg(82.957, 494.76, 428.6, 18.5), "La resistenza di progetto complessiva della singola unione a taglio è perciò data da min (Fv,Rd; Fb,Rd), mentre la resistenza di progetto della singola unione a trazione è ottenuta come min (Bp,Rd; Ft,Rd).", [t("La resistenza di progetto complessiva della singola unione a taglio è perciò data da min ("), m("Fv,Rd", "F_{v,Rd}"), t("; "), m("Fb,Rd", "F_{b,Rd}"), t("), mentre la resistenza di progetto della singola unione a trazione è ottenuta come min ("), m("Bp,Rd", "B_{p,Rd}"), t("; "), m("Ft,Rd", "F_{t,Rd}"), t(").")]),
  textBlock("4.2.8.1.1", "p27", "paragraph", p115, reg(82.956, 519.28, 330.121, 7.48), "Nel caso di presenza combinata di trazione e taglio si può adottare la formula di interazione lineare:"),
  formulaBlock("4.2.8.1.1", "4.2.71", p115, reg(185, 526, 180, 28)),
  textBlock("4.2.8.1.1", "p28", "paragraph", p115, reg(82.954, 555.588, 428.6, 34), "con la limitazione Ft,Ed/Ft,Rd ≤ 1, dove con Fv,Ed ed Ft,Ed si sono indicate rispettivamente le sollecitazioni di taglio e di trazione agenti sull’unione; per brevità, le resistenze a taglio ed a trazione dell’unione sono state indicate con Fv,Rd ed Ft,Rd.", [t("con la limitazione "), m("Ft,Ed/Ft,Rd", "\\frac{F_{t,Ed}}{F_{t,Rd}}"), t(" ≤ 1, dove con "), m("Fv,Ed", "F_{v,Ed}"), t(" ed "), m("Ft,Ed", "F_{t,Ed}"), t(" si sono indicate rispettivamente le sollecitazioni di taglio e di trazione agenti sull’unione; per brevità, le resistenze a taglio ed a trazione dell’unione sono state indicate con "), m("Fv,Rd", "F_{v,Rd}"), t(" ed "), m("Ft,Rd", "F_{t,Rd}"), t(".")]),
  textBlock("4.2.8.1.1", "heading-friction", "heading", p115, reg(82.954, 596.884, 188.204, 7.476), "Unioni a taglio per attrito con bulloni ad alta resistenza"),
  textBlock("4.2.8.1.1", "p29", "paragraph", p115, reg(82.954, 609.44, 428.6, 7.48), "La resistenza di progetto allo scorrimento Fs,Rd di un bullone di classe 8.8 o 10.9 precaricato può essere assunta pari a:", [t("La resistenza di progetto allo scorrimento "), m("Fs,Rd", "F_{s,Rd}"), t(" di un bullone di classe 8.8 o 10.9 precaricato può essere assunta pari a:")]),
  formulaBlock("4.2.8.1.1", "4.2.72", p115, reg(180, 616, 180, 17)),
  textBlock("4.2.8.1.1", "p30", "paragraph", p115, reg(82.958, 631.416, 428.6, 54), "dove: n è il numero delle superfici di attrito, μ è il coefficiente di attrito, Fp,Cd è la forza di precarico del bullone data dalla espressione [4.2.62] che, in caso di serraggio controllato, può essere assunta pari a 0,7 ftbk Ares, invece che pari a 0,7 ftbk Ares/γM7.", [t("dove: "), m("n", "n"), t(" è il numero delle superfici di attrito, "), m("μ", "\\mu"), t(" è il coefficiente di attrito, "), m("Fp,Cd", "F_{p,Cd}"), t(" è la forza di precarico del bullone data dalla espressione [4.2.62] che, in caso di serraggio controllato, può essere assunta pari a 0,7 "), m("ftbk Ares", "f_{tbk}A_{res}"), t(", invece che pari a 0,7 "), m("ftbk Ares/γM7", "f_{tbk}A_{res}/\\gamma_{M7}"), t(".")]),
  textBlock("4.2.8.1.1", "p31", "paragraph", p116, reg(82.954, 234.601, 428.6, 18), "Nel caso un collegamento ad attrito con bulloni ad alta resistenza precaricati sia soggetto a trazione Ft,Ed (allo stato limite ultimo) la resistenza di progetto allo scorrimento Fs,Rd si riduce rispetto al valore sopra indicato e può essere assunta pari a:", [t("Nel caso un collegamento ad attrito con bulloni ad alta resistenza precaricati sia soggetto a trazione "), m("Ft,Ed", "F_{t,Ed}"), t(" (allo stato limite ultimo) la resistenza di progetto allo scorrimento "), m("Fs,Rd", "F_{s,Rd}"), t(" si riduce rispetto al valore sopra indicato e può essere assunta pari a:")]),
  formulaBlock("4.2.8.1.1", "4.2.73", p116, reg(160, 255, 205, 18)),
  textBlock("4.2.8.1.1", "p32", "paragraph", p116, reg(82.958, 272.579, 332.249, 7.48), "Nel caso di verifica allo scorrimento nello stato limite di esercizio, in modo analogo si può assumere:"),
  formulaBlock("4.2.8.1.1", "4.2.74", p116, reg(155, 278, 210, 18)),
  textBlock("4.2.8.1.1", "p33", "paragraph", p116, reg(82.948, 296.149, 428.6, 7.48), "dove Ft,Ed,eser è la sollecitazione di progetto ottenuta dalla combinazione dei carichi per le verifiche in esercizio.", [t("dove "), m("Ft,Ed,eser", "F_{t,Ed,eser}"), t(" è la sollecitazione di progetto ottenuta dalla combinazione dei carichi per le verifiche in esercizio.")]),
];

const units = [
  unit("4.2.8.1.2", "Collegamenti con perni", [
    textBlock("4.2.8.1.2", "heading", "heading", p116, reg(82.954, 318.684, 155, 7.476), "4.2.8.1.2 Collegamenti con perni"),
    textBlock("4.2.8.1.2", "p1", "paragraph", p116, reg(82.954, 331.28, 168, 7.48), "La resistenza di progetto a taglio del perno è pari a", [t("La resistenza di progetto a taglio del perno è pari a")]),
    formulaBlock("4.2.8.1.2", "4.2.75", p116, reg(180, 338, 190, 18)),
    textBlock("4.2.8.1.2", "p2", "paragraph", p116, reg(82.954, 357.349, 260, 7.48), "dove A è l’area della sezione del perno ed fupk è la tensione a rottura del perno.", [t("dove "), m("A", "A"), t(" è l’area della sezione del perno ed "), m("fupk", "f_{upk}"), t(" è la tensione a rottura del perno.")]),
    textBlock("4.2.8.1.2", "p3", "paragraph", p116, reg(82.953, 370.859, 302, 7.48), "La resistenza di progetto a rifollamento dell’elemento in acciaio connesso dal perno è pari a", [t("La resistenza di progetto a rifollamento dell’elemento in acciaio connesso dal perno è pari a")]),
    formulaBlock("4.2.8.1.2", "4.2.76", p116, reg(180, 377, 190, 18)),
    textBlock("4.2.8.1.2", "p4", "paragraph", p116, reg(82.955, 396.928, 428.6, 17.5), "dove t è lo spessore dell’elemento, d il diametro del perno, fy è la minore tra la tensione di snervamento del perno (fypk) e quella delle piastre (fyk).", [t("dove "), m("t", "t"), t(" è lo spessore dell’elemento, "), m("d", "d"), t(" il diametro del perno, "), m("fy", "f_y"), t(" è la minore tra la tensione di snervamento del perno ("), m("fypk", "f_{ypk}"), t(") e quella delle piastre ("), m("fyk", "f_{yk}"), t(").")]),
    textBlock("4.2.8.1.2", "p5", "paragraph", p116, reg(82.956, 419.549, 428.6, 17.5), "Nella concezione delle connessioni con perni si deve aver cura di contenere le azioni flettenti. La resistenza a flessione del perno è data da", [t("Nella concezione delle connessioni con perni si deve aver cura di contenere le azioni flettenti. La resistenza a flessione del perno è data da")]),
    formulaBlock("4.2.8.1.2", "4.2.77", p116, reg(180, 436, 190, 18)),
    textBlock("4.2.8.1.2", "p6", "paragraph", p116, reg(82.955, 455.738, 215, 7.48), "dove Wel è il modulo (resistente) elastico della sezione del perno.", [t("dove "), m("Wel", "W_{el}"), t(" è il modulo (resistente) elastico della sezione del perno.")]),
    textBlock("4.2.8.1.2", "p7", "paragraph", p116, reg(82.953, 469.24, 428.6, 44), "Qualora si preveda la sostituzione del perno durante la vita della costruzione, bisogna limitare le sollecitazioni di flessione e taglio sul perno e di compressione sul contorno dei fori. Per cui la forza di taglio ed il momento agenti sul perno in esercizio, Fb,Ed,ser e MEd,ser, devono essere limitate secondo le seguenti formule:", [t("Qualora si preveda la sostituzione del perno durante la vita della costruzione, bisogna limitare le sollecitazioni di flessione e taglio sul perno e di compressione sul contorno dei fori. Per cui la forza di taglio ed il momento agenti sul perno in esercizio, "), m("Fb,Ed,ser", "F_{b,Ed,ser}"), t(" e "), m("MEd,ser", "M_{Ed,ser}"), t(", devono essere limitate secondo le seguenti formule:")], "Qualora si preveda la sostituzione del perno durante la vita della costruzione, bisogna limitare le sollecitazioni di flessione e ta-\nglio sul perno e di compressione sul contorno dei fori. Per cui la forza di taglio ed il momento agenti sul perno in esercizio,\nFb,Ed,ser e MEd,ser, devono essere limitate secondo le seguenti formule:"),
    formulaBlock("4.2.8.1.2", "4.2.78", p116, reg(160, 498, 215, 18)),
    formulaBlock("4.2.8.1.2", "4.2.79", p116, reg(160, 512, 215, 18)),
    textBlock("4.2.8.1.2", "p8", "paragraph", p116, reg(82.952, 529.9, 428.6, 22), "Inoltre, affinché il perno possa essere sostituito, è necessario limitare le tensioni di contatto, σh,Ed, al valore limite, fh,Ed = 2,5 fy/γM6,ser. Le tensioni di contatto possono essere valutate con la formula seguente", [t("Inoltre, affinché il perno possa essere sostituito, è necessario limitare le tensioni di contatto, "), m("σh,Ed", "\\sigma_{h,Ed}"), t(", al valore limite, "), m("fh,Ed", "f_{h,Ed}"), t(" = 2,5 "), m("fy/γM6,ser", "f_y/\\gamma_{M6,ser}"), t(". Le tensioni di contatto possono essere valutate con la formula seguente")]),
    formulaBlock("4.2.8.1.2", "4.2.80", p116, reg(170, 550, 215, 35)),
    textBlock("4.2.8.1.2", "p9", "paragraph", p116, reg(82.946, 589.454, 428.6, 18), "dove con d0 si è indicato il diametro del foro di alloggiamento del perno, mentre FEd,ser è la forza di taglio che il perno trasferisce a servizio ed E è il modulo elastico dell’acciaio.", [t("dove con "), m("d0", "d_0"), t(" si è indicato il diametro del foro di alloggiamento del perno, mentre "), m("FEd,ser", "F_{Ed,ser}"), t(" è la forza di taglio che il perno trasferisce a servizio ed "), m("E", "E"), t(" è il modulo elastico dell’acciaio.")]),
  ], ["4.2.75", "4.2.76", "4.2.77", "4.2.78", "4.2.79", "4.2.80"]),
  unit("4.2.8.2", "UNIONI SALDATE", [
    textBlock("4.2.8.2", "heading", "heading", p116, reg(82.954, 622.951, 75, 7.476), "4.2.8.2 UNIONI SALDATE"),
    textBlock("4.2.8.2", "p1", "paragraph", p116, reg(82.954, 634.759, 428.6, 35), "Nel presente paragrafo sono considerate unioni saldate a piena penetrazione, a parziale penetrazione, ed unioni realizzate con cordoni d’angolo. Per i requisiti riguardanti i procedimenti di saldatura, i materiali d’apporto e i controlli idonei e necessari per la realizzazione di saldature dotate di prestazioni meccaniche adeguate ai livelli di sicurezza richiesti dalla presente norma, si faccia riferimento al § 11.3.4.5.", [], "Nel presente paragrafo sono considerate unioni saldate a piena penetrazione, a parziale penetrazione, ed unioni realizzate con\ncordoni d’angolo. Per i requisiti riguardanti i procedimenti di saldatura, i materiali d’apporto e i controlli idonei e necessari per la\nrealizzazione di saldature dotate di prestazioni meccaniche adeguate ai livelli di sicurezza richiesti dalla presente norma, si faccia\nriferimento al § 11.3.4.5."),
  ]),
  unit("4.2.8.2.1", "Unioni con saldature a piena penetrazione", [
    textBlock("4.2.8.2.1", "heading", "heading", p116, reg(82.954, 685.848, 175, 7.476), "4.2.8.2.1 Unioni con saldature a piena penetrazione"),
    textBlock("4.2.8.2.1", "p1", "paragraph", { ...p116, pageBreak: true }, reg(82.954, 698.454, 428.6, 17.6), "I collegamenti testa a testa, a T e a croce a piena penetrazione sono generalmente realizzati con materiali d’apporto aventi resistenza uguale o maggiore a quella degli elementi collegati. Pertanto la resistenza di progetto dei collegamenti a piena penetrazione si assume eguale alla resistenza di progetto del più debole tra gli elementi connessi. Una saldatura a piena penetrazione è caratterizzata dalla piena fusione del metallo di base attraverso tutto lo spessore dell’elemento da unire con il materiale di apporto.", [], "I collegamenti testa a testa, a T e a croce a piena penetrazione sono generalmente realizzati con materiali d’apporto aventi resi-\nstenza uguale o maggiore a quella degli elementi collegati. Pertanto la resistenza di progetto dei collegamenti a piena penetrazio-\nne si assume eguale alla resistenza di progetto del più debole tra gli elementi connessi. Una saldatura a piena penetrazione è ca-\nratterizzata dalla piena fusione del metallo di base attraverso tutto lo spessore dell’elemento da unire con il materiale di apporto."),
  ]),
  unit("4.2.8.2.2", "Unioni con saldature a parziale penetrazione", [
    textBlock("4.2.8.2.2", "heading", "heading", p117, reg(82.954, 129.884, 175, 7.476), "4.2.8.2.2 Unioni con saldature a parziale penetrazione"),
    textBlock("4.2.8.2.2", "p1", "paragraph", p117, reg(82.954, 142.49, 428.6, 27.6), "I collegamenti testa a testa, a T e a croce a parziale penetrazione vengono verificati con gli stessi criteri dei cordoni d’angolo (di cui al successivo § 4.2.8.2.4).", [], "I collegamenti testa a testa, a T e a croce a parziale penetrazione vengono verificati con gli stessi criteri dei cordoni d’angolo (di\ncui al successivo § 4.2.8.2.4)."),
    textBlock("4.2.8.2.2", "p2", "paragraph", p117, reg(82.954, 177.7, 428.6, 27.6), "L’altezza di gola dei cordoni d’angolo da utilizzare nelle verifiche è quella teorica, corrispondente alla preparazione adottata e specificata nei disegni di progetto, senza tenere conto della penetrazione e del sovrametallo di saldatura, in conformità con la norme UNI EN ISO 9692, parti 1, 2, 3 e 4.", [], "L’altezza di gola dei cordoni d’angolo da utilizzare nelle verifiche è quella teorica, corrispondente alla preparazione adottata e\nspecificata nei disegni di progetto, senza tenere conto della penetrazione e del sovrametallo di saldatura, in conformità con la\nnorme UNI EN ISO 9692, parti 1, 2, 3 e 4."),
  ]),
  unit("4.2.8.2.3", "Unioni con saldature a cordoni d’angolo", [
    textBlock("4.2.8.2.3", "heading", "heading", p117, reg(82.954, 206.144, 185, 7.476), "4.2.8.2.3 Unioni con saldature a cordoni d’angolo"),
    textBlock("4.2.8.2.3", "p1", "paragraph", p117, reg(82.954, 218.75, 428.6, 17.6), "La resistenza di progetto, per unità di lunghezza, dei cordoni d’angolo si determina con riferimento all’altezza di gola “a”, cioè all’altezza “a” del triangolo inscritto nella sezione trasversale del cordone stesso (Fig. 4.2.6).", [t("La resistenza di progetto, per unità di lunghezza, dei cordoni d’angolo si determina con riferimento all’altezza di gola “a”, cioè all’altezza “a” del triangolo inscritto nella sezione trasversale del cordone stesso (Fig. 4.2.6).")]),
    assetBlock("4.2.8.2.3", "figure-4-2-6", "figure-ref", gid("4.2.6"), p117, reg(75, 238, 330, 65)),
    textBlock("4.2.8.2.3", "p2", "paragraph", p117, reg(82.954, 308.61, 405.8, 7.48), "La lunghezza di calcolo L è quella intera del cordone, purché questo non abbia estremità palesemente mancanti o difettose.", [t("La lunghezza di calcolo "), m("L", "L"), t(" è quella intera del cordone, purché questo non abbia estremità palesemente mancanti o difettose.")]),
    textBlock("4.2.8.2.3", "p3", "paragraph", p117, reg(82.952, 321.22, 428.6, 18.5), "Eventuali tensioni σ// definite al paragrafo successivo agenti nella sezione trasversale del cordone, inteso come parte della sezione resistente della membratura, non devono essere prese in considerazione ai fini della verifica del cordone stesso.", [t("Eventuali tensioni "), m("σ//", "\\sigma_{\\parallel}"), t(" definite al paragrafo successivo agenti nella sezione trasversale del cordone, inteso come parte della sezione resistente della membratura, non devono essere prese in considerazione ai fini della verifica del cordone stesso.")]),
    textBlock("4.2.8.2.3", "p4", "paragraph", p117, reg(82.952, 344.789, 428.6, 27.6), "Per il calcolo della resistenza delle saldature con cordoni d’angolo, qualora si faccia riferimento ai modelli di calcolo presentati nel paragrafo seguente, si adottano i fattori parziali γM indicati in Tab. 4.2.XIV. È possibile utilizzare modelli contenuti in normative di comprovata validità, adottando fattori parziali γM che garantiscano i livelli di sicurezza stabiliti nelle presenti norme.", [t("Per il calcolo della resistenza delle saldature con cordoni d’angolo, qualora si faccia riferimento ai modelli di calcolo presentati nel paragrafo seguente, si adottano i fattori parziali "), m("γM", "\\gamma_M"), t(" indicati in Tab. 4.2.XIV. È possibile utilizzare modelli contenuti in normative di comprovata validità, adottando fattori parziali "), m("γM", "\\gamma_M"), t(" che garantiscano i livelli di sicurezza stabiliti nelle presenti norme.")]),
    textBlock("4.2.8.2.3", "p5", "paragraph", p117, reg(82.955, 379.38, 428.6, 17.6), "Ai fini della durabilità delle costruzioni, le saldature correnti a cordoni intermittenti, realizzati in modo non continuo lungo i lembi delle parti da unire, non sono ammesse in strutture non sicuramente protette contro la corrosione.", [], "Ai fini della durabilità delle costruzioni, le saldature correnti a cordoni intermittenti, realizzati in modo non continuo lungo i\nlembi delle parti da unire, non sono ammesse in strutture non sicuramente protette contro la corrosione."),
    textBlock("4.2.8.2.3", "p6", "paragraph", p117, reg(82.955, 402.007, 428.6, 17.6), "Per le verifiche occorre riferirsi alternativamente alla sezione di gola nella effettiva posizione o in posizione ribaltata, come indicato nel paragrafo successivo.", [], "Per le verifiche occorre riferirsi alternativamente alla sezione di gola nella effettiva posizione o in posizione ribaltata, come indi-\ncato nel paragrafo successivo."),
  ], [], [], ["4.2.6"]),
  unit("4.2.8.2.4", "Resistenza delle saldature a cordoni d’angolo", [
    textBlock("4.2.8.2.4", "heading", "heading", p117, reg(82.954, 432.964, 185, 7.476), "4.2.8.2.4 Resistenza delle saldature a cordoni d’angolo"),
    textBlock("4.2.8.2.4", "p1", "paragraph", p117, reg(82.954, 445.57, 428.6, 17.6), "Allo stato limite ultimo le azioni di progetto sui cordoni d’angolo si distribuiscono uniformemente sulla sezione di gola (definita al § 4.2.8.2.3)."),
    textBlock("4.2.8.2.4", "p2", "paragraph", p117, reg(82.954, 468.19, 428.6, 27.6), "Nel seguito si indicano con σ⊥ la tensione normale e con τ⊥ la tensione tangenziale perpendicolari all’asse del cordone d’angolo, agenti nella sezione di gola nella sua posizione effettiva, e con σ∥ la tensione normale e con τ∥ la tensione tangenziale parallele all’asse del cordone d’angolo. La tensione normale σ∥ non influenza la resistenza del cordone.", [t("Nel seguito si indicano con "), m("σ⊥", "\\sigma_{\\perp}"), t(" la tensione normale e con "), m("τ⊥", "\\tau_{\\perp}"), t(" la tensione tangenziale perpendicolari all’asse del cordone d’angolo, agenti nella sezione di gola nella sua posizione effettiva, e con "), m("σ∥", "\\sigma_{\\parallel}"), t(" la tensione normale e con "), m("τ∥", "\\tau_{\\parallel}"), t(" la tensione tangenziale parallele all’asse del cordone d’angolo. La tensione normale "), m("σ∥", "\\sigma_{\\parallel}"), t(" non influenza la resistenza del cordone.")]),
    assetBlock("4.2.8.2.4", "figure-4-2-7", "figure-ref", gid("4.2.7"), p117, reg(75, 505, 320, 100)),
    textBlock("4.2.8.2.4", "p3", "paragraph", p117, reg(82.954, 616.318, 428.6, 7.48), "Considerando la sezione di gola nella sua effettiva posizione, si può assumere la seguente condizione di resistenza"),
    formulaBlock("4.2.8.2.4", "4.2.81", p117, reg(120, 632, 245, 32)),
    textBlock("4.2.8.2.4", "p4", "paragraph", p117, reg(82.954, 665, 428.6, 27.6), "dove: ftk è la resistenza caratteristica a trazione ultima nominale della più debole delle parti collegate; β = 0,80 per acciaio S235; 0,85 per acciaio S275; 0,90 per acciaio S355; 1,00 per acciaio S420 e S460.", [t("dove: "), m("ftk", "f_{tk}"), t(" è la resistenza caratteristica a trazione ultima nominale della più debole delle parti collegate; "), m("β", "\\beta"), t(" = 0,80 per acciaio S235; 0,85 per acciaio S275; 0,90 per acciaio S355; 1,00 per acciaio S420 e S460.")]),
    textBlock("4.2.8.2.4", "p5", "paragraph", p117, reg(82.954, 699, 330, 7.48), "In alternativa, detta a l’altezza di gola, si può adottare cautelativamente il criterio semplificato", [t("In alternativa, detta "), m("a", "a"), t(" l’altezza di gola, si può adottare cautelativamente il criterio semplificato")]),
    formulaBlock("4.2.8.2.4", "4.2.82", p117, reg(160, 704, 210, 18)),
    textBlock("4.2.8.2.4", "p6", "paragraph", p118, reg(82.954, 85, 428.6, 28), "dove Fw,Ed è la forza di progetto che sollecita il cordone d’angolo per unità di lunghezza e Fw,Rd è la resistenza di progetto del cordone d’angolo per unità di lunghezza", [t("dove "), m("Fw,Ed", "F_{w,Ed}"), t(" è la forza di progetto che sollecita il cordone d’angolo per unità di lunghezza e "), m("Fw,Rd", "F_{w,Rd}"), t(" è la resistenza di progetto del cordone d’angolo per unità di lunghezza")]),
    formulaBlock("4.2.8.2.4", "4.2.83", p118, reg(155, 112, 220, 18)),
    textBlock("4.2.8.2.4", "p7", "paragraph", p118, reg(82.954, 137, 428.6, 18), "Considerando la sezione di gola in posizione ribaltata, si indicano con n⊥ e con t⊥ la tensione normale e la tensione tangenziale perpendicolari all’asse del cordone.", [t("Considerando la sezione di gola in posizione ribaltata, si indicano con "), m("n⊥", "n_{\\perp}"), t(" e con "), m("t⊥", "t_{\\perp}"), t(" la tensione normale e la tensione tangenziale perpendicolari all’asse del cordone.")]),
    textBlock("4.2.8.2.4", "p8", "paragraph", p118, reg(82.954, 160, 428.6, 17.6), "La verifica dei cordoni d’angolo si effettua controllando che siano soddisfatte simultaneamente le due condizioni"),
    formulaBlock("4.2.8.2.4", "4.2.84", p118, reg(155, 168, 220, 18)),
    formulaBlock("4.2.8.2.4", "4.2.85", p118, reg(155, 190, 220, 18)),
    textBlock("4.2.8.2.4", "p9", "paragraph", p118, reg(82.954, 212, 428.6, 25), "dove fyk è la tensione di snervamento caratteristica ed i coefficienti β1 e β2 sono dati, in funzione del grado di acciaio, in Tab. 4.2.XIX.", [t("dove "), m("fyk", "f_{yk}"), t(" è la tensione di snervamento caratteristica ed i coefficienti "), m("β1", "\\beta_1"), t(" e "), m("β2", "\\beta_2"), t(" sono dati, in funzione del grado di acciaio, in Tab. 4.2.XIX.")]),
    assetBlock("4.2.8.2.4", "table-4-2-xix", "table-ref", tid("4.2.xix"), p118, reg(82.954, 246.511, 330, 40)),
  ], ["4.2.81", "4.2.82", "4.2.83", "4.2.84", "4.2.85"], ["4.2.xix"], ["4.2.7"]),
  unit("4.2.8.3", "UNIONI SOGGETTE A CARICHI DA FATICA", [
    textBlock("4.2.8.3", "heading", "heading", p118, reg(82.954, 297.994, 200, 7.476), "4.2.8.3 UNIONI SOGGETTE A CARICHI DA FATICA"),
    textBlock("4.2.8.3", "p1", "paragraph", p118, reg(82.954, 309.75, 428.6, 18), "La resistenza a fatica relativa ai vari dettagli dei collegamenti bullonati e saldati, con le relative curve S-N, può essere reperita in UNI EN 1993-1-9.", [], "La resistenza a fatica relativa ai vari dettagli dei collegamenti bullonati e saldati, con le relative curve S-N, può essere reperita in\nUNI EN 1993-1-9."),
    textBlock("4.2.8.3", "p2", "paragraph", p118, reg(82.954, 332.43, 428.6, 17.6), "In ogni caso si adottano i coefficienti parziali indicati in Tab. 4.2.XI. In alternativa si possono utilizzare modelli contenuti in normative di comprovata validità, adottando fattori parziali γM che garantiscano i livelli di sicurezza stabiliti nelle presenti norme.", [t("In ogni caso si adottano i coefficienti parziali indicati in Tab. 4.2.XI. In alternativa si possono utilizzare modelli contenuti in normative di comprovata validità, adottando fattori parziali "), m("γM", "\\gamma_M"), t(" che garantiscano i livelli di sicurezza stabiliti nelle presenti norme.")], "In ogni caso si adottano i coefficienti parziali indicati in Tab. 4.2.XI. In alternativa si possono utilizzare modelli contenuti in nor-\nmative di comprovata validità, adottando fattori parziali γM che garantiscano i livelli di sicurezza stabiliti nelle presenti norme."),
  ]),
  unit("4.2.8.4", "UNIONI SOGGETTE A VIBRAZIONI, URTI E/O INVERSIONI DI CARICO", [
    textBlock("4.2.8.4", "heading", "heading", p118, reg(82.954, 352, 360, 7.476), "4.2.8.4 UNIONI SOGGETTE A VIBRAZIONI, URTI E/O INVERSIONI DI CARICO"),
    textBlock("4.2.8.4", "p1", "paragraph", p118, reg(82.954, 365, 428.6, 18), "Nei collegamenti soggetti a taglio e dinamicamente sollecitati, a causa di vibrazioni indotte da macchinari oppure a causa di improvvise variazioni delle sollecitazioni dovute a urti o altre azioni dinamiche, devono adottarsi apposite soluzioni tecniche che impediscano efficacemente lo scorrimento.", [], "Nei collegamenti soggetti a taglio e dinamicamente sollecitati, a causa di vibrazioni indotte da macchinari oppure a causa di im-\nprovvise variazioni delle sollecitazioni dovute a urti o altre azioni dinamiche, devono adottarsi apposite soluzioni tecniche che\nimpediscano efficacemente lo scorrimento."),
    textBlock("4.2.8.4", "p2", "paragraph", p118, reg(82.954, 400, 428.6, 18), "A tal proposito si consiglia l’utilizzo di giunzioni saldate, oppure, nel caso di unioni bullonate, l’utilizzo di dispositivi antisvitamento, bulloni precaricati, bulloni in fori calibrati o altri tipi di bulloni idonei a limitare o eliminare lo scorrimento.", [], "A tal proposito si consiglia l’utilizzo di giunzioni saldate, oppure, nel caso di unioni bullonate, l’utilizzo di dispositivi anti-\nsvitamento, bulloni precaricati, bulloni in fori calibrati o altri tipi di bulloni idonei a limitare o eliminare lo scorrimento."),
  ]),
  unit("4.2.9", "REQUISITI PER LA PROGETTAZIONE E L’ESECUZIONE", [
    textBlock("4.2.9", "heading", "heading", p118, reg(82.954, 444.424, 300, 7.476), "4.2.9. REQUISITI PER LA PROGETTAZIONE E L’ESECUZIONE"),
    textBlock("4.2.9", "p1", "paragraph", p118, reg(82.954, 456, 428.6, 17.6), "L’esecuzione delle strutture in acciaio deve essere conforme alla UNI EN 1090-2:2011, per quanto non in contrasto con le presenti norme."),
  ]),
  unit("4.2.9.1", "SPESSORI LIMITE", [
    textBlock("4.2.9.1", "heading", "heading", p118, reg(82.954, 488.984, 180, 7.476), "4.2.9.1 SPESSORI LIMITE"),
    textBlock("4.2.9.1", "p1", "paragraph", p118, reg(82.954, 501, 428.6, 7.48), "È vietato l’uso di profilati con spessore t < 4 mm.", [t("È vietato l’uso di profilati con spessore "), m("t", "t"), t(" < 4 mm.")]),
    textBlock("4.2.9.1", "p2", "paragraph", p118, reg(82.954, 514, 428.6, 27.6), "Una deroga a tale norma, fino ad uno spessore t = 3 mm, è consentita per opere sicuramente protette contro la corrosione, quali per esempio tubi chiusi alle estremità e profili zincati, od opere non esposte agli agenti atmosferici.", [t("Una deroga a tale norma, fino ad uno spessore "), m("t", "t"), t(" = 3 mm, è consentita per opere sicuramente protette contro la corrosione, quali per esempio tubi chiusi alle estremità e profili zincati, od opere non esposte agli agenti atmosferici.")]),
    textBlock("4.2.9.1", "p3", "paragraph", p118, reg(82.954, 548, 428.6, 7.48), "Le limitazioni di cui sopra non riguardano elementi e profili sagomati a freddo."),
  ]),
  unit("4.2.9.2", "ACCIAIO INCRUDITO", [
    textBlock("4.2.9.2", "heading", "heading", p118, reg(82.954, 558.508, 190, 7.476), "4.2.9.2 ACCIAIO INCRUDITO"),
    textBlock("4.2.9.2", "p1", "paragraph", p118, reg(82.954, 571, 428.6, 27.6), "Deve essere giustificato mediante specifica valutazione l’impiego di acciaio incrudito in ogni caso in cui si preveda la plasticizzazione del materiale (analisi plastica, azioni sismiche o eccezionali, ecc.) o prevalgano i fenomeni di fatica.", [], "Deve essere giustificato mediante specifica valutazione l’impiego di acciaio incrudito in ogni caso in cui si preveda la plasticizza-\nzione del materiale (analisi plastica, azioni sismiche o eccezionali, ecc.) o prevalgano i fenomeni di fatica."),
  ]),
  unit("4.2.9.3", "GIUNTI DI TIPO MISTO", [
    textBlock("4.2.9.3", "heading", "heading", p118, reg(82.954, 602.865, 200, 7.476), "4.2.9.3 GIUNTI DI TIPO MISTO"),
    textBlock("4.2.9.3", "p1", "paragraph", p118, reg(82.954, 615, 428.6, 27.6), "In uno stesso giunto è vietato l’impiego di differenti metodi di collegamento di forza (ad esempio saldatura e bullonatura), a meno che uno solo di essi sia in grado di sopportare l’intero sforzo, oppure sia dimostrato, per via sperimentale o teorica, che la disposizione costruttiva è esente dal pericolo di collasso prematuro a catena.", [], "In uno stesso giunto è vietato l’impiego di differenti metodi di collegamento di forza (ad esempio saldatura e bullonatura), a me-\nno che uno solo di essi sia in grado di sopportare l’intero sforzo, oppure sia dimostrato, per via sperimentale o teorica, che la di-\nsposizione costruttiva è esente dal pericolo di collasso prematuro a catena."),
  ]),
  unit("4.2.9.4", "PROBLEMATICHE SPECIFICHE", [
    textBlock("4.2.9.4", "heading", "heading", p118, reg(82.954, 657.34, 230, 7.476), "4.2.9.4 PROBLEMATICHE SPECIFICHE"),
    textBlock("4.2.9.4", "intro", "paragraph", p118, reg(82.954, 670, 300, 7.48), "Per tutto quanto non trattato nelle presenti norme, in relazione a:"),
    textBlock("4.2.9.4", "item-1", "list-item", p118, reg(82.954, 684, 250, 7.48), "– Preparazione del materiale"),
    textBlock("4.2.9.4", "item-2", "list-item", p118, reg(82.954, 697, 428.6, 7.48), "– Tolleranze degli elementi strutturali di fabbricazione e di montaggio"),
    textBlock("4.2.9.4", "item-3", "list-item", p118, reg(82.954, 710, 180, 7.48), "– Impiego dei ferri piatti"),
    textBlock("4.2.9.4", "item-4", "list-item", p118, reg(82.954, 723, 180, 7.48), "– Variazioni di sezione"),
    textBlock("4.2.9.4", "item-5", "list-item", p119, reg(82.954, 100, 140, 7.48), "– Intersezioni"),
    textBlock("4.2.9.4", "item-6", "list-item", p119, reg(82.954, 113, 300, 7.48), "– Collegamenti a taglio con bulloni normali e chiodi"),
    textBlock("4.2.9.4", "item-7", "list-item", p119, reg(82.954, 126, 428.6, 7.48), "– Tolleranze foro-bullone. Interassi dei bulloni e dei chiodi. Distanze dai margini"),
    textBlock("4.2.9.4", "item-8", "list-item", p119, reg(82.954, 139, 330, 7.48), "– Collegamenti ad attrito con bulloni ad alta resistenza"),
    textBlock("4.2.9.4", "item-9", "list-item", p119, reg(82.954, 152, 200, 7.48), "– Collegamenti saldati"),
    textBlock("4.2.9.4", "item-10", "list-item", p119, reg(82.954, 165, 220, 7.48), "– Collegamenti per contatto"),
    textBlock("4.2.9.4", "closing", "paragraph", p119, reg(82.954, 178, 390, 7.48), "si può far riferimento a normative di comprovata validità."),
  ]),
  unit("4.2.9.5", "APPARECCHI DI APPOGGIO", [
    textBlock("4.2.9.5", "heading", "heading", p119, reg(82.954, 196.874, 190, 7.476), "4.2.9.5 APPARECCHI DI APPOGGIO"),
    textBlock("4.2.9.5", "p1", "paragraph", p119, reg(82.954, 209, 428.6, 17.6), "La concezione strutturale deve prevedere facilità di sostituzione degli apparecchi di appoggio, nel caso in cui questi abbiano vita nominale più breve di quella della costruzione alla quale sono connessi.", [], "La concezione strutturale deve prevedere facilità di sostituzione degli apparecchi di appoggio, nel caso in cui questi abbiano vita\nnominale più breve di quella della costruzione alla quale sono connessi."),
  ]),
  unit("4.2.9.6", "VERNICIATURA E ZINCATURA", [
    textBlock("4.2.9.6", "heading", "heading", p119, reg(82.954, 241.274, 220, 7.476), "4.2.9.6 VERNICIATURA E ZINCATURA"),
    textBlock("4.2.9.6", "p1", "paragraph", p119, reg(82.954, 253, 428.6, 27.6), "Gli elementi delle strutture in acciaio, a meno che siano di comprovata resistenza alla corrosione, devono essere adeguatamente protetti mediante verniciatura o zincatura, tenendo conto del tipo di acciaio, della sua posizione nella struttura e dell’ambiente nel quale è collocato. Devono essere particolarmente protetti i collegamenti bullonati (precaricati e non precaricati), in modo da impedire qualsiasi infiltrazione all’interno del collegamento.", [], "Gli elementi delle strutture in acciaio, a meno che siano di comprovata resistenza alla corrosione, devono essere adeguatamente\nprotetti mediante verniciatura o zincatura, tenendo conto del tipo di acciaio, della sua posizione nella struttura e dell’ambiente\nnel quale è collocato. Devono essere particolarmente protetti i collegamenti bullonati (precaricati e non precaricati), in modo da\nimpedire qualsiasi infiltrazione all’interno del collegamento."),
    textBlock("4.2.9.6", "p2", "paragraph", p119, reg(82.954, 297, 428.6, 17.6), "Anche per gli acciai con resistenza alla corrosione migliorata (per i quali può farsi utile riferimento alla norma UNI EN 10025-5) devono prevedersi, ove necessario, protezioni mediante verniciatura.", [], "Anche per gli acciai con resistenza alla corrosione migliorata (per i quali può farsi utile riferimento alla norma UNI EN 10025-5)\ndevono prevedersi, ove necessario, protezioni mediante verniciatura."),
    textBlock("4.2.9.6", "p3", "paragraph", p119, reg(82.954, 321, 428.6, 17.6), "Nel caso di parti inaccessibili, o profili a sezione chiusa non ermeticamente chiusi alle estremità, dovranno prevedersi adeguati sovraspessori."),
    textBlock("4.2.9.6", "p4", "paragraph", p119, reg(82.954, 345, 428.6, 17.6), "Gli elementi destinati ad essere incorporati in getti di calcestruzzo non devono essere verniciati: possono essere invece zincati a caldo.", [], "Gli elementi destinati ad essere incorporati in getti di calcestruzzo non devono essere verniciati: possono essere invece zincati a\ncaldo."),
  ]),
  unit("4.2.10", "CRITERI DI DURABILITÀ", [
    textBlock("4.2.10", "heading", "heading", p119, reg(82.954, 375.144, 240, 7.476), "4.2.10. CRITERI DI DURABILITÀ"),
    textBlock("4.2.10", "p1", "paragraph", p119, reg(82.954, 388, 428.6, 17.6), "La durabilità deve assicurare il mantenimento nel tempo della geometria e delle caratteristiche dei materiali della struttura, affinché questa conservi inalterate funzionalità, aspetto estetico e resistenza.", [], "La durabilità deve assicurare il mantenimento nel tempo della geometria e delle caratteristiche dei materiali della struttura, affin-\nché questa conservi inalterate funzionalità, aspetto estetico e resistenza."),
    textBlock("4.2.10", "p2", "paragraph", p119, reg(82.954, 412, 428.6, 27.6), "Al fine di garantire tale persistenza in fase di progetto devono essere presi in esame i dettagli costruttivi, la eventuale necessità di adottare sovraspessori, le misure protettive e deve essere definito un piano di manutenzione (ispezioni, operazioni manutentive e programma di attuazione delle stesse).", [], "Al fine di garantire tale persistenza in fase di progetto devono essere presi in esame i dettagli costruttivi, la eventuale necessità di\nadottare sovraspessori, le misure protettive e deve essere definito un piano di manutenzione (ispezioni, operazioni manutentive e\nprogramma di attuazione delle stesse)."),
  ]),
  unit("4.2.11", "RESISTENZA AL FUOCO", [
    textBlock("4.2.11", "heading", "heading", p119, reg(82.954, 453.794, 230, 7.476), "4.2.11. RESISTENZA AL FUOCO"),
    textBlock("4.2.11", "p1", "paragraph", p119, reg(82.954, 466, 428.6, 17.6), "Le verifiche di resistenza al fuoco potranno eseguirsi con riferimento a UNI EN 1993-1-2, utilizzando i coefficienti γM (§ 4.2.6) relativi alle combinazioni eccezionali.", [t("Le verifiche di resistenza al fuoco potranno eseguirsi con riferimento a UNI EN 1993-1-2, utilizzando i coefficienti "), m("γM", "\\gamma_M"), t(" (§ 4.2.6) relativi alle combinazioni eccezionali.")]),
  ]),
];

const formulaRows = [
  ["4.2.63", "4.2.8.1.1", 115, "F_{v,Rd}=0{,}6\\,f_{tbk}A_{res}/\\gamma_{M2}"],
  ["4.2.64", "4.2.8.1.1", 115, "F_{v,Rd}=0{,}5\\,f_{tbk}A_{res}/\\gamma_{M2}"],
  ["4.2.65", "4.2.8.1.1", 115, "F_{v,Rd}=0{,}6\\,f_{trk}A_0/\\gamma_{M2}"],
  ["4.2.66", "4.2.8.1.1", 115, "F_{v,Rd}=0{,}6\\,f_{tbk}A/\\gamma_{M2}"],
  ["4.2.67", "4.2.8.1.1", 115, "F_{b,Rd}=k\\,\\alpha\\,f_{tk}d t/\\gamma_{M2}"],
  ["4.2.68", "4.2.8.1.1", 115, "F_{t,Rd}=0{,}9\\,f_{tbk}A_{res}/\\gamma_{M2}"],
  ["4.2.69", "4.2.8.1.1", 115, "F_{t,Rd}=0{,}6\\,f_{trk}A_{res}/\\gamma_{M2}"],
  ["4.2.70", "4.2.8.1.1", 115, "B_{p,Rd}=0{,}6\\,\\pi d_m t_p f_{tk}/\\gamma_{M2}"],
  ["4.2.71", "4.2.8.1.1", 115, "\\frac{F_{v,Ed}}{F_{v,Rd}}+\\frac{F_{t,Ed}}{1{,}4F_{t,Rd}}\\le 1"],
  ["4.2.72", "4.2.8.1.1", 115, "F_{s,Rd}=n\\,\\mu\\,F_{p,Cd}/\\gamma_{M3}"],
  ["4.2.73", "4.2.8.1.1", 116, "F_{s,Rd}=n\\,\\mu\\left(F_{p,Cd}-0{,}8F_{t,Ed}\\right)/\\gamma_{M3}"],
  ["4.2.74", "4.2.8.1.1", 116, "F_{s,Rd,eser}=n\\,\\mu\\left(F_{p,Cd}-0{,}8F_{t,Ed,eser}\\right)/\\gamma_{M3}"],
  ["4.2.75", "4.2.8.1.2", 116, "F_{v,Rd}=0{,}6\\,f_{upk}A/\\gamma_{M2}"],
  ["4.2.76", "4.2.8.1.2", 116, "F_{b,Rd}=1{,}5 t d f_y/\\gamma_{M0}"],
  ["4.2.77", "4.2.8.1.2", 116, "M_{Rd}=1{,}5 W_{el}f_{ypk}/\\gamma_{M0}"],
  ["4.2.78", "4.2.8.1.2", 116, "F_{b,Rd,ser}=0{,}6 t d f_y/\\gamma_{M6,ser}>F_{b,Ed,ser}"],
  ["4.2.79", "4.2.8.1.2", 116, "M_{Rd,ser}=0{,}8 W_{el}f_{ypk}/\\gamma_{M6,ser}>M_{Ed,ser}"],
  ["4.2.80", "4.2.8.1.2", 116, "\\sigma_{h,Ed}=0{,}591\\sqrt{\\frac{E\\,F_{Ed,ser}(d_0-d)}{d^2 t}}"],
  ["4.2.81", "4.2.8.2.4", 117, "\\left[\\sigma_{\\perp}^{2}+3\\left(\\tau_{\\perp}^{2}+\\tau_{\\parallel}^{2}\\right)\\right]^{0{,}5}\\le\\frac{f_{tk}}{\\beta\\gamma_{M2}}\\quad;\\quad\\sigma_{\\perp}\\le0{,}9\\frac{f_{tk}}{\\gamma_{M2}}"],
  ["4.2.82", "4.2.8.2.4", 117, "F_{w,Ed}/F_{w,Rd}\\le1"],
  ["4.2.83", "4.2.8.2.4", 118, "F_{w,Rd}=\\frac{a f_{tk}}{\\sqrt{3}\\,\\beta\\gamma_{M2}}"],
  ["4.2.84", "4.2.8.2.4", 118, "\\sqrt{n_{\\perp}^{2}+t_{\\perp}^{2}+t_{\\parallel}^{2}}\\le\\beta_1 f_{yk}"],
  ["4.2.85", "4.2.8.2.4", 118, "|n_{\\perp}|+|t_{\\perp}|\\le\\beta_2 f_{yk}"],
] as const;

const table = {
  id: tid("4.2.xix"),
  unitId: uid("4.2.8.2.4"),
  officialNumber: "4.2.XIX",
  pdfPage: 118,
  caption: "Tab. 4.2.XIX - Valori dei coefficienti β1 e β2",
  columnCount: 4,
  headers: [[{ text: "" }, { text: "S235" }, { text: "S275 - S355" }, { text: "S420 - S460" }]],
  rows: [
    [{ text: "β1", latex: "\\beta_1" }, { text: "0,85" }, { text: "0,70" }, { text: "0,62" }],
    [{ text: "β2", latex: "\\beta_2" }, { text: "1,0" }, { text: "0,85" }, { text: "0,75" }],
  ],
  notes: [],
};

const figures = [
  { id: gid("4.2.6"), unitId: uid("4.2.8.2.3"), officialNumber: "4.2.6", pdfPage: 117, caption: "Fig. 4.2.6 -Definizione dell’area di gola per le saldature a cordone d’angolo", alt: "Definizione dell’area di gola per le saldature a cordone d’angolo.", imagePath: "figures/ntc2018/fig4.2.6.png", region: reg(75, 238, 330, 65), sha256: "a5fa5de86131b29078e9e35fc50aa202de1a9f73af95f9949d7fe551ce33a252" },
  { id: gid("4.2.7"), unitId: uid("4.2.8.2.4"), officialNumber: "4.2.7", pdfPage: 117, caption: "Figura 4.2.7", alt: "Sezione di gola di un cordone d’angolo nella posizione effettiva e nella posizione ribaltata.", imagePath: "figures/ntc2018/fig4.2.7.png", region: reg(75, 505, 320, 100), sha256: "caa21ae3f40e8cc78e6c541c8c2382c7322fcbc48f5f3570759251ed9fae84e9" },
];

const existingPath = join(unitDir, "4.2.8.1.1.json");
const existing = JSON.parse(await readFile(existingPath, "utf8")) as { blocks: Array<{ blockId: string }>; assets: { formulaIds: string[]; tableIds: string[]; figureIds: string[] } };
const continuationById = new Map(continuationBlocks.map((block) => [block.blockId, block]));
const existingIds = new Set(existing.blocks.map((block) => block.blockId));
existing.blocks = existing.blocks.map((block) => continuationById.get(block.blockId) ?? block);
existing.blocks.push(...continuationBlocks.filter((block) => !existingIds.has(block.blockId)));
existing.assets.formulaIds = [...new Set([...existing.assets.formulaIds, ...formulaRows.filter(([, unitId]) => unitId === "4.2.8.1.1").map(([number]) => fid(number))])];

const manifest = {
  $schema: "urn:structural-codes:schema:asset-manifest:v2",
  schemaVersion: "2.0.0-alpha.1",
  recordType: "asset-manifest",
  document: "ntc2018",
  section: "4.2-step6",
  sourceId,
  status: "transcribed-unreviewed",
  formulas: formulaRows.map(([number, unitId, pdfPage, latex]) => ({ id: fid(number), unitId: uid(unitId), officialNumber: number, pdfPage, latex })),
  tables: [table],
  figures,
};

await mkdir(unitDir, { recursive: true });
await mkdir(assetDir, { recursive: true });
await writeFile(existingPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
await Promise.all(units.map((record) => writeFile(join(unitDir, record.numbering.official + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8")));
await writeFile(join(assetDir, "4.2-step6.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log("NTC 4.2 step6: aggiornato 4.2.8.1.1, generate " + units.length + " unità, " + formulaRows.length + " formule, 1 tabella e 2 figure.");
