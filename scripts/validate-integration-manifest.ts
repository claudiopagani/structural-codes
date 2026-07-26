import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import type { FormatsPlugin } from "ajv-formats";

interface IntegrationManifest {
    provider: {
        packageVersion: string;
        gitCommit: string;
        entrypoint: string;
        normativeModule: string;
        normativeModuleGitBlobSha1: string;
    };
    expectedExports: string[];
    mappings: Array<{
        mappingId: string;
        exportName: string;
    }>;
}

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestFile = resolve(
    repoRoot,
    "integration",
    "structural-checks-ts",
    "manifest.json",
);
const schemaFile = resolve(repoRoot, "schemas", "integration-manifest.schema.json");
const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as IntegrationManifest;
const schema = JSON.parse(await readFile(schemaFile, "utf8")) as object;

const { Ajv2020 } = await import("ajv/dist/2020.js");
const addFormatsModule = await import("ajv-formats");
const addFormats = addFormatsModule.default as unknown as FormatsPlugin;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(manifest)) {
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exitCode = 1;
} else {
    const mappingIds = manifest.mappings.map((mapping) => mapping.mappingId);
    const unknownExports = manifest.mappings
        .map((mapping) => mapping.exportName)
        .filter((name) => !manifest.expectedExports.includes(name));
    if (new Set(mappingIds).size !== mappingIds.length) {
        console.error("integration: mappingId duplicati");
        process.exitCode = 1;
    }
    if (unknownExports.length > 0) {
        console.error(
            `integration: export non dichiarati: ${[...new Set(unknownExports)].join(", ")}`,
        );
        process.exitCode = 1;
    }
}

const providerIndex = process.argv.indexOf("--provider");
if (providerIndex !== -1) {
    const providerArg = process.argv[providerIndex + 1];
    if (providerArg === undefined) {
        throw new Error("--provider richiede un percorso");
    }
    const providerRoot = resolve(repoRoot, providerArg);
    const packageJson = JSON.parse(
        await readFile(resolve(providerRoot, "package.json"), "utf8"),
    ) as { version?: string };
    const gitCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: providerRoot,
        encoding: "utf8",
    }).trim();
    const moduleBlob = execFileSync(
        "git",
        ["hash-object", manifest.provider.normativeModule],
        {
            cwd: providerRoot,
            encoding: "utf8",
        },
    ).trim();
    const api = (await import(
        pathToFileURL(resolve(providerRoot, manifest.provider.entrypoint)).href
    )) as Record<string, unknown>;
    const missingExports = manifest.expectedExports.filter(
        (name) => !(name in api),
    );
    if (packageJson.version !== manifest.provider.packageVersion) {
        console.error(
            `integration: versione provider ${String(packageJson.version)} diversa dal manifest ${manifest.provider.packageVersion}`,
        );
        process.exitCode = 1;
    }
    if (gitCommit !== manifest.provider.gitCommit) {
        console.error(
            `integration: commit provider ${gitCommit} diverso dal manifest ${manifest.provider.gitCommit}`,
        );
        process.exitCode = 1;
    }
    if (moduleBlob !== manifest.provider.normativeModuleGitBlobSha1) {
        console.error(
            `integration: modulo vento modificato (${moduleBlob}) rispetto al blob registrato`,
        );
        process.exitCode = 1;
    }
    if (missingExports.length > 0) {
        console.error(
            `integration: export mancanti nel provider: ${missingExports.join(", ")}`,
        );
        process.exitCode = 1;
    }
    if (process.exitCode !== 1) {
        console.log(
            `integration: provider verificato (${manifest.expectedExports.length} export, commit ${gitCommit})`,
        );
    }
} else if (process.exitCode !== 1) {
    console.log(
        `integration: manifest valido (${manifest.mappings.length} mapping proposti)`,
    );
}
