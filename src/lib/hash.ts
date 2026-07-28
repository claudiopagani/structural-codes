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
