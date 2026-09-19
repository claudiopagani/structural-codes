import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/* eslint-disable @typescript-eslint/no-explicit-any */
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const assetPath = join(repoRoot, "corpus", "assets", "circ2019", "C11-step2.json");
type AnyRecord = Record<string, any>;

const manifest = JSON.parse(await readFile(assetPath, "utf8")) as AnyRecord;
const table = manifest.tables.find((candidate: AnyRecord) => candidate.officialNumber === "C11.3.4.11.2.I") as AnyRecord | undefined;
if (!table) throw new Error("Tabella C11.3.4.11.2.I non trovata");

for (const row of table.rows) {
    for (const currentCell of row) {
        if (currentCell.text === "UNI EN 10326") currentCell.text = "UNI EN\n10326";
        if (currentCell.text === "UNI EN 10149-2") currentCell.text = "UNI EN\n10149-2";
        if (currentCell.text === "UNI EN 10149-3") currentCell.text = "UNI EN\n10149-3";
    }
}

// With the row spans in this table, logical column 3 is cell index 2 on the
// first row of each group and cell index 0 on its continuation rows.
for (const rowIndex of [0, 4, 8]) {
    table.rows[rowIndex][2].align = "left";
    for (const continuation of table.rows.slice(rowIndex + 1, rowIndex + 4)) continuation[0].align = "left";
}

await writeFile(assetPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log("fix-circ11-followup-editorial: Tab. C11.3.4.11.2.I aggiornata");
