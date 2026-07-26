import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { splitFrontmatter } from "../../src/lib/parse-mdx.ts";
import { sha256OfFile } from "../../src/lib/hash.ts";
import { normativeUnitSchema } from "../../src/schema/unit.schema.ts";

interface FoundFile {
    absolutePath: string;
    relativePath: string;
}

interface TargetOccurrence {
    sourceId: string | null;
    targetId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function increment(target: Record<string, number>, key: string): void {
    target[key] = (target[key] ?? 0) + 1;
}

function sortCountRecord(target: Record<string, number>): Record<string, number> {
    return Object.fromEntries(
        Object.entries(target).sort(([left], [right]) => left.localeCompare(right)),
    );
}

async function walkAllFiles(root: string, repoRoot: string): Promise<FoundFile[]> {
    const result: FoundFile[] = [];

    async function visit(current: string): Promise<void> {
        let entries;
        try {
            entries = await readdir(current, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const absolutePath = join(current, entry.name);
            if (entry.isDirectory()) {
                await visit(absolutePath);
            } else if (entry.isFile()) {
                result.push({
                    absolutePath,
                    relativePath: relative(repoRoot, absolutePath).replaceAll("\\", "/"),
                });
            }
        }
    }

    await visit(root);
    return result.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function frontmatterText(raw: string): string | null {
    return /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw)?.[1] ?? null;
}

function topLevelScalar(frontmatter: string, key: string): string | null {
    const value = topLevelValue(frontmatter, key).trim();
    if (value === "") return null;
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }
    return value;
}

function topLevelValue(frontmatter: string, key: string): string {
    const match = new RegExp(`(?:^|;[ \\t]*)${key}:[ \\t]*`, "m").exec(frontmatter);
    if (match === null) return "";

    let cursor = match.index + match[0].length;
    if (frontmatter[cursor] === "[") {
        const start = cursor;
        let depth = 0;
        let quote: "'" | '"' | null = null;
        for (; cursor < frontmatter.length; cursor += 1) {
            const character = frontmatter[cursor]!;
            if (quote !== null) {
                if (character === quote && frontmatter[cursor - 1] !== "\\") quote = null;
                continue;
            }
            if (character === "'" || character === '"') {
                quote = character;
            } else if (character === "[") {
                depth += 1;
            } else if (character === "]") {
                depth -= 1;
                if (depth === 0) return frontmatter.slice(start, cursor + 1);
            }
        }
        return frontmatter.slice(start);
    }

    if (frontmatter[cursor] === "\r") cursor += 1;
    if (frontmatter[cursor] === "\n") {
        cursor += 1;
        const remainder = frontmatter.slice(cursor);
        const lines = remainder.split(/\r?\n/);
        const block: string[] = [];
        for (const line of lines) {
            if (line.trim() !== "" && !/^\s/.test(line)) break;
            block.push(line);
        }
        return block.join("\n");
    }

    const end = frontmatter.slice(cursor).search(/[;\r\n]/);
    return end === -1 ? frontmatter.slice(cursor) : frontmatter.slice(cursor, cursor + end);
}

function yamlIdList(frontmatter: string, key: string): string[] {
    const value = topLevelValue(frontmatter, key);
    return [...value.matchAll(/"([^"]+)"|'([^']+)'/g)]
        .map((match) => (match[1] ?? match[2] ?? "").trim())
        .filter((item) => item !== "");
}

function targetsInBlock(
    frontmatter: string,
    key: string,
    sourceId: string | null,
): TargetOccurrence[] {
    const value = topLevelValue(frontmatter, key);
    return [...value.matchAll(/targetId:\s*(?:"([^"]+)"|'([^']+)'|([^,}\s]+))/g)].map(
        (match) => ({
            sourceId,
            targetId: (match[1] ?? match[2] ?? match[3] ?? "").trim(),
        }),
    );
}

function extractModel(frontmatter: string): string | null {
    const block = topLevelValue(frontmatter, "workflow");
    const match = /convertedBy:\s*\{[^}]*model:\s*(?:"([^"]+)"|'([^']+)'|([^,}\s]+))/m.exec(block);
    return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim() || null;
}

function extractNestedScalar(frontmatter: string, parent: string, key: string): string | null {
    const block = topLevelValue(frontmatter, parent);
    const match = new RegExp(
        `(?:^\\s*|[{,][ \\t]*)${key}:[ \\t]*(?:"([^"]*)"|'([^']*)'|([^,}\\r\\n#]*))`,
        "m",
    ).exec(block);
    return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim() || null;
}

function duplicateGroups(values: Array<{ value: string; file: string }>): Array<{
    value: string;
    files: string[];
}> {
    const grouped = new Map<string, string[]>();
    for (const item of values) {
        const files = grouped.get(item.value) ?? [];
        files.push(item.file);
        grouped.set(item.value, files);
    }

    return [...grouped.entries()]
        .filter(([, files]) => files.length > 1)
        .map(([value, files]) => ({ value, files: files.sort() }))
        .sort((left, right) => left.value.localeCompare(right.value));
}

async function fingerprint(files: FoundFile[]): Promise<string> {
    const hash = createHash("sha256");
    for (const file of files) {
        hash.update(file.relativePath, "utf8");
        hash.update("\0");
        hash.update(await readFile(file.absolutePath));
        hash.update("\0");
    }
    return hash.digest("hex");
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort();
}

export async function buildLegacyBaseline(repoRoot: string): Promise<Record<string, unknown>> {
    const contentFiles = (await walkAllFiles(join(repoRoot, "content"), repoRoot)).filter((file) =>
        file.relativePath.endsWith(".mdx"),
    );
    const assetFiles = await walkAllFiles(join(repoRoot, "assets"), repoRoot);
    const mappingFiles = (await walkAllFiles(join(repoRoot, "mappings"), repoRoot)).filter((file) =>
        file.relativePath.endsWith(".json"),
    );
    const sourceRegistryPath = join(repoRoot, "sources", "sources.json");
    const fingerprintFiles = [
        ...(await walkAllFiles(join(repoRoot, "content"), repoRoot)),
        ...assetFiles,
        ...mappingFiles,
        {
            absolutePath: sourceRegistryPath,
            relativePath: "sources/sources.json",
        },
    ].sort((left, right) => left.relativePath.localeCompare(right.relativePath));

    const ids: Array<{ value: string; file: string }> = [];
    const slugs: Array<{ value: string; file: string }> = [];
    const knownIds = new Set<string>();
    const reliability: Record<string, number> = {};
    const workflowStatuses: Record<string, number> = {};
    const convertedByModels: Record<string, number> = {};
    const convertedAtValues: Record<string, number> = {};
    const validityFromValues: Record<string, number> = {};
    const markerCounts: Record<string, number> = {};
    const refsOut: TargetOccurrence[] = [];
    const relations: TargetOccurrence[] = [];
    const formulaFrontmatterDeclarations: string[] = [];
    const tableFrontmatterDeclarations: string[] = [];
    const figureFrontmatterDeclarations: string[] = [];
    const formulaBodyUsages: string[] = [];
    const tableBodyUsages: string[] = [];
    const figureBodyUsages: string[] = [];
    const parseFailures: Array<{ file: string; message: string }> = [];
    const schemaIssueCounts: Record<string, number> = {};
    const schemaIssueSamples: Array<{ file: string; path: string; message: string }> = [];
    const byDocument: Record<string, number> = {};
    let parsedFrontmatter = 0;
    let schemaValidUnits = 0;
    let officialTextBlocks = 0;
    let officialTextBlocksWithMarkers = 0;
    let daVerificareOccurrences = 0;

    for (const file of contentFiles) {
        const raw = await readFile(file.absolutePath, "utf8");
        const documentKey = file.relativePath.split("/")[1] ?? "unknown";
        increment(byDocument, documentKey);

        for (const match of raw.matchAll(/\[([A-Z][A-Z0-9_]+)(?::[^\]]*)?\]/g)) {
            increment(markerCounts, match[1]!);
        }
        daVerificareOccurrences += [...raw.matchAll(/\[DA_VERIFICARE[^\]]*\]/g)].length;

        const officialBlocks = [...raw.matchAll(/<OfficialText[^>]*>([\s\S]*?)<\/OfficialText>/g)];
        officialTextBlocks += officialBlocks.length;
        officialTextBlocksWithMarkers += officialBlocks.filter((match) =>
            /\[[A-Z][A-Z0-9_]+(?:[^\]]*)\]/.test(match[1] ?? ""),
        ).length;
        formulaBodyUsages.push(
            ...[...raw.matchAll(/<Formula\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]!),
        );
        tableBodyUsages.push(
            ...[...raw.matchAll(/<NormativeTable\b[^>]*\bid="([^"]+)"/g)].map(
                (match) => match[1]!,
            ),
        );
        figureBodyUsages.push(
            ...[...raw.matchAll(/<NormativeFigure\b[^>]*\bid="([^"]+)"/g)].map(
                (match) => match[1]!,
            ),
        );

        const yaml = frontmatterText(raw);
        if (yaml === null) {
            parseFailures.push({ file: file.relativePath, message: "frontmatter non rilevato" });
            continue;
        }

        const id = topLevelScalar(yaml, "id");
        const slug = topLevelScalar(yaml, "slug");
        if (id !== null) {
            ids.push({ value: id, file: file.relativePath });
            knownIds.add(id);
        }
        if (slug !== null) slugs.push({ value: slug, file: file.relativePath });

        increment(reliability, topLevelScalar(yaml, "reliability") ?? "(missing)");
        increment(workflowStatuses, extractNestedScalar(yaml, "workflow", "status") ?? "(missing)");
        increment(convertedByModels, extractModel(yaml) ?? "(missing-or-null)");
        increment(convertedAtValues, extractNestedScalar(yaml, "workflow", "convertedAt") ?? "(missing)");

        const validityMatch = /^validity:\s*\{\s*from:\s*(?:"([^"]+)"|'([^']+)'|([^,}\s]+))/m.exec(yaml);
        increment(
            validityFromValues,
            (validityMatch?.[1] ?? validityMatch?.[2] ?? validityMatch?.[3] ?? "(missing)").trim(),
        );

        refsOut.push(...targetsInBlock(yaml, "refsOut", id));
        relations.push(...targetsInBlock(yaml, "relations", id));
        formulaFrontmatterDeclarations.push(...yamlIdList(yaml, "formulas"));
        tableFrontmatterDeclarations.push(...yamlIdList(yaml, "tables"));
        figureFrontmatterDeclarations.push(...yamlIdList(yaml, "figures"));

        try {
            const parsed = splitFrontmatter(raw);
            parsedFrontmatter += 1;
            const result = normativeUnitSchema.safeParse(parsed.frontmatter);
            if (result.success) {
                schemaValidUnits += 1;
            } else {
                for (const issue of result.error.issues) {
                    increment(schemaIssueCounts, issue.path.join(".") || "(root)");
                    if (schemaIssueSamples.length < 25) {
                        schemaIssueSamples.push({
                            file: file.relativePath,
                            path: issue.path.join(".") || "(root)",
                            message: issue.message,
                        });
                    }
                }
            }
        } catch (error) {
            parseFailures.push({
                file: file.relativePath,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    const descriptorIds: Record<string, string[]> = {
        formulas: [],
        tables: [],
        figures: [],
    };
    const assetFilesByKind: Record<string, number> = {
        formulas: 0,
        tables: 0,
        figures: 0,
        other: 0,
    };

    for (const file of assetFiles) {
        const kind =
            file.relativePath.startsWith("assets/formulas/")
                ? "formulas"
                : file.relativePath.startsWith("assets/tables/")
                  ? "tables"
                  : file.relativePath.startsWith("assets/figures/")
                    ? "figures"
                    : "other";
        increment(assetFilesByKind, kind);
        if (!file.relativePath.endsWith(".json") || kind === "other") continue;
        try {
            const parsed: unknown = JSON.parse(await readFile(file.absolutePath, "utf8"));
            if (isRecord(parsed) && typeof parsed.id === "string") descriptorIds[kind]!.push(parsed.id);
        } catch {
            // I validator correnti descrivono separatamente gli errori JSON/schema.
        }
    }

    const mappingLinks: Array<{
        file: string;
        ntcUnitId: string | null;
        circUnitId: string | null;
        confirmation: string | null;
    }> = [];
    let malformedMappingFiles = 0;

    for (const file of mappingFiles) {
        try {
            const parsed: unknown = JSON.parse(await readFile(file.absolutePath, "utf8"));
            if (!isRecord(parsed) || !Array.isArray(parsed.links)) {
                malformedMappingFiles += 1;
                continue;
            }
            for (const value of parsed.links) {
                if (!isRecord(value)) continue;
                mappingLinks.push({
                    file: file.relativePath,
                    ntcUnitId: typeof value.ntcUnitId === "string" ? value.ntcUnitId : null,
                    circUnitId: typeof value.circUnitId === "string" ? value.circUnitId : null,
                    confirmation:
                        typeof value.confirmation === "string" ? value.confirmation : null,
                });
            }
        } catch {
            malformedMappingFiles += 1;
        }
    }

    const mappingConfirmation: Record<string, number> = {};
    for (const link of mappingLinks) {
        increment(mappingConfirmation, link.confirmation ?? "(missing)");
    }
    const mappingEndpoints = mappingLinks.flatMap((link) =>
        [link.ntcUnitId, link.circUnitId].filter((value): value is string => value !== null),
    );
    const danglingMappingEndpoints = mappingEndpoints.filter((id) => !knownIds.has(id));

    const sourceRecords: Array<Record<string, unknown>> = [];
    let sourceRegistry: unknown;
    try {
        sourceRegistry = JSON.parse(await readFile(sourceRegistryPath, "utf8")) as unknown;
    } catch {
        sourceRegistry = null;
    }

    if (isRecord(sourceRegistry) && Array.isArray(sourceRegistry.sources)) {
        for (const value of sourceRegistry.sources) {
            if (!isRecord(value)) continue;
            const localFile = typeof value.localFile === "string" ? value.localFile : null;
            const registeredHash = typeof value.pdfSha256 === "string" ? value.pdfSha256 : null;
            const absolutePath = localFile === null ? null : resolve(repoRoot, localFile);
            const exists = absolutePath !== null && (await fileExists(absolutePath));
            const actualHash = exists && absolutePath !== null ? await sha256OfFile(absolutePath) : null;
            const actualBytes =
                exists && absolutePath !== null ? (await stat(absolutePath)).size : null;
            const registeredBytes =
                typeof value.pdfBytes === "number" ? value.pdfBytes : null;
            const manualVerification = isRecord(value.manualVerification)
                ? value.manualVerification
                : null;

            sourceRecords.push({
                sourceId: typeof value.sourceId === "string" ? value.sourceId : null,
                url: typeof value.url === "string" ? value.url : null,
                localFile,
                exists,
                registeredSha256: registeredHash,
                actualSha256: actualHash,
                hashMatches: registeredHash !== null && actualHash === registeredHash,
                registeredBytes,
                actualBytes,
                bytesMatch: registeredBytes !== null && actualBytes === registeredBytes,
                manuallyVerified:
                    manualVerification?.by !== null &&
                    manualVerification?.by !== undefined &&
                    manualVerification?.at !== null &&
                    manualVerification?.at !== undefined,
            });
        }
    }

    const formulaIds = uniqueSorted(descriptorIds.formulas!);
    const tableIds = uniqueSorted(descriptorIds.tables!);
    const figureIds = uniqueSorted(descriptorIds.figures!);
    const frontmatterFormulaIds = uniqueSorted(formulaFrontmatterDeclarations);
    const frontmatterTableIds = uniqueSorted(tableFrontmatterDeclarations);
    const frontmatterFigureIds = uniqueSorted(figureFrontmatterDeclarations);
    const bodyFormulaIds = uniqueSorted(formulaBodyUsages);
    const bodyTableIds = uniqueSorted(tableBodyUsages);
    const bodyFigureIds = uniqueSorted(figureBodyUsages);
    const declaredFormulaIds = uniqueSorted([
        ...formulaFrontmatterDeclarations,
        ...formulaBodyUsages,
    ]);
    const declaredTableIds = uniqueSorted([
        ...tableFrontmatterDeclarations,
        ...tableBodyUsages,
    ]);
    const declaredFigureIds = uniqueSorted([
        ...figureFrontmatterDeclarations,
        ...figureBodyUsages,
    ]);

    return {
        reportVersion: 1,
        scope: "legacy",
        status: "quarantined-unverified",
        deterministic: true,
        sourceTreeFingerprintSha256: await fingerprint(fingerprintFiles),
        inventory: {
            content: {
                mdxFiles: contentFiles.length,
                byDocument: sortCountRecord(byDocument),
                declaredIds: ids.length,
                uniqueIds: knownIds.size,
                duplicateIds: duplicateGroups(ids),
                declaredSlugs: slugs.length,
                uniqueSlugs: new Set(slugs.map((item) => item.value)).size,
                duplicateSlugs: duplicateGroups(slugs),
            },
            parsing: {
                parsedFrontmatter,
                parseFailures,
                schemaValidUnits,
                schemaInvalidUnits: parsedFrontmatter - schemaValidUnits,
                schemaIssueCounts: sortCountRecord(schemaIssueCounts),
                schemaIssueSamples,
            },
            metadata: {
                reliability: sortCountRecord(reliability),
                workflowStatuses: sortCountRecord(workflowStatuses),
                convertedByModels: sortCountRecord(convertedByModels),
                convertedAtValues: sortCountRecord(convertedAtValues),
                validityFromValues: sortCountRecord(validityFromValues),
            },
            text: {
                officialTextBlocks,
                officialTextBlocksWithMarkers,
                daVerificareOccurrences,
                markerCounts: sortCountRecord(markerCounts),
            },
        },
        graph: {
            references: {
                total: refsOut.length + relations.length,
                dangling:
                    refsOut.filter((ref) => !knownIds.has(ref.targetId)).length +
                    relations.filter((relation) => !knownIds.has(relation.targetId)).length,
            },
            refsOut: {
                total: refsOut.length,
                dangling: refsOut.filter((ref) => !knownIds.has(ref.targetId)).length,
                danglingTargets: uniqueSorted(
                    refsOut.filter((ref) => !knownIds.has(ref.targetId)).map((ref) => ref.targetId),
                ),
            },
            relations: {
                total: relations.length,
                dangling: relations.filter((relation) => !knownIds.has(relation.targetId)).length,
                danglingTargets: uniqueSorted(
                    relations
                        .filter((relation) => !knownIds.has(relation.targetId))
                        .map((relation) => relation.targetId),
                ),
            },
            mappings: {
                files: mappingFiles.length,
                malformedFiles: malformedMappingFiles,
                links: mappingLinks.length,
                endpoints: mappingEndpoints.length,
                danglingEndpoints: danglingMappingEndpoints.length,
                danglingTargets: uniqueSorted(danglingMappingEndpoints),
                confirmation: sortCountRecord(mappingConfirmation),
            },
        },
        assets: {
            filesByKind: sortCountRecord(assetFilesByKind),
            formulas: {
                frontmatterDeclarations: formulaFrontmatterDeclarations.length,
                bodyUsages: formulaBodyUsages.length,
                uniqueFrontmatterDeclarations: frontmatterFormulaIds.length,
                uniqueBodyUsages: bodyFormulaIds.length,
                uniqueAcrossFrontmatterAndBody: declaredFormulaIds.length,
                frontmatterOnly: frontmatterFormulaIds.filter((id) => !bodyFormulaIds.includes(id)),
                bodyOnly: bodyFormulaIds.filter((id) => !frontmatterFormulaIds.includes(id)),
                descriptors: formulaIds.length,
                missingDescriptors: declaredFormulaIds.filter((id) => !formulaIds.includes(id)),
                orphanDescriptors: formulaIds.filter((id) => !declaredFormulaIds.includes(id)),
            },
            tables: {
                frontmatterDeclarations: tableFrontmatterDeclarations.length,
                bodyUsages: tableBodyUsages.length,
                uniqueFrontmatterDeclarations: frontmatterTableIds.length,
                uniqueBodyUsages: bodyTableIds.length,
                uniqueAcrossFrontmatterAndBody: declaredTableIds.length,
                frontmatterOnly: frontmatterTableIds.filter((id) => !bodyTableIds.includes(id)),
                bodyOnly: bodyTableIds.filter((id) => !frontmatterTableIds.includes(id)),
                descriptors: tableIds.length,
                missingDescriptors: declaredTableIds.filter((id) => !tableIds.includes(id)),
                orphanDescriptors: tableIds.filter((id) => !declaredTableIds.includes(id)),
            },
            figures: {
                frontmatterDeclarations: figureFrontmatterDeclarations.length,
                bodyUsages: figureBodyUsages.length,
                uniqueFrontmatterDeclarations: frontmatterFigureIds.length,
                uniqueBodyUsages: bodyFigureIds.length,
                uniqueAcrossFrontmatterAndBody: declaredFigureIds.length,
                frontmatterOnly: frontmatterFigureIds.filter((id) => !bodyFigureIds.includes(id)),
                bodyOnly: bodyFigureIds.filter((id) => !frontmatterFigureIds.includes(id)),
                descriptors: figureIds.length,
                missingDescriptors: declaredFigureIds.filter((id) => !figureIds.includes(id)),
                orphanDescriptors: figureIds.filter((id) => !declaredFigureIds.includes(id)),
            },
        },
        sources: {
            registryReadable: sourceRegistry !== null,
            records: sourceRecords,
        },
    };
}
