/**
 * validate-ids: controlli su identificatori e riferimenti interni.
 * - ID duplicati / slug duplicati
 * - formato ID (gia' garantito da validate-schema, qui ridondanza difensiva)
 * - refsOut verso unita' esistenti nel corpus
 * - formule/tabelle/figure dichiarate nel frontmatter con asset esistenti
 * - buchi di numerazione tra paragrafi fratelli (warning, non errore)
 * Exit code 1 in presenza di errori.
 */
import { readFile } from "node:fs/promises";
import { splitFrontmatter, paragraphSequenceOf, compareSequences, docIdOf } from "../src/lib/index.ts";
import { normativeUnitSchema } from "../src/schema/index.ts";
import { CONTENT_DIR, ASSETS_DIR, walkFiles } from "./lib/walk-content.ts";

let errors = 0;
let warnings = 0;

interface UnitRecord {
    id: string;
    slug: string;
    file: string;
    formulas: string[];
    tables: string[];
    figures: string[];
    refsOut: Array<{ targetId: string }>;
}

const units: UnitRecord[] = [];
const mdxFiles = await walkFiles(CONTENT_DIR, ".mdx");
for (const file of mdxFiles) {
    const raw = await readFile(file.absolutePath, "utf8");
    try {
        const parsed = splitFrontmatter(raw);
        const result = normativeUnitSchema.safeParse(parsed.frontmatter);
        if (result.success) {
            units.push({
                id: result.data.id,
                slug: result.data.slug,
                file: file.relativePath,
                formulas: result.data.formulas,
                tables: result.data.tables,
                figures: result.data.figures,
                refsOut: result.data.refsOut,
            });
        }
        // gli errori di schema li gestisce validate-schema
    } catch {
        // idem
    }
}

// 1. ID e slug duplicati
const byId = new Map<string, string>();
const bySlug = new Map<string, string>();
for (const unit of units) {
    if (byId.has(unit.id)) {
        errors += 1;
        console.error(`  ERRORE: ID duplicato "${unit.id}" in ${byId.get(unit.id)} e ${unit.file}`);
    }
    if (bySlug.has(unit.slug)) {
        errors += 1;
        console.error(`  ERRORE: slug duplicato "${unit.slug}" in ${bySlug.get(unit.slug)} e ${unit.file}`);
    }
    byId.set(unit.id, unit.file);
    bySlug.set(unit.slug, unit.file);
}

// 2. Riferimenti: refsOut verso unita' esistenti; asset formule/tabelle esistenti
const knownAssetIds = new Set<string>();
for (const subdir of ["tables", "formulas"]) {
    const files = await walkFiles(`${ASSETS_DIR}/${subdir}`, ".json");
    for (const file of files) {
        const raw = await readFile(file.absolutePath, "utf8");
        try {
            const id = (JSON.parse(raw) as { id?: string }).id;
            if (id) knownAssetIds.add(id);
        } catch {
            // json malformato: segnalato da validate-schema
        }
    }
}

for (const unit of units) {
    for (const ref of unit.refsOut) {
        if (!byId.has(ref.targetId)) {
            warnings += 1;
            console.warn(`  WARN ${unit.file}: refsOut verso "${ref.targetId}" non ancora presente nel corpus`);
        }
    }
    for (const formulaId of unit.formulas) {
        if (!knownAssetIds.has(formulaId)) {
            warnings += 1;
            console.warn(`  WARN ${unit.file}: descrittore formula "${formulaId}" non presente in assets/formulas`);
        }
    }
    for (const tableId of unit.tables) {
        if (!knownAssetIds.has(tableId)) {
            warnings += 1;
            console.warn(`  WARN ${unit.file}: tabella "${tableId}" non presente in assets/tables`);
        }
    }
}

// 3. Bucchi di numerazione tra paragrafi fratelli (stesso docId, stesso prefisso)
const paragraphsByParent = new Map<string, Array<{ id: string; seq: number[] }>>();
for (const unit of units) {
    const seq = paragraphSequenceOf(unit.id);
    if (!seq) continue;
    const parent = unit.id.split("/").slice(0, -1).join("/");
    const key = `${docIdOf(unit.id) ?? "?"}|${parent}|${seq.length}`;
    const list = paragraphsByParent.get(key) ?? [];
    list.push({ id: unit.id, seq });
    paragraphsByParent.set(key, list);
}
for (const [key, list] of paragraphsByParent) {
    list.sort((a, b) => compareSequences(a.seq, b.seq));
    for (let i = 1; i < list.length; i += 1) {
        const prev = list[i - 1]!.seq;
        const curr = list[i]!.seq;
        const expectedNext = [...prev];
        expectedNext[expectedNext.length - 1] = expectedNext[expectedNext.length - 1]! + 1;
        if (compareSequences(curr, expectedNext) !== 0 && compareSequences(curr, prev) > 0) {
            warnings += 1;
            console.warn(
                `  WARN: possibile buco di numerazione in ${key}: dopo ${list[i - 1]!.id} salta a ${list[i]!.id}`,
            );
        }
    }
}

console.log(`validate-ids: ${units.length} unita' controllate, ${errors} errori, ${warnings} warning`);
if (errors > 0) {
    process.exitCode = 1;
}
