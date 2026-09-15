/**
 * Allinea al centro le celle delle colonne 2-5 delle tabelle NTC 4.2.I e
 * 4.2.II, come nel render ufficiale della Gazzetta Ufficiale.
 *
 * Il passo agisce sul bundle canonico `corpus/assets/ntc2018/4.2-step1.json`
 * ed e' idempotente: rieseguirlo non produce differenze. Il generatore
 * `scripts/build-ntc42-step1.ts` produce lo stesso risultato.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = `${root}/corpus/assets/ntc2018/4.2-step1.json`;
const targets = new Map<string, number>([
    ["4.2.I", 5],
    ["4.2.II", 5],
]);

type Cell = { text: string; align?: string; colSpan?: number; [key: string]: unknown };
type Table = { officialNumber: string; headers: Cell[][]; rows: Cell[][]; [key: string]: unknown };
type Manifest = { tables: Table[]; [key: string]: unknown };

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
let changed = 0;

function columnsOf(row: Cell[]): number[] {
    // Restituisce, per ogni cella, l'indice 1-based della prima colonna coperta.
    const columns: number[] = [];
    let column = 1;
    for (const cell of row) {
        columns.push(column);
        column += cell.colSpan ?? 1;
    }
    return columns;
}

function centerCells(row: Cell[], within: number) {
    const columns = columnsOf(row);
    row.forEach((cell, index) => {
        const span = cell.colSpan ?? 1;
        const lastColumn = columns[index]! + span - 1;
        // La colonna 1 (denominazione della norma o qualità dell'acciaio) resta
        // allineata a sinistra; le colonne da 2 a `within` sono centrate.
        if (columns[index]! < 2 || lastColumn > within) return;
        const hasContent = cell.text.trim().length > 0;
        if (!hasContent) return;
        if (cell.align === "center") return;
        cell.align = "center";
        changed += 1;
    });
}

for (const table of manifest.tables) {
    const within = targets.get(table.officialNumber);
    if (within === undefined) continue;
    for (const header of table.headers) centerCells(header, within);
    for (const row of table.rows) centerCells(row, within);
}

if (changed === 0) {
    console.log("NTC 4.2.I/4.2.II: nessuna cella da allineare (gia' centrata).");
} else {
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`NTC 4.2.I/4.2.II: centrate ${changed} celle.`);
}
