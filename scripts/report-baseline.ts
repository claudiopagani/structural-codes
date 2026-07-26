import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLegacyBaseline } from "./lib/legacy-baseline.ts";

interface CommandResult {
    command: string;
    status: "passed" | "failed";
    exitCode: number;
    summary: Record<string, number> | null;
}

interface BaselineView {
    sourceTreeFingerprintSha256: string;
    environment: {
        node: string;
        platform: string;
        architecture: string;
        npmUserAgent: string | null;
    };
    inventory: {
        content: {
            mdxFiles: number;
            declaredIds: number;
            uniqueIds: number;
            duplicateIds: unknown[];
        };
        parsing: {
            parsedFrontmatter: number;
            parseFailures: unknown[];
            schemaValidUnits: number;
            schemaInvalidUnits: number;
        };
        metadata: {
            reliability: Record<string, number>;
        };
    };
    graph: {
        references: { total: number; dangling: number };
        refsOut: { total: number; dangling: number };
        relations: { total: number; dangling: number };
        mappings: {
            links: number;
            endpoints: number;
            danglingEndpoints: number;
            confirmation: Record<string, number>;
        };
    };
    assets: {
        formulas: {
            uniqueFrontmatterDeclarations: number;
            uniqueBodyUsages: number;
            uniqueAcrossFrontmatterAndBody: number;
            descriptors: number;
        };
        tables: {
            uniqueFrontmatterDeclarations: number;
            uniqueBodyUsages: number;
            uniqueAcrossFrontmatterAndBody: number;
            descriptors: number;
        };
        figures: {
            uniqueFrontmatterDeclarations: number;
            uniqueBodyUsages: number;
            uniqueAcrossFrontmatterAndBody: number;
            descriptors: number;
        };
    };
    sources: {
        records: Array<{
            sourceId: string | null;
            exists: boolean;
            hashMatches: boolean;
            bytesMatch: boolean;
            manuallyVerified: boolean;
        }>;
    };
    checks: Record<string, CommandResult>;
}

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const defaultOutput = join(repoRoot, "reports", "validation", "baseline.json");

function stripAnsi(value: string): string {
    return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function numericCaptures(
    output: string,
    pattern: RegExp,
    keys: string[],
): Record<string, number> | null {
    const match = pattern.exec(output);
    if (match === null) return null;
    return Object.fromEntries(
        keys.map((key, index) => [key, Number(match[index + 1])]),
    );
}

function summarize(script: string, output: string): Record<string, number> | null {
    if (script === "validate:schema") {
        return numericCaptures(
            output,
            /validate-schema:\s*(\d+) file controllati,\s*(\d+) errori,\s*(\d+) warning/,
            ["files", "errors", "warnings"],
        );
    }
    if (script === "validate:ids") {
        return numericCaptures(
            output,
            /validate-ids:\s*(\d+) unita' controllate,\s*(\d+) errori,\s*(\d+) warning/,
            ["units", "errors", "warnings"],
        );
    }
    if (script === "test") {
        return numericCaptures(
            output,
            /# tests\s+(\d+)[\s\S]*?# pass\s+(\d+)[\s\S]*?# fail\s+(\d+)/,
            ["tests", "passed", "failed"],
        );
    }
    return null;
}

async function runNpmScript(script: string): Promise<CommandResult> {
    const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(npmExecutable, ["run", "--silent", script], {
        cwd: repoRoot,
        env: process.env,
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
        output += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
        output += chunk;
    });

    const exitCode = await new Promise<number>((resolvePromise, rejectPromise) => {
        child.on("error", rejectPromise);
        child.on("close", (code) => resolvePromise(code ?? 1));
    });
    const cleanOutput = stripAnsi(output);

    return {
        command: `npm run ${script}`,
        status: exitCode === 0 ? "passed" : "failed",
        exitCode,
        summary: summarize(script, cleanOutput),
    };
}

function argumentValue(name: string): string | null {
    const index = process.argv.indexOf(name);
    return index === -1 ? null : process.argv[index + 1] ?? null;
}

function displaySummary(check: CommandResult): string {
    if (check.summary === null) return "—";
    return Object.entries(check.summary)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
}

function renderMarkdown(report: BaselineView): string {
    const rows = Object.entries(report.checks)
        .map(
            ([name, check]) =>
                `| \`${name}\` | ${check.status === "passed" ? "PASS" : "FAIL"} | ${check.exitCode} | ${displaySummary(check)} |`,
        )
        .join("\n");
    const sourceRows = report.sources.records
        .map(
            (source) =>
                `| \`${source.sourceId ?? "(missing)"}\` | ${source.exists ? "sì" : "no"} | ${source.hashMatches ? "sì" : "no"} | ${source.bytesMatch ? "sì" : "no"} | ${source.manuallyVerified ? "sì" : "no"} |`,
        )
        .join("\n");
    const mappingConfirmed = report.graph.mappings.confirmation.confirmed ?? 0;
    const formula = report.assets.formulas;
    const table = report.assets.tables;
    const figure = report.assets.figures;

    return `# Baseline del corpus legacy

> Stato: **quarantined-unverified**  
> Report deterministico: rigenerare con \`npm run baseline\`  
> Fingerprint: \`${report.sourceTreeFingerprintSha256}\`

Questa fotografia non certifica il corpus. Registra in modo riproducibile il
legacy e i fallimenti noti, così ogni cambiamento diventa esplicito.

## Ambiente

- Node.js: \`${report.environment.node}\`
- Piattaforma: \`${report.environment.platform}-${report.environment.architecture}\`
- Package manager: \`${report.environment.npmUserAgent ?? "(non rilevato)"}\`

## Inventario

- File MDX: ${report.inventory.content.mdxFiles}
- ID dichiarati: ${report.inventory.content.declaredIds}
- ID univoci: ${report.inventory.content.uniqueIds}
- Gruppi di ID duplicati: ${report.inventory.content.duplicateIds.length}
- Frontmatter parsati dal parser legacy: ${report.inventory.parsing.parsedFrontmatter}
- Frontmatter non parsati dal parser legacy: ${report.inventory.parsing.parseFailures.length}
- Unità conformi allo schema legacy: ${report.inventory.parsing.schemaValidUnits}
- Unità non conformi tra quelle parsate: ${report.inventory.parsing.schemaInvalidUnits}
- Affidabilità dichiarata \`unverified\`: ${report.inventory.metadata.reliability.unverified ?? 0}

## Riferimenti e mapping

- Riferimenti complessivi: ${report.graph.references.total}
- Riferimenti pendenti: ${report.graph.references.dangling}
- \`refsOut\`: ${report.graph.refsOut.total}, di cui ${report.graph.refsOut.dangling} pendenti
- Relazioni: ${report.graph.relations.total}, di cui ${report.graph.relations.dangling} pendenti
- Mapping NTC ↔ Circolare: ${report.graph.mappings.links} link / ${report.graph.mappings.endpoints} endpoint
- Endpoint di mapping pendenti: ${report.graph.mappings.danglingEndpoints}
- Mapping confermati: ${mappingConfirmed}

## Asset

| Tipo | ID univoci nel frontmatter | ID usati nel body | Unione | Descrittori |
|---|---:|---:|---:|---:|
| Formule | ${formula.uniqueFrontmatterDeclarations} | ${formula.uniqueBodyUsages} | ${formula.uniqueAcrossFrontmatterAndBody} | ${formula.descriptors} |
| Tabelle | ${table.uniqueFrontmatterDeclarations} | ${table.uniqueBodyUsages} | ${table.uniqueAcrossFrontmatterAndBody} | ${table.descriptors} |
| Figure | ${figure.uniqueFrontmatterDeclarations} | ${figure.uniqueBodyUsages} | ${figure.uniqueAcrossFrontmatterAndBody} | ${figure.descriptors} |

Le differenze tra frontmatter e body sono mantenute visibili: l'unione non
implica che tutti gli elementi siano corretti o realmente presenti nella fonte.

## Fonti locali

| Fonte | File presente | Hash corrisponde | Dimensione corrisponde | Verifica manuale |
|---|---|---|---|---|
${sourceRows}

## Controlli esistenti

| Controllo | Esito | Exit code | Sintesi |
|---|---|---:|---|
${rows}

I fallimenti sono attesi nello stato corrente e costituiscono parte della
baseline. Una futura pipeline pubblicabile dovrà trasformarli in gate verdi,
non rimuoverli o ignorarli.
`;
}

const checkOnly = process.argv.includes("--check");
const requestedOutput = argumentValue("--output");
const outputFile =
    requestedOutput === null ? defaultOutput : join(repoRoot, requestedOutput);
const markdownOutputFile = outputFile.toLowerCase().endsWith(".json")
    ? `${outputFile.slice(0, -5)}.md`
    : `${outputFile}.md`;

console.log("baseline: inventario del corpus legacy...");
const report = await buildLegacyBaseline(repoRoot);

console.log("baseline: esecuzione dei controlli esistenti...");
const checks = Object.fromEntries(
    await Promise.all(
        ["validate:schema", "validate:ids", "test", "typecheck", "lint"].map(
            async (script) => [script, await runNpmScript(script)] as const,
        ),
    ),
);

const completeReport = {
    ...report,
    environment: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        npmUserAgent: process.env.npm_config_user_agent ?? null,
    },
    checks,
};
const serialized = `${JSON.stringify(completeReport, null, 2)}\n`;
const serializedMarkdown = renderMarkdown(completeReport as unknown as BaselineView);

if (checkOnly) {
    let currentJson: string;
    let currentMarkdown: string;
    try {
        [currentJson, currentMarkdown] = await Promise.all([
            readFile(outputFile, "utf8"),
            readFile(markdownOutputFile, "utf8"),
        ]);
    } catch {
        console.error(
            `baseline: report assente; attesi ${outputFile} e ${markdownOutputFile}`,
        );
        process.exitCode = 1;
        currentJson = "";
        currentMarkdown = "";
    }
    if (
        currentJson !== "" &&
        (currentJson !== serialized || currentMarkdown !== serializedMarkdown)
    ) {
        console.error(
            "baseline: il corpus legacy è cambiato. Verificare la modifica e rigenerare con npm run baseline.",
        );
        process.exitCode = 1;
    } else if (currentJson === serialized && currentMarkdown === serializedMarkdown) {
        console.log("baseline: fotografia invariata.");
    }
} else {
    await mkdir(dirname(outputFile), { recursive: true });
    await Promise.all([
        writeFile(outputFile, serialized, "utf8"),
        writeFile(markdownOutputFile, serializedMarkdown, "utf8"),
    ]);
    console.log(`baseline: report scritti in ${outputFile} e ${markdownOutputFile}`);
}
