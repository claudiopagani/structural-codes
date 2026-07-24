/**
 * Convenzioni identificatori normativi.
 *
 * Gli ID sono gerarchici, deterministici, indipendenti dai path fisici:
 *   ntc2018:c3/s3.3/p3.3.7          paragrafo NTC
 *   ntc2018:c3/s3.3/tab3.3.ii       tabella (numeri romani minuscoli)
 *   ntc2018:c3/s3.3/eq3.3.7         equazione numerata
 *   ntc2018:c3/s3.3/eq3.3.7-a       equazione non numerata (suffisso progressivo)
 *   ntc2018:c3/s3.3/fig3.3.2        figura
 *   circ2019:c3/s3.3/p-c3.3.7       paragrafo Circolare
 *
 * Regole:
 * - docId minuscolo: ntc2018 | circ2019
 * - segmenti minuscoli, numeri romani delle tabelle minuscoli
 * - slug = id con ":" e "/" -> "-", "." -> "-"
 * - gli ID deprecati non vengono mai riusati
 */

export const DOC_IDS = ["ntc2018", "circ2019"] as const;
export type DocId = (typeof DOC_IDS)[number];

const ID_PATTERN = /^(?<doc>ntc2018|circ2019):(?<segments>[a-z0-9]+(?:[.-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[.-][a-z0-9]+)*)*)$/;

export function isValidUnitId(id: string): boolean {
    return ID_PATTERN.test(id);
}

export function docIdOf(id: string): DocId | null {
    const match = ID_PATTERN.exec(id);
    return match?.groups?.doc === "ntc2018" || match?.groups?.doc === "circ2019"
        ? (match.groups.doc as DocId)
        : null;
}

export function slugify(id: string): string {
    return id.toLowerCase().replace(/[:/]/g, "-").replace(/\./g, "-");
}

export function publicPathOf(id: string): string {
    // URL pubblico: ntc2018:c3/s3.3/p3.3.7 -> /normativa/ntc2018/c3/s3.3/p3.3.7
    return `/normativa/${id.replace(":", "/")}`;
}

/** Tipo di entità desunto dall'ultimo segmento dell'ID. */
export function entityKindOf(id: string): "paragraph" | "table" | "formula" | "figure" | "chapter" | "unknown" {
    const last = id.split("/").pop() ?? "";
    if (/^p-?c?\d/.test(last)) return "paragraph";
    if (/^tab\d/.test(last)) return "table";
    if (/^eq\d/.test(last)) return "formula";
    if (/^fig\d/.test(last)) return "figure";
    if (/^c\d+$/.test(last)) return "chapter";
    return "unknown";
}

/**
 * Estrae la sequenza numerica di un paragrafo per il controllo di copertura
 * (es. "p3.3.7" -> [3,3,7]). Restituisce null per ID non paragrafo.
 */
export function paragraphSequenceOf(id: string): number[] | null {
    const last = id.split("/").pop() ?? "";
    const m = /^p(?:-c)?(\d+(?:\.\d+)*)$/.exec(last);
    if (!m || !m[1]) return null;
    return m[1].split(".").map((n) => Number.parseInt(n, 10));
}

/** Confronto lessicografico numerico tra sequenze [3,3,7] < [3,3,10]. */
export function compareSequences(a: number[], b: number[]): number {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
        const av = a[i] ?? -1;
        const bv = b[i] ?? -1;
        if (av !== bv) return av - bv;
    }
    return 0;
}
