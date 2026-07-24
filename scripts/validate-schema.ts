/**
 * validate-schema: valida frontmatter MDX, tabelle JSON, descrittori formule,
 * mapping NTC-Circolare e registro fonti contro gli schemi Zod.
 * Exit code 1 in presenza di errori (CI bloccante).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { splitFrontmatter, extractOfficialText, findFreeText, distinctMarkers } from "../src/lib/index.ts";
import {
  normativeUnitSchema,
  normativeTableSchema,
  formulaDescriptorSchema,
  circularMappingSchema,
  sourceRegistrySchema,
} from "../src/schema/index.ts";
import {
  CONTENT_DIR,
  ASSETS_DIR,
  MAPPINGS_DIR,
  SOURCES_FILE,
  walkFiles,
  readJsonFile,
} from "./lib/walk-content.ts";
import type { ZodIssue } from "zod";

let errors = 0;
let warnings = 0;
let checked = 0;

function reportIssues(file: string, issues: ZodIssue[]): void {
  for (const issue of issues) {
    errors += 1;
    console.error(`  ERRORE ${file}: ${issue.path.join(".") || "(root)"} -> ${issue.message}`);
  }
}

async function validateMdxUnits(): Promise<void> {
  const files = await walkFiles(CONTENT_DIR, ".mdx");
  for (const file of files) {
    checked += 1;
    const raw = await readFile(file.absolutePath, "utf8");
    let parsed;
    try {
      parsed = splitFrontmatter(raw);
    } catch (error) {
      errors += 1;
      console.error(`  ERRORE ${file.relativePath}: ${(error as Error).message}`);
      continue;
    }

    const result = normativeUnitSchema.safeParse(parsed.frontmatter);
    if (!result.success) {
      reportIssues(file.relativePath, result.error.issues);
      continue;
    }

    // Regola editoriale: niente testo libero fuori dai componenti.
    const freeText = findFreeText(parsed.body);
    if (freeText.length > 0) {
      errors += 1;
      console.error(
        `  ERRORE ${file.relativePath}: testo libero fuori dai componenti: ${freeText.map((t) => `"${t.slice(0, 60)}"`).join(", ")}`,
      );
    }

    // Coerenza marcatori: quelli nel testo devono comparire in openIssues
    // (ad eccezione dei marcatori "valore" nei campi hash/source, gestiti dalla pipeline).
    const officialText = extractOfficialText(parsed.body) ?? "";
    const bodyMarkers = distinctMarkers(officialText);
    const declared = new Set(result.data.openIssues.map((i) => i.marker));
    for (const marker of bodyMarkers) {
      if (!declared.has(marker)) {
        warnings += 1;
        console.warn(`  WARN ${file.relativePath}: marcatore [${marker}] nel testo ma assente in openIssues`);
      }
    }

    // Stato vs contenuto: unita' "approved" non puo' avere issue aperte.
    if (
      (result.data.workflow.status === "approved" || result.data.workflow.status === "published") &&
      result.data.openIssues.length > 0
    ) {
      errors += 1;
      console.error(`  ERRORE ${file.relativePath}: stato ${result.data.workflow.status} con openIssues non vuoto`);
    }
  }
}

async function validateJsonAsset(subdir: string, schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: ZodIssue[] } } }, label: string): Promise<void> {
  const files = await walkFiles(join(ASSETS_DIR, subdir), ".json");
  for (const file of files) {
    checked += 1;
    try {
      const data = await readJsonFile(file.absolutePath);
      const result = schema.safeParse(data);
      if (!result.success) reportIssues(file.relativePath, result.error!.issues);
    } catch (error) {
      errors += 1;
      console.error(`  ERRORE ${file.relativePath} (${label}): ${(error as Error).message}`);
    }
  }
}

async function validateMappings(): Promise<void> {
  const files = await walkFiles(MAPPINGS_DIR, ".json");
  for (const file of files) {
    checked += 1;
    try {
      const data = await readJsonFile(file.absolutePath);
      const result = circularMappingSchema.safeParse(data);
      if (!result.success) reportIssues(file.relativePath, result.error.issues);
    } catch (error) {
      errors += 1;
      console.error(`  ERRORE ${file.relativePath} (mapping): ${(error as Error).message}`);
    }
  }
}

async function validateSources(): Promise<void> {
  checked += 1;
  try {
    const data = await readJsonFile(SOURCES_FILE);
    // Registro vuoto ammesso in Fase 0, prima dell'acquisizione delle fonti.
    if (
      typeof data === "object" &&
      data !== null &&
      Array.isArray((data as { sources?: unknown[] }).sources) &&
      (data as { sources: unknown[] }).sources.length === 0
    ) {
      console.log("  INFO sources/sources.json: registro vuoto (atteso prima di acquire-source)");
      return;
    }
    const result = sourceRegistrySchema.safeParse(data);
    if (!result.success) reportIssues("sources/sources.json", result.error.issues);
  } catch (error) {
    errors += 1;
    console.error(`  ERRORE sources/sources.json: ${(error as Error).message}`);
  }
}

console.log("validate-schema: validazione corpus in corso...");
await validateMdxUnits();
await validateJsonAsset("tables", normativeTableSchema, "tabella");
await validateJsonAsset("formulas", formulaDescriptorSchema, "formula");
await validateMappings();
await validateSources();

console.log(`\nvalidate-schema: ${checked} file controllati, ${errors} errori, ${warnings} warning`);
if (errors > 0) {
  process.exitCode = 1;
}
