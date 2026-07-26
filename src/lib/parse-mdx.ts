/**
 * Parsing del formato MDX legacy.
 *
 * Scelte:
 * - frontmatter YAML tra "---" iniziali, parsato con una implementazione
 *   YAML standard in modalità stretta;
 * - estrazione dei componenti MDX via regex sui tag noti.
 *
 * Il frontmatter e' la FONTE DI VERITA' per i metadati; il body e' la fonte
 * per il testo ufficiale. Gli indici JSON sono artefatti derivati.
 */
import { parseDocument } from "yaml";

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

/** Parser YAML standard e stretto usato esclusivamente per il legacy. */
export function parseSimpleYaml(yamlText: string): Record<string, unknown> {
    const document = parseDocument(yamlText, {
        strict: true,
        uniqueKeys: true,
        prettyErrors: true,
    });
    if (document.errors.length > 0) {
        throw new Error(
            `Frontmatter YAML non valido: ${document.errors
                .map((error) => error.message)
                .join("; ")}`,
        );
    }
    const value = document.toJS() as unknown;
    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ) {
        throw new Error("Il frontmatter YAML deve essere un oggetto");
    }
    return value as Record<string, unknown>;
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
