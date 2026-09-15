/**
 * Rende canonico, senza rigenerare l'intero capitolo, il record NTC 4.2.3.1:
 * la lista etichettata "classe 1..4" che segue la formula [4.2.0] diventa una
 * successione di `list-item` con etichetta in corsivo, allineata a sinistra
 * come nel render ufficiale (Palatino Linotype Italic a x=83 pt, definizione
 * indentata a x=111,2 pt).
 *
 * Il testo ufficiale non ha punteggiatura dopo l'etichetta; il due punti e'
 * aggiunto solo per rispettare la convenzione dell'elenco etichettato prevista
 * dal marcatore `hasLeadingEmphasisLabel` del viewer. La sostituzione e'
 * registrata in `evidence.transformations` e `normalizedSha256` e' aggiornato.
 *
 * Il passo e' idempotente. Il generatore `scripts/build-ntc42-step3.ts`
 * produce gli stessi blocchi.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitPath = `${root}/corpus/units/ntc2018/4.2.3.1.json`;
const profile = "ntc42-labelled-list-editorial-profile-0.1.0";

type Segment = { kind: string; value: string; latex?: string };
type Block = {
    blockId: string;
    kind: string;
    text?: { raw: string; normalized: string; normalizationVersion: string; inline?: Segment[] };
    evidence?: { normalizedSha256: string; transformations?: Array<{ operation: string; ruleVersion: string; note: string }>; [key: string]: unknown };
    [key: string]: unknown;
};
type Unit = { blocks: Block[]; [key: string]: unknown };

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const preface = "urn:structural-codes:it:unit:ntc2018:4.2.3.1#block-editorial-";

/** Etichette in corsivo, nell'ordine ufficiale, con la definizione che segue. */
const labels = ["classe 1", "classe 2", "classe 3", "classe 4"];

const unit = JSON.parse(await readFile(unitPath, "utf8")) as Unit;
let changed = 0;

for (const [index, label] of labels.entries()) {
    const block = unit.blocks.find((candidate) => candidate.blockId === `${preface}${String(index + 5).padStart(3, "0")}`);
    if (block?.text === undefined) throw new Error(`Blocco mancante per ${label}`);
    const { text } = block;

    if (block.kind !== "list-item") {
        block.kind = "list-item";
        changed += 1;
    }
    // L'elenco etichettato non usa marcatori: l'etichetta e' il marcatore.
    if ("listMarker" in block) delete block.listMarker;

    const inline = text.inline;
    if (inline === undefined) throw new Error(`Segmenti inline mancanti per ${label}`);
    const [first, second, ...rest] = inline;
    if (first?.kind !== "em" || first.value !== label) {
        const head = second;
        if (head?.kind !== "text") throw new Error(`Descrizione non testuale per ${label}`);
        inline.splice(0, inline.length, { kind: "em", value: label }, { ...head, value: `: ${head.value.replace(/^:\s*/u, "").replace(/^ /u, "")}` }, ...rest);
        changed += 1;
    } else if (second?.kind !== "text" || !second.value.startsWith(":")) {
        if (second?.kind !== "text") throw new Error(`Descrizione non testuale per ${label}`);
        inline[1] = { ...second, value: `: ${second.value.replace(/^:\s*/u, "").replace(/^ /u, "")}` };
        changed += 1;
    }

    const normalized = inline.map((segment) => segment.value).join("");
    if (text.normalized !== normalized) {
        text.normalized = normalized;
        text.normalizationVersion = profile;
        changed += 1;
    }
    if (block.evidence !== undefined) {
        block.evidence.normalizedSha256 = sha256(text.normalized);
        const transformations = (block.evidence.transformations ??= []);
        if (!transformations.some((entry) => entry.ruleVersion === profile)) {
            transformations.push({
                operation: "manual-correction",
                ruleVersion: profile,
                note: "Separata l'etichetta in corsivo dalla definizione e resa l'etichetta un `list-item` allineato a sinistra, come nel render ufficiale; il testo ufficiale non ha punteggiatura dopo l'etichetta, i due punti seguono la convenzione dell'elenco etichettato.",
            });
        }
    }
}

if (changed === 0) {
    console.log("NTC 4.2.3.1: lista etichettata gia' canonica.");
} else {
    await writeFile(unitPath, JSON.stringify(unit, null, 2) + "\n", "utf8");
    console.log(`NTC 4.2.3.1: applicate ${changed} modifiche alla lista etichettata (profilo ${profile}).`);
}
