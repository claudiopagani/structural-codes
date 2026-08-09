/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ44-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";
const sourceDir = join(root, "evidence", sourceId, "pages");
const unitDir = join(root, "corpus", "units", "circ2019");
const assetDir = join(root, "corpus", "assets", "circ2019");
const figurePath = join(root, "corpus", "assets", "figures", "circ2019", "figc4.4.1.png");

type Part = { page: number; from: number; to?: number };
type BlockKind = "heading" | "paragraph" | "list-item" | "formula-ref" | "figure-ref";
type BlockSpec = {
    kind: BlockKind;
    parts: Part[];
    text?: string;
    assetId?: string;
    officialNumber?: string | null;
};
type UnitSpec = { number: string; title: string; blocks: BlockSpec[] };

const pageLines = new Map<number, string[]>();
for (let page = 155; page <= 163; page += 1) {
    const filename = join(sourceDir, "page-" + String(page).padStart(4, "0") + ".raw.txt");
    pageLines.set(page, (await readFile(filename, "utf8")).replace(/\r\n/gu, "\n").split("\n"));
}

const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const uid = (number: string): string => "urn:structural-codes:it:unit:circ2019:" + number.toLowerCase();
const formulaId = (number: string): string => "urn:structural-codes:it:asset:formula:circ2019:" + number.toLowerCase();
const figureId = (number: string): string => "urn:structural-codes:it:asset:figure:circ2019:" + number.toLowerCase();

function raw(parts: Part[]): string {
    return parts.map(({ page, from, to = from }) => {
        const lines = pageLines.get(page);
        if (!lines) throw new Error("Evidence mancante per pagina " + page);
        return lines.slice(from - 1, to).join("\n");
    }).join("\n");
}

function normalizeRaw(source: string, kind: BlockKind): string {
    let value = source.replace(/\r\n/gu, "\n");
    value = value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ");
    value = value.replace(/\s+/gu, " ").trim();
    if (kind === "list-item") value = value.replace(/^[\s•▪●]+/u, "").trim();
    return value;
}

function transformations(source: string, normalized: string): any[] {
    if (source === normalized) return [];
    const result: any[] = [];
    if (/\n/u.test(source)) {
        result.push({
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale.",
        });
    }
    if (/[\u0000-\u001f\u007f-\u009f]/u.test(source)) {
        result.push({
            operation: "remove-control-character",
            ruleVersion: profile,
            note: "Rimossi i caratteri di controllo privi di resa visuale dal layer testuale.",
        });
    }
    result.push({
        operation: "manual-correction",
        ruleVersion: profile,
        note: "Ripristinati accenti, sillabazioni, glifi e notazione matematica confrontati con il render ufficiale.",
    });
    result.push({
        operation: "normalize-whitespace",
        ruleVersion: profile,
        note: "Uniformati gli spazi dopo la ricomposizione delle righe.",
    });
    return result;
}

function blockEvidence(parts: Part[], normalized: string, manual: boolean, asset = false): any {
    const source = raw(parts);
    const page = parts[0]?.page ?? 155;
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region: null,
        extraction: {
            method: manual || asset ? "manual-transcription" : "pdf-text",
            tool: manual || asset ? "codex-render-transcription" : "pdfjs-dist",
            toolVersion: manual || asset ? profile : "4.10.38",
        },
        transformations: manual || asset ? [{
            operation: "manual-correction",
            ruleVersion: profile,
            note: asset
                ? "Asset in display verificato sul render ufficiale; revisione umana indipendente ancora obbligatoria."
                : "Testo confrontato con il render ufficiale; revisione umana indipendente ancora obbligatoria.",
        }] : transformations(source, normalized),
        rawSha256: sha256(source),
        normalizedSha256: sha256(normalized),
    };
}

const h = (page: number, from: number, text: string): BlockSpec => ({
    kind: "heading",
    parts: [{ page, from }],
    text,
});
const p = (parts: Part[], text?: string): BlockSpec => ({
    kind: "paragraph",
    parts,
    ...(text ? { text } : {}),
});
const li = (parts: Part[], text?: string): BlockSpec => ({
    kind: "list-item",
    parts,
    ...(text ? { text } : {}),
});
const fr = (parts: Part[], officialNumber: string): BlockSpec => ({
    kind: "formula-ref",
    parts,
    assetId: formulaId(officialNumber),
    officialNumber,
});
const fig = (parts: Part[], officialNumber: string): BlockSpec => ({
    kind: "figure-ref",
    parts,
    assetId: figureId(officialNumber),
    officialNumber,
});

const units: UnitSpec[] = [
    {
        number: "C4.4",
        title: "COSTRUZIONI DI LEGNO",
        blocks: [
            h(155, 3, "C4.4 COSTRUZIONI DI LEGNO"),
            p([{ page: 155, from: 4, to: 8 }]),
            p([{ page: 155, from: 9, to: 12 }]),
        ],
    },
    {
        number: "C4.4.1",
        title: "VALUTAZIONE DELLA SICUREZZA",
        blocks: [
            h(155, 13, "C4.4.1 VALUTAZIONE DELLA SICUREZZA"),
            p([{ page: 155, from: 14, to: 15 }]),
            p([{ page: 155, from: 16, to: 19 }]),
            p([{ page: 155, from: 20, to: 22 }]),
            p([{ page: 155, from: 23, to: 26 }]),
            p([{ page: 155, from: 27, to: 28 }]),
        ],
    },
    {
        number: "C4.4.2",
        title: "ANALISI STRUTTURALE",
        blocks: [
            h(155, 29, "C4.4.2 ANALISI STRUTTURALE"),
            p([{ page: 155, from: 30, to: 32 }]),
            p([{ page: 155, from: 33, to: 35 }]),
            p([{ page: 155, from: 36, to: 38 }]),
            p([{ page: 155, from: 39, to: 41 }]),
            p([{ page: 155, from: 42, to: 43 }]),
            p([{ page: 155, from: 44, to: 45 }]),
            p([{ page: 155, from: 46, to: 51 }]),
        ],
    },
    {
        number: "C4.4.3",
        title: "AZIONI E LORO COMBINAZIONI",
        blocks: [
            h(155, 52, "C4.4.3 AZIONI E LORO COMBINAZIONI"),
            p([{ page: 155, from: 53, to: 54 }, { page: 156, from: 3, to: 5 }]),
        ],
    },
    {
        number: "C4.4.4",
        title: "CLASSI DI DURATA DEL CARICO",
        blocks: [
            h(156, 6, "C4.4.4 CLASSI DI DURATA DEL CARICO"),
            p([{ page: 156, from: 7, to: 9 }]),
            p([{ page: 156, from: 10, to: 13 }], "Il carico provocato dalla neve, valutato secondo il § 3.4 delle NTC per uno specifico sito ad una certa altitudine di riferimento a_s, deve essere considerato almeno di media durata per altitudini a_s superiori a 1000 m; per altitudini inferiori la classe di durata dovrà essere scelta in funzione delle caratteristiche del sito, e comunque almeno di breve durata."),
        ],
    },
    {
        number: "C4.4.5",
        title: "CLASSI DI SERVIZIO",
        blocks: [
            h(156, 14, "C4.4.5 CLASSI DI SERVIZIO"),
            p([{ page: 156, from: 15, to: 16 }]),
            p([{ page: 156, from: 17, to: 17 }]),
            li([{ page: 156, from: 18, to: 18 }]),
            li([{ page: 156, from: 19, to: 20 }]),
            li([{ page: 156, from: 21, to: 21 }]),
            p([{ page: 156, from: 22, to: 24 }]),
        ],
    },
    {
        number: "C4.4.6",
        title: "RESISTENZA DI PROGETTO",
        blocks: [
            h(156, 25, "C4.4.6 RESISTENZA DI PROGETTO"),
            p([{ page: 156, from: 26, to: 29 }]),
        ],
    },
    {
        number: "C4.4.7",
        title: "STATI LIMITE DI ESERCIZIO",
        blocks: [
            h(156, 30, "C4.4.7 STATI LIMITE DI ESERCIZIO"),
            p([{ page: 156, from: 31, to: 33 }], "Considerando il particolare comportamento reologico del legno e dei materiali derivati dal legno, si devono valutare sia la deformazione istantanea uinst sia la deformazione finale ufin."),
            p([{ page: 156, from: 34, to: 36 }], "La deformazione istantanea, uinst, deve essere calcolata sotto la combinazione caratteristica (o rara) di azioni di cui al § 2.5.3 delle NTC, utilizzando il valore medio dei moduli di elasticità normale e tangenziale del materiale per le membrature, ed il valore istantaneo del modulo di scorrimento Kser per le unioni."),
            p([{ page: 156, from: 37, to: 37 }]),
            fr([{ page: 156, from: 38, to: 38 }], "C4.4.1"),
            p([{ page: 156, from: 39, to: 39 }]),
            li([{ page: 156, from: 40, to: 40 }], "ufin è la deformazione finale data dalla somma della deformazione istantanea e della deformazione differita;"),
            li([{ page: 156, from: 41, to: 41 }], "uinst è la deformazione istantanea;"),
            li([{ page: 156, from: 42, to: 42 }], "udif è la deformazione differita."),
            p([{ page: 156, from: 43, to: 44 }], "La freccia netta, unet, per un elemento inflesso, riferita alla corda congiungente i punti della trave in corrispondenza degli appoggi, è data da:"),
            fr([{ page: 156, from: 45, to: 45 }], "C4.4.2"),
            p([{ page: 156, from: 46, to: 46 }]),
            li([{ page: 156, from: 47, to: 47 }], "u0 è la controfreccia iniziale (qualora presente);"),
            li([{ page: 156, from: 48, to: 48 }], "u1 è la freccia dovuta ai soli carichi permanenti;"),
            li([{ page: 156, from: 49, to: 49 }], "u2 è la freccia dovuta ai soli carichi variabili."),
            fig([{ page: 157, from: 3, to: 3 }], "C4.4.1"),
            p([{ page: 157, from: 4, to: 5 }], "Nel caso di strutture costituite da elementi o componenti aventi lo stesso comportamento viscoelastico, in via semplificata, la deformazione totale finale utot,fin relativa ad una certa condizione di carico, si può quindi valutare come segue:"),
            fr([{ page: 157, from: 6, to: 10 }], "C4.4.3"),
            p([{ page: 157, from: 11, to: 11 }]),
            li([{ page: 157, from: 12, to: 12 }], "u1,inst: è la deformazione istantanea del carico permanente;"),
            li([{ page: 157, from: 13, to: 13 }], "u21,inst: è la deformazione istantanea del carico variabile prevalente;"),
            li([{ page: 157, from: 14, to: 14 }], "u2i,inst: è la deformazione istantanea dell’i-esimo carico variabile della combinazione considerata."),
            p([{ page: 157, from: 15, to: 17 }]),
            p([{ page: 157, from: 18, to: 21 }]),
            p([{ page: 157, from: 22, to: 24 }]),
            p([{ page: 157, from: 25, to: 27 }]),
            p([{ page: 157, from: 28, to: 30 }], "La deformazione a lungo termine può essere calcolata utilizzando i valori medi dei moduli elastici ridotti opportunamente mediante il fattore 1/(1+kdef) per le membrature e utilizzando un valore ridotto con lo stesso fattore del modulo di scorrimento dei collegamenti."),
            p([{ page: 157, from: 31, to: 32 }]),
            p([{ page: 157, from: 33, to: 37 }]),
            p([{ page: 157, from: 38, to: 41 }]),
            p([{ page: 157, from: 42, to: 44 }]),
            p([{ page: 157, from: 45, to: 46 }]),
        ],
    },
    {
        number: "C4.4.8",
        title: "STATI LIMITE ULTIMI",
        blocks: [h(157, 47, "C4.4.8 STATI LIMITE ULTIMI")],
    },
    {
        number: "C4.4.8.1",
        title: "VERIFICHE DI RESISTENZA",
        blocks: [h(157, 48, "C4.4.8.1 VERIFICHE DI RESISTENZA")],
    },
    {
        number: "C4.4.8.1.1",
        title: "Trazione parallela alla fibratura",
        blocks: [
            h(157, 49, "C4.4.8.1.1 Trazione parallela alla fibratura"),
            p([{ page: 157, from: 50, to: 51 }, { page: 158, from: 3, to: 5 }]),
        ],
    },
    {
        number: "C4.4.8.1.2",
        title: "Trazione perpendicolare alla fibratura",
        blocks: [
            h(158, 6, "C4.4.8.1.2 Trazione perpendicolare alla fibratura"),
            p([{ page: 158, from: 7, to: 10 }]),
        ],
    },
    {
        number: "C4.4.8.1.4",
        title: "Compressione perpendicolare alla fibratura",
        blocks: [
            h(158, 11, "C4.4.8.1.4 Compressione perpendicolare alla fibratura"),
            p([{ page: 158, from: 12, to: 13 }]),
        ],
    },
    {
        number: "C4.4.8.1.9",
        title: "Taglio",
        blocks: [
            h(158, 14, "C4.4.8.1.9 Taglio"),
            p([{ page: 158, from: 15, to: 17 }], "Le fessurazioni, che possono instaurarsi anche in tempi successivi alla messa in opera, determinano una riduzione della larghezza della trave che si ripercuote sullo stato tensionale. Pertanto, ai fini del calcolo della tensione massima di taglio F_d dovrà essere presa in considerazione una larghezza di trave ridotta secondo il fattore k_cr che assume i valori seguenti:"),
            li([{ page: 158, from: 18, to: 18 }], "k_cr = 2,0/f_v,k per legno massiccio;"),
            li([{ page: 158, from: 19, to: 19 }], "k_cr = 2,5/f_v,k per legno lamellare;"),
            li([{ page: 158, from: 20, to: 20 }], "k_cr = 1,0 per gli altri prodotti a base legno secondo le UNI EN 13986 e UNI EN 14374;"),
            p([{ page: 158, from: 21, to: 21 }], "essendo f_v,k il valore della resistenza caratteristica a taglio dell’elemento considerato (in MPa)."),
            p([{ page: 158, from: 22, to: 25 }]),
            p([{ page: 158, from: 26, to: 29 }], "Nel caso di pannelli di tavole incollate a strati incrociati, nella verifica a taglio delle tavole disposte parallelamente alla direzione dell’azione sollecitante si dovrà fare riferimento al valore della resistenza a taglio f_v,d mentre nella verifica a taglio delle tavole disposte ortogonalmente alla direzione dell’azione sollecitante si dovrà fare riferimento al valore della resistenza a taglio per rotolamento delle fibre f_R,d."),
        ],
    },
    {
        number: "C4.4.8.2",
        title: "VERIFICHE DI STABILITÀ",
        blocks: [
            h(158, 30, "C4.4.8.2 VERIFICHE DI STABILITÀ"),
            p([{ page: 158, from: 31, to: 33 }]),
        ],
    },
    {
        number: "C4.4.9",
        title: "COLLEGAMENTI",
        blocks: [
            h(158, 34, "C4.4.9 COLLEGAMENTI"),
            p([{ page: 158, from: 35, to: 37 }]),
            p([{ page: 158, from: 38, to: 43 }]),
            p([{ page: 158, from: 44, to: 47 }]),
            p([{ page: 158, from: 48, to: 49 }]),
            p([{ page: 158, from: 50, to: 51 }]),
            p([{ page: 158, from: 52, to: 53 }, { page: 159, from: 3, to: 9 }]),
            p([{ page: 159, from: 10, to: 11 }]),
            p([{ page: 159, from: 12, to: 14 }]),
            p([{ page: 159, from: 15, to: 19 }]),
            p([{ page: 159, from: 20, to: 22 }]),
            p([{ page: 159, from: 23, to: 28 }]),
            p([{ page: 159, from: 29, to: 29 }]),
            p([{ page: 159, from: 30, to: 31 }]),
        ],
    },
    {
        number: "C4.4.10",
        title: "ELEMENTI STRUTTURALI",
        blocks: [
            h(159, 32, "C4.4.10 ELEMENTI STRUTTURALI"),
            p([{ page: 159, from: 33, to: 36 }]),
            p([{ page: 159, from: 37, to: 40 }]),
            p([{ page: 159, from: 41, to: 42 }]),
            p([{ page: 159, from: 43, to: 44 }]),
            p([{ page: 159, from: 45, to: 47 }]),
            p([{ page: 159, from: 48, to: 51 }]),
            p([{ page: 159, from: 52, to: 54 }]),
            p([{ page: 159, from: 55, to: 56 }, { page: 160, from: 3, to: 4 }]),
            p([{ page: 160, from: 5, to: 6 }]),
            p([{ page: 160, from: 7, to: 16 }]),
            p([{ page: 160, from: 17, to: 18 }]),
        ],
    },
    {
        number: "C4.4.11",
        title: "SISTEMI STRUTTURALI",
        blocks: [
            h(160, 19, "C4.4.11 SISTEMI STRUTTURALI"),
            p([{ page: 160, from: 20, to: 21 }]),
            p([{ page: 160, from: 22, to: 26 }]),
            p([{ page: 160, from: 27, to: 29 }]),
            p([{ page: 160, from: 30, to: 31 }]),
            p([{ page: 160, from: 32, to: 37 }]),
            p([{ page: 160, from: 38, to: 39 }]),
            p([{ page: 160, from: 40, to: 42 }]),
        ],
    },
    {
        number: "C4.4.12",
        title: "ROBUSTEZZA",
        blocks: [
            h(160, 43, "C4.4.12 ROBUSTEZZA"),
            p([{ page: 160, from: 44, to: 44 }]),
            li([{ page: 160, from: 45, to: 45 }]),
            li([{ page: 160, from: 46, to: 46 }]),
            li([{ page: 160, from: 47, to: 47 }]),
            li([{ page: 160, from: 48, to: 49 }]),
        ],
    },
    {
        number: "C4.4.13",
        title: "DURABILITÀ",
        blocks: [
            h(160, 50, "C4.4.13 DURABILITÀ"),
            p([{ page: 160, from: 51, to: 54 }, { page: 161, from: 3, to: 5 }]),
            p([{ page: 161, from: 6, to: 7 }]),
            p([{ page: 161, from: 8, to: 10 }]),
        ],
    },
    {
        number: "C4.4.14",
        title: "RESISTENZA AL FUOCO",
        blocks: [
            h(161, 11, "C4.4.14 RESISTENZA AL FUOCO"),
            p([{ page: 161, from: 12, to: 13 }]),
            li([{ page: 161, from: 14, to: 14 }]),
            li([{ page: 161, from: 15, to: 15 }]),
            li([{ page: 161, from: 16, to: 17 }]),
            p([{ page: 161, from: 18, to: 19 }]),
            p([{ page: 161, from: 20, to: 24 }]),
            p([{ page: 161, from: 25, to: 26 }]),
        ],
    },
    {
        number: "C4.4.15",
        title: "REGOLE PER L’ESECUZIONE",
        blocks: [
            h(161, 27, "C4.4.15 REGOLE PER L’ESECUZIONE"),
            p([{ page: 161, from: 28, to: 32 }]),
            p([{ page: 161, from: 33, to: 35 }]),
            p([{ page: 161, from: 36, to: 40 }]),
            p([{ page: 161, from: 41, to: 42 }]),
            p([{ page: 161, from: 43, to: 44 }]),
            p([{ page: 161, from: 45, to: 45 }], "Si raccomanda, inoltre, che il diametro delle preforature non sia maggiore di 0,8 d, essendo d il diametro del chiodo."),
            p([{ page: 161, from: 46, to: 48 }], "Si raccomanda che, nel legno, i fori per i bulloni abbiano un diametro che non sia più grande di 1 mm rispetto al diametro d del bullone. Si raccomanda che, nelle piastre di acciaio, i fori per i bulloni abbiano un diametro che non sia più grande di max [2 mm; 0,1d] rispetto al diametro d del bullone."),
            p([{ page: 161, from: 49, to: 50 }], "Al di sotto della testa del bullone e del dado dovranno essere utilizzate rondelle aventi lunghezza del lato o diametro pari ad almeno 3d e spessore pari ad almeno 0,3d e che le rondelle appoggino per intero sul legno."),
            p([{ page: 161, from: 51, to: 53 }]),
            p([{ page: 162, from: 3, to: 5 }]),
            p([{ page: 162, from: 6, to: 11 }], "Considerate le numerose tipologie di viti sul mercato, si raccomanda di fare riferimento alle certificazioni del prodotto effettivamente utilizzato (ETA, Valutazione Tecnica Europea, o CIT, Certificato di Idoneità Tecnica), soprattutto per quanto attiene la necessità e le modalità di effettuazione delle preforature nel legno. In mancanza di specifiche indicazioni, per viti infisse in legno di conifera, con diametro del gambo liscio d ≤ 6 mm, non è richiesta la preforatura. In mancanza di specifiche indicazioni, per tutte le viti infisse in legno di latifoglie e per viti in legno di conifere aventi un diametro d>6 mm, è richiesta una preforatura tale che:"),
            li([{ page: 162, from: 12, to: 12 }]),
            li([{ page: 162, from: 13, to: 13 }]),
            p([{ page: 162, from: 14, to: 15 }], "Per legno con massa volumica maggiore di 500 kg/m³, si raccomanda che il diametro di preforatura sia determinato tramite prove."),
            p([{ page: 162, from: 16, to: 17 }]),
            p([{ page: 162, from: 18, to: 20 }]),
            p([{ page: 162, from: 21, to: 23 }]),
            p([{ page: 162, from: 24, to: 25 }]),
            p([{ page: 162, from: 26, to: 29 }]),
            p([{ page: 162, from: 30, to: 34 }]),
        ],
    },
    {
        number: "C4.4.16",
        title: "VERIFICHE PER SITUAZIONI TRANSITORIE, CONTROLLI E PROVE DI CARICO",
        blocks: [
            h(162, 35, "C4.4.16 VERIFICHE PER SITUAZIONI TRANSITORIE, CONTROLLI E PROVE DI CARICO"),
            p([{ page: 162, from: 36, to: 38 }]),
            li([{ page: 162, from: 39, to: 39 }]),
            li([{ page: 162, from: 40, to: 40 }]),
            li([{ page: 162, from: 41, to: 41 }]),
        ],
    },
    {
        number: "C4.4.16.1",
        title: "CONTROLLI IN FASE DI COSTRUZIONE",
        blocks: [
            h(162, 42, "C4.4.16.1 CONTROLLI IN FASE DI COSTRUZIONE"),
            p([{ page: 162, from: 43, to: 44 }]),
            p([{ page: 162, from: 45, to: 46 }]),
            li([{ page: 162, from: 47, to: 47 }]),
            li([{ page: 162, from: 48, to: 51 }]),
            li([{ page: 162, from: 52, to: 52 }]),
            li([{ page: 162, from: 53, to: 53 }]),
            li([{ page: 163, from: 3, to: 5 }]),
            li([{ page: 163, from: 6, to: 6 }]),
        ],
    },
    {
        number: "C4.4.16.2",
        title: "CONTROLLI SULLA STRUTTURA COMPLETA",
        blocks: [
            h(163, 7, "C4.4.16.2 CONTROLLI SULLA STRUTTURA COMPLETA"),
            p([{ page: 163, from: 8, to: 12 }]),
            p([{ page: 163, from: 13, to: 13 }]),
            li([{ page: 163, from: 14, to: 15 }]),
            li([{ page: 163, from: 16, to: 17 }]),
            li([{ page: 163, from: 18, to: 18 }]),
            li([{ page: 163, from: 19, to: 20 }]),
        ],
    },
    {
        number: "C4.4.16.3",
        title: "CONTROLLI DELLA STRUTTURA IN ESERCIZIO",
        blocks: [
            h(163, 21, "C4.4.16.3 CONTROLLI DELLA STRUTTURA IN ESERCIZIO"),
            p([{ page: 163, from: 22, to: 24 }]),
            p([{ page: 163, from: 25, to: 26 }]),
        ],
    },
];

const inlineTerms: Array<[string, string]> = [
    ["utot,fin", "u_{tot,fin}"],
    ["u21,inst", "u_{21,inst}"],
    ["u2i,inst", "u_{2i,inst}"],
    ["u1,inst", "u_{1,inst}"],
    ["uinst", "u_{inst}"],
    ["ufin", "u_{fin}"],
    ["udif", "u_{dif}"],
    ["unet", "u_{net}"],
    ["Kser", "K_{ser}"],
    ["a_s", "a_s"],
    ["kdef", "k_{def}"],
    ["k_cr", "k_{cr}"],
    ["f_v,k", "f_{v,k}"],
    ["f_v,d", "f_{v,d}"],
    ["f_R,d", "f_{R,d}"],
    ["F_d", "F_d"],
    ["d ≤ 6 mm", "d\\le6\\,\\mathrm{mm}"],
    ["d>6 mm", "d>6\\,\\mathrm{mm}"],
    ["1/(1+kdef)", "\\frac{1}{1+k_{def}}"],
    ["0/+0,1 mm", "0/+0{,}1\\,\\mathrm{mm}"],
    ["50%", "50\\%"],
    ["30°", "30^\\circ"],
    ["50 mm", "50\\,\\mathrm{mm}"],
    ["1 mm", "1\\,\\mathrm{mm}"],
    ["2 mm", "2\\,\\mathrm{mm}"],
    ["6 mm", "6\\,\\mathrm{mm}"],
    ["ψ21", "\\psi_{21}"],
    ["ψ0i", "\\psi_{0i}"],
    ["ψ2i", "\\psi_{2i}"],
    ["0/+0,1", "0/+0{,}1"],
    ["0,8 d", "0{,}8d"],
    ["0,1d", "0{,}1d"],
    ["0,3d", "0{,}3d"],
    ["3d", "3d"],
    ["70%", "70\\%"],
    ["500 kg/m³", "500\\,\\mathrm{kg/m^3}"],
    ["1000 m", "1000\\,\\mathrm{m}"],
    ["30%", "30\\%"],
    ["8 Hz", "8\\,\\mathrm{Hz}"],
    ["d", "d"],
    ["F", "F"],
    ["i-esimo", "i\\text{-esimo}"],
];

function findTerm(text: string, term: string, cursor: number): number {
    if (term.length === 1) {
        const re = new RegExp("(?<![\\p{L}\\p{N}_])" + term + "(?![\\p{L}\\p{N}_])", "gu");
        re.lastIndex = cursor;
        const match = re.exec(text);
        return match?.index ?? -1;
    }
    return text.indexOf(term, cursor);
}

function inline(text: string): any[] | undefined {
    const found = inlineTerms
        .map(([value, latex]) => ({ value, latex, index: findTerm(text, value, 0) }))
        .filter((item) => item.index >= 0)
        .sort((a, b) => a.index - b.index || b.value.length - a.value.length);
    if (!found.length) return undefined;
    const result: any[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let next: { value: string; latex: string; index: number } | undefined;
        for (const [value, latex] of inlineTerms) {
            const index = findTerm(text, value, cursor);
            if (index >= 0 && (!next || index < next.index || (index === next.index && value.length > next.value.length))) {
                next = { value, latex, index };
            }
        }
        if (!next) {
            result.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (next.index > cursor) result.push({ kind: "text", value: text.slice(cursor, next.index) });
        result.push({ kind: "math", value: next.value, latex: next.latex });
        cursor = next.index + next.value.length;
    }
    return result.filter((item) => item.value);
}

function blockRecord(unit: UnitSpec, block: BlockSpec, index: number): any {
    const id = uid(unit.number);
    const blockId = id + "#block-" + (index === 0 ? "heading" : String(index).padStart(3, "0"));
    if (block.kind === "formula-ref" || block.kind === "figure-ref") {
        return {
            blockId,
            kind: block.kind,
            origin: "official",
            assetId: block.assetId,
            evidence: blockEvidence(block.parts, raw(block.parts), true, true),
        };
    }
    const source = raw(block.parts);
    const normalized = block.text ?? normalizeRaw(source, block.kind);
    const text: any = {
        raw: source,
        normalized,
        normalizationVersion: profile,
    };
    const segments = inline(normalized);
    if (segments) text.inline = segments;
    return {
        blockId,
        kind: block.kind,
        origin: "official",
        text,
        evidence: blockEvidence(block.parts, normalized, Boolean(block.text)),
    };
}

const figureBytes = await readFile(figurePath);
const figureSha = sha256(figureBytes);
const figureAsset = {
    id: figureId("C4.4.1"),
    unitId: uid("C4.4.7"),
    officialNumber: "C4.4.1",
    pdfPage: 157,
    caption: "Figura C4.4.1 – Deformazione per un elemento inflesso",
    alt: "Figura C4.4.1 – Deformazione per un elemento inflesso",
    imagePath: "figures/circ2019/figc4.4.1.png",
    region: {
        coordinateSystem: "pdf-points-top-left",
        x: 135,
        y: 85,
        width: 330,
        height: 97,
    },
    sha256: figureSha,
};

const formulas = [
    { id: formulaId("C4.4.1"), unitId: uid("C4.4.7"), officialNumber: "C4.4.1", pdfPage: 156, latex: "u_{fin}=u_{inst}+u_{dif}" },
    { id: formulaId("C4.4.2"), unitId: uid("C4.4.7"), officialNumber: "C4.4.2", pdfPage: 156, latex: "u_{net}=u_1+u_2-u_0" },
    { id: formulaId("C4.4.3"), unitId: uid("C4.4.7"), officialNumber: "C4.4.3", pdfPage: 157, latex: "u_{tot,fin}=u_{1,inst}(1+k_{def})+u_{21,inst}(1+\\psi_{21}k_{def})+\\sum(i=2\\ldots n)[u_{2i,inst}(\\psi_{0i}+\\psi_{2i}k_{def})]" },
];

await mkdir(unitDir, { recursive: true });
for (const unit of units) {
    const id = uid(unit.number);
    const parts = unit.number.slice(1).split(".");
    const prefixNumbers = parts.map((_, index) => "C" + parts.slice(0, index + 1).join("."));
    const ancestors = prefixNumbers.slice(0, -1);
    const blocks = unit.blocks.map((block, index) => blockRecord(unit, block, index));
    const formulaIds = blocks.filter((block: any) => block.kind === "formula-ref").map((block: any) => block.assetId);
    const figureIds = blocks.filter((block: any) => block.kind === "figure-ref").map((block: any) => block.assetId);
    const issuePrefix = "circ2019-" + unit.number.toLowerCase().replaceAll(".", "-");
    const openIssues: any[] = [{
        issueId: issuePrefix + "-source-review",
        type: "normalization-review",
        severity: "blocking",
        note: "Trascrizione confrontata con il render ufficiale nello step; resta obbligatoria la revisione umana indipendente prima della pubblicazione.",
    }];
    if (formulaIds.length || figureIds.length) {
        openIssues.push({
            issueId: issuePrefix + "-assets",
            type: "asset-review",
            severity: "blocking",
            note: "Formule e figura sono state collocate nel flusso originario e trascritte dal render ufficiale; resta obbligatoria la verifica umana degli asset.",
        });
    }
    if (unit.number === "C4.4.15") {
        openIssues.push({
            issueId: issuePrefix + "-raw-glyph-corruption",
            type: "ambiguous-source",
            severity: "blocking",
            note: "Il layer testuale estratto della frase sulle viti alle righe 9–10 di pagina PDF 162 contiene glifi di controllo; il testo normalizzato è stato ricostruito dal render ad alta scala.",
        });
    }
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id,
        workId: "it-mit:circ:2019-01-21:7-csllpp",
        expressionId: "it-mit:circ:2019-01-21:7-csllpp:original-it",
        kind: parts.length === 2 ? "section" : parts.length === 3 ? "paragraph" : parts.length >= 4 ? "subparagraph" : "chapter",
        numbering: { official: unit.number, sortKey: parts.map((part) => part.padStart(3, "0")).join(".") },
        title: unit.title,
        titleBlockId: id + "#block-heading",
        hierarchy: {
            parentId: ancestors.length ? uid(ancestors[ancestors.length - 1]!) : null,
            ancestorIds: ancestors.map((ancestor) => uid(ancestor)),
            position: Number(parts[parts.length - 1]),
        },
        validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
        blocks,
        citations: [],
        relations: [],
        assets: { formulaIds, tableIds: [], figureIds },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "codex:circ44-step1", kind: "automated-agent", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues,
        },
    };
    await writeFile(join(unitDir, unit.number.toLowerCase() + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8");
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.4-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas,
    tables: [],
    figures: [figureAsset],
};
await writeFile(join(assetDir, "C4.4-step1.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log("circ44-step1: generated " + units.length + " units, " + formulas.length + " formulas and 1 figure");
