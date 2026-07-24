import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/** SHA-256 esadecimale di una stringa UTF-8. */
export function sha256OfText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** SHA-256 esadecimale di un file (PDF sorgente, ecc.). */
export async function sha256OfFile(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Normalizzazione deterministica del testo per confronto sorgente <-> MDX.
 * Ammesse SOLO queste trasformazioni (vedi progettazione, sezione confronto):
 * - Unicode NFC
 * - apostrofi/virgolette tipografiche -> ASCII
 * - rimozione sillabazione a fine riga ("-\n" -> "")
 * - collasso spazi multipli e righe vuote multiple
 * - trim finale
 */
export function normalizeForComparison(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/(\w)-\r?\n(\w)/g, "$1$2") // sillabazione
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Hash del testo normalizzato: usato nel frontmatter hash.normalized. */
export function hashNormalized(text: string): string {
  return sha256OfText(normalizeForComparison(text));
}
