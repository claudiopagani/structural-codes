/**
 * Parsing minimale e deterministico dei file MDX del corpus.
 *
 * Scelte:
 * - frontmatter YAML tra "---" iniziali, parsato con parser minimale interno
 *   (il corpus usa un sottoinsieme YAML: scalari, liste inline, oggetti inline,
 *   liste di oggetti con "- chiave: valore"); niente dipendenza YAML esterna.
 * - estrazione dei componenti MDX via regex sui tag noti.
 *
 * Il frontmatter e' la FONTE DI VERITA' per i metadati; il body e' la fonte
 * per il testo ufficiale. Gli indici JSON sono artefatti derivati.
 */

export interface ParsedMdx {
  frontmatter: Record<string, unknown>;
  body: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(raw: string): ParsedMdx {
  const match = FRONTMATTER_PATTERN.exec(raw);
  if (!match) {
    throw new Error("Frontmatter mancante o malformato (atteso blocco --- ... ---)");
  }
  const yamlText = match[1] ?? "";
  const body = raw.slice(match[0].length);
  return { frontmatter: parseSimpleYaml(yamlText), body };
}

/**
 * Parser YAML minimale per il sottoinsieme usato dal corpus.
 * Supporta:
 *   chiave: valore scalare (stringa, numero, booleano, null)
 *   chiave: [a, b, c]            lista inline
 *   chiave: { a: 1, b: x }       oggetto inline
 *   chiave:                      blocco (oggetto annidato o lista)
 *     sottochiave: valore
 *   chiave:
 *     - { a: 1 }                 lista inline di oggetti
 *     - targetId: x              lista di oggetti multilinea
 *       scope: explicit
 * Le stringhe possono essere tra virgolette o plain.
 */
export function parseSimpleYaml(yamlText: string): Record<string, unknown> {
  const lines = yamlText.split(/\r?\n/);
  const root: Record<string, unknown> = {};
  // Stack di contenitori: { indent, value }
  const stack: Array<{ indent: number; value: Record<string, unknown> | unknown[] }> = [
    { indent: -1, value: root },
  ];

  const parseScalar = (raw: string): unknown => {
    const value = raw.trim();
    if (value === "" || value === "~" || value === "null") return null;
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    const quoted = /^"(.*)"$/.exec(value) ?? /^'(.*)'$/.exec(value);
    if (quoted) return quoted[1];
    if (value.startsWith("[") || value.startsWith("{")) {
      return parseInline(value);
    }
    return value;
  };

  const parseInline = (raw: string): unknown => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const inner = trimmed.slice(1, -1).trim();
      if (inner === "") return [];
      return splitTopLevel(inner, ",").map((part) => parseScalar(part));
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1).trim();
      const obj: Record<string, unknown> = {};
      if (inner === "") return obj;
      for (const part of splitTopLevel(inner, ",")) {
        const idx = part.indexOf(":");
        if (idx === -1) throw new Error(`Inline object malformato: ${part}`);
        const key = part.slice(0, idx).trim().replace(/^["']|["']$/g, "");
        obj[key] = parseScalar(part.slice(idx + 1));
      }
      return obj;
    }
    throw new Error(`Valore inline non riconosciuto: ${raw}`);
  };

  for (const line of lines) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const content = line.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1]!.value;

    if (content.startsWith("- ")) {
      // Elemento di lista
      if (!Array.isArray(parent)) {
        throw new Error(`Elemento di lista fuori da una lista: ${line}`);
      }
      const itemText = content.slice(2);
      if (itemText.startsWith("{") || itemText.startsWith("[")) {
        parent.push(parseInline(itemText));
      } else if (/^[\w-]+:/.test(itemText)) {
        // Lista di oggetti multilinea
        const obj: Record<string, unknown> = {};
        const idx = itemText.indexOf(":");
        obj[itemText.slice(0, idx).trim()] = parseScalar(itemText.slice(idx + 1));
        parent.push(obj);
        stack.push({ indent, value: obj });
      } else {
        parent.push(parseScalar(itemText));
      }
      continue;
    }

    const idx = content.indexOf(":");
    if (idx === -1) throw new Error(`Riga YAML non riconosciuta: ${line}`);
    const key = content.slice(0, idx).trim();
    const rest = content.slice(idx + 1).trim();

    if (Array.isArray(parent)) {
      // chiave: valore dentro un oggetto gia' pushato come elemento di lista
      const lastObj = parent[parent.length - 1];
      if (lastObj && typeof lastObj === "object" && !Array.isArray(lastObj)) {
        (lastObj as Record<string, unknown>)[key] = parseScalar(rest);
        continue;
      }
      throw new Error(`Chiave dentro lista senza oggetto: ${line}`);
    }

    if (rest === "") {
      // Contenitore: decidiamo lista vs oggetto guardando la prossima riga utile
      const nextLine = lines.slice(lines.indexOf(line) + 1).find((l) => l.trim() !== "");
      const isList = nextLine !== undefined && nextLine.trim().startsWith("- ");
      const container: Record<string, unknown> | unknown[] = isList ? [] : {};
      parent[key] = container;
      stack.push({ indent, value: container });
    } else {
      parent[key] = parseScalar(rest);
    }
  }

  return root;
}

/** Divide una stringa su separatori non annidati dentro [] o {}. */
function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "[" || ch === "{") depth += 1;
    if (ch === "]" || ch === "}") depth -= 1;
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim());
}

/** Estrae il contenuto testuale di <OfficialText>...</OfficialText>. */
export function extractOfficialText(body: string): string | null {
  const match = /<OfficialText[^>]*>([\s\S]*?)<\/OfficialText>/.exec(body);
  return match?.[1]?.trim() ?? null;
}

/** Estrae gli attributi dei componenti noti nel body. */
export interface ComponentOccurrence {
  name: string;
  attributes: Record<string, string>;
}

const KNOWN_COMPONENTS = [
  "OfficialText",
  "Formula",
  "NormativeTable",
  "NormativeFigure",
  "CircularCommentary",
  "EditorialNote",
  "CodeReference",
  "ReviewWarning",
];

export function extractComponents(body: string): ComponentOccurrence[] {
  const occurrences: ComponentOccurrence[] = [];
  const tagPattern = new RegExp(`<(${KNOWN_COMPONENTS.join("|")})\\s+([^>]*?)/?>`, "g");
  for (const match of body.matchAll(tagPattern)) {
    const attributes: Record<string, string> = {};
    const attrPattern = /([\w-]+)="([^"]*)"/g;
    for (const attr of match[2]!.matchAll(attrPattern)) {
      attributes[attr[1]!] = attr[2]!;
    }
    occurrences.push({ name: match[1]!, attributes });
  }
  return occurrences;
}

/**
 * Verifica che nel body non ci sia testo libero fuori dai componenti ammessi
 * (regola di sicurezza editoriale: niente contenuto non tracciato).
 * Restituisce i frammenti di testo libero trovati.
 */
export function findFreeText(body: string): string[] {
  const stripped = body
    .replace(/<(OfficialText|EditorialNote)[^>]*>[\s\S]*?<\/\1>/g, "\n")
    .replace(/<(Formula|NormativeTable|NormativeFigure|CircularCommentary|CodeReference|ReviewWarning)[^>]*?\/>/g, "\n")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "") // link markdown eventuali dentro note: non ammessi comunque
    .trim();
  if (stripped === "") return [];
  return stripped
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}
