import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

interface CorpusStatus {
    status?: unknown;
    canonical?: unknown;
    publishable?: unknown;
}

const statusFile = fileURLToPath(new URL("../corpus-status.json", import.meta.url));
const parsed = JSON.parse(await readFile(statusFile, "utf8")) as CorpusStatus;

const releaseAllowed =
    parsed.status === "published" &&
    parsed.canonical === true &&
    parsed.publishable === true;

if (!releaseAllowed) {
    console.error(
        [
            "Release bloccata: il corpus è in quarantena e non è pubblicabile.",
            `Stato corrente: ${String(parsed.status)}`,
            "Per rimuovere il blocco servono i gate della roadmap e un nuovo ADR.",
        ].join("\n"),
    );
    process.exitCode = 1;
}
