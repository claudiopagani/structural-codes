import fs from "node:fs";
import path from "node:path";

const repositoryRoot = process.cwd();
const ruleVersion = "inline-fraction-layout-0.1.0";
const transformationNote =
  "Convertite con barra obliqua le frazioni nella matematica inline, come nella composizione tipografica della fonte; le formule in display restano in forma frazionaria.";

type DocumentName = "ntc2018" | "circ2019";

function readGroup(value: string, start: number): { content: string; end: number } {
  if (value[start] !== "{") {
    throw new Error(`Atteso un gruppo tra graffe alla posizione ${start}: ${value}`);
  }

  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "{") depth += 1;
    if (value[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return { content: value.slice(start + 1, index), end: index + 1 };
      }
    }
  }

  throw new Error(`Gruppo tra graffe non chiuso: ${value}`);
}

function skipBalanced(value: string, start: number, opening: string, closing: string): number {
  if (value[start] !== opening) return start;

  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === opening) depth += 1;
    if (value[index] === closing) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }

  throw new Error(`Delimitatore ${opening}${closing} non chiuso: ${value}`);
}

function hasTopLevelAdditiveOperator(value: string): boolean {
  let braceDepth = 0;
  let parenthesisDepth = 0;
  let bracketDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "{") braceDepth += 1;
    else if (character === "}") braceDepth -= 1;
    else if (character === "(") parenthesisDepth += 1;
    else if (character === ")") parenthesisDepth -= 1;
    else if (character === "[") bracketDepth += 1;
    else if (character === "]") bracketDepth -= 1;
    else if (
      (character === "+" || character === "-") &&
      braceDepth === 0 &&
      parenthesisDepth === 0 &&
      bracketDepth === 0 &&
      index > 0
    ) {
      return true;
    }
  }

  return false;
}

function consumeCommand(value: string, start: number): { end: number; command: string } {
  let end = start + 1;
  while (end < value.length && /[A-Za-z]/u.test(value[end] ?? "")) end += 1;
  return { command: value.slice(start + 1, end), end };
}

function countFactors(value: string): number {
  let count = 0;
  let index = 0;
  while (index < value.length) {
    if (/\s/u.test(value[index] ?? "")) {
      index += 1;
      continue;
    }

    if (value.startsWith("\\cdot", index)) {
      index += "\\cdot".length;
      continue;
    }

    const character = value[index];
    if (character === "{") {
      index = readGroup(value, index).end;
      count += 1;
      continue;
    }
    if (character === "(" || character === "[") {
      index = skipBalanced(value, index, character, character === "(" ? ")" : "]");
      count += 1;
      continue;
    }
    if (character === "\\") {
      const { command, end } = consumeCommand(value, index);
      index = end;
      if (value[index] === "{") index = readGroup(value, index).end;
      if (["ln", "log", "sin", "cos", "tan"].includes(command)) {
        const delimiter = value[index];
        if (delimiter === "(" || delimiter === "[") {
          index = skipBalanced(value, index, delimiter, delimiter === "(" ? ")" : "]");
        }
      }
      count += 1;
      continue;
    }
    if (/[0-9]/u.test(character ?? "")) {
      index += 1;
      while (index < value.length && /[0-9.,]/u.test(value[index] ?? "")) index += 1;
      count += 1;
      continue;
    }
    if (/[A-Za-z]/u.test(character ?? "")) {
      index += 1;
      while (index < value.length && (value[index] === "_" || value[index] === "^")) {
        index += 1;
        if (value[index] === "{") index = readGroup(value, index).end;
        else if (index < value.length) index += 1;
      }
      count += 1;
      continue;
    }

    index += 1;
  }

  return count;
}

function addGrouping(value: string, denominator: boolean): string {
  const trimmed = value.trim();
  const needsGrouping =
    hasTopLevelAdditiveOperator(trimmed) ||
    (denominator && (trimmed.includes("\\cdot") || countFactors(trimmed) > 1));
  return needsGrouping ? `(${trimmed})` : trimmed;
}

function convertInlineFractions(value: string): string {
  let output = "";
  let index = 0;
  while (index < value.length) {
    if (!value.startsWith("\\frac", index)) {
      output += value[index];
      index += 1;
      continue;
    }

    const numeratorStart = index + "\\frac".length;
    const numerator = readGroup(value, numeratorStart);
    const denominator = readGroup(value, numerator.end);
    const separator = output.endsWith("\\cdot") ? "\\cdot " : "";
    if (separator) output = output.slice(0, -"\\cdot".length);
    output += `${separator}${addGrouping(convertInlineFractions(numerator.content), false)}/${addGrouping(convertInlineFractions(denominator.content), true)}`;
    index = denominator.end;
  }
  return output;
}

function parsePageRange(argument: string | undefined): { from: number; to: number } | null {
  if (!argument) return null;
  const match = /^(\d+)(?:-(\d+))?$/u.exec(argument);
  if (!match) throw new Error(`Intervallo pagine non valido: ${argument}`);
  const from = Number(match[1]);
  const to = Number(match[2] ?? match[1]);
  if (from > to) throw new Error(`Intervallo pagine invertito: ${argument}`);
  return { from, to };
}

function selectedDocument(argument: string | undefined): DocumentName[] {
  if (!argument || argument === "all") return ["ntc2018", "circ2019"];
  if (argument !== "ntc2018" && argument !== "circ2019") {
    throw new Error(`Documento non valido: ${argument}`);
  }
  return [argument];
}

function isSelectedPage(pdfPage: unknown, pages: { from: number; to: number } | null): boolean {
  return pages === null || (typeof pdfPage === "number" && pdfPage >= pages.from && pdfPage <= pages.to);
}

function addTransformation(block: Record<string, unknown>): void {
  const evidence = block.evidence as Record<string, unknown> | undefined;
  if (!evidence) throw new Error(`Blocco senza evidence: ${String(block.blockId)}`);
  const transformations = (evidence.transformations ?? []) as Record<string, unknown>[];
  if (!transformations.some((item) => item.ruleVersion === ruleVersion)) {
    transformations.push({
      operation: "manual-correction",
      ruleVersion,
      note: transformationNote,
    });
  }
  evidence.transformations = transformations;
}

function transformUnitFile(filePath: string, pages: { from: number; to: number } | null): number {
  const document = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  let changed = 0;
  const blocks = document.blocks as Record<string, unknown>[];
  for (const block of blocks) {
    const evidence = block.evidence as Record<string, unknown> | undefined;
    if (!isSelectedPage(evidence?.pdfPage, pages)) continue;
    const text = block.text as Record<string, unknown> | undefined;
    const inline = text?.inline as Record<string, unknown>[] | undefined;
    if (!inline) continue;
    for (const segment of inline) {
      if (segment.kind !== "math" || typeof segment.latex !== "string" || !segment.latex.includes("\\frac")) continue;
      segment.latex = convertInlineFractions(segment.latex);
      addTransformation(block);
      changed += 1;
    }
  }
  if (changed > 0) fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`);
  return changed;
}

function transformTableManifest(filePath: string, documentName: DocumentName, pages: { from: number; to: number } | null): number {
  const manifest = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  const tables = manifest.tables as Record<string, unknown>[];
  let changed = 0;
  for (const table of tables) {
    if (!isSelectedPage(table.pdfPage, pages)) continue;
    const officialNumber = table.officialNumber;
    const shouldTransformCells =
      (documentName === "circ2019" &&
        typeof officialNumber === "string" &&
        ["C3.3.I", "C3.3.II", "C3.3.V", "C3.3.VI", "C3.3.IX", "C3.3.X", "C3.3.XIII", "C3.3.XVI"].includes(officialNumber)) ||
      (documentName === "ntc2018" && officialNumber === "5.2.II");
    const shouldTransformCaption =
      documentName === "circ2019" &&
      typeof officialNumber === "string" &&
      ["C4.1.I", "C3.3.XVIII"].includes(officialNumber);
    if (!shouldTransformCells && !shouldTransformCaption) continue;

    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
      } else if (value && typeof value === "object") {
        const object = value as Record<string, unknown>;
        if (typeof object.latex === "string" && object.latex.includes("\\frac")) {
          object.latex = convertInlineFractions(object.latex);
          changed += 1;
        }
        for (const [key, item] of Object.entries(object)) {
          if ((key === "headers" || key === "rows") && shouldTransformCells) visit(item);
          if (key === "captionInline" && shouldTransformCaption) visit(item);
        }
      }
    };
    if (shouldTransformCells) {
      visit(table.headers);
      visit(table.rows);
    }
    if (shouldTransformCaption) visit(table.captionInline);
  }
  if (changed > 0) fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
  return changed;
}

const argumentsByName = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (!argument?.startsWith("--")) throw new Error(`Argomento non riconosciuto: ${argument}`);
  const [name, value] = argument.split("=", 2);
  if (!name || !value) throw new Error(`Argomento privo di valore: ${argument}`);
  argumentsByName.set(name, value);
}

const documents = selectedDocument(argumentsByName.get("--document"));
const pages = parsePageRange(argumentsByName.get("--pages"));
let unitChanges = 0;
let tableChanges = 0;
for (const documentName of documents) {
  const unitsDirectory = path.join(repositoryRoot, "corpus", "units", documentName);
  for (const fileName of fs.readdirSync(unitsDirectory).filter((name) => name.endsWith(".json")).sort()) {
    unitChanges += transformUnitFile(path.join(unitsDirectory, fileName), pages);
  }
  if (documentName === "circ2019") {
    tableChanges += transformTableManifest(path.join(repositoryRoot, "corpus/assets/circ2019/core-tables.json"), documentName, pages);
  }
  if (documentName === "ntc2018") {
    tableChanges += transformTableManifest(path.join(repositoryRoot, "corpus/assets/ntc2018/5.1-step3.json"), documentName, pages);
  }
}

console.log(`inline-fraction-layout: ${unitChanges} segmenti inline e ${tableChanges} celle/didascalie aggiornati`);
