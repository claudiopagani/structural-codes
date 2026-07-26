import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceRegistryV2Schema } from "../src/schema/source-registry-v2.schema.ts";
import {
    WORKFLOW_STATUSES,
    workflowTransitionBlockers,
    type WorkflowStatus,
} from "./lib/workflow.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function argument(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

const unitArg = argument("--unit");
const targetArg = argument("--to");
if (unitArg === undefined || targetArg === undefined) {
    console.error(
        `Uso: check-workflow-transition --unit <record.json> --to <${WORKFLOW_STATUSES.join("|")}>`,
    );
    process.exit(2);
}
if (!(WORKFLOW_STATUSES as readonly string[]).includes(targetArg)) {
    throw new Error(`stato target non valido: ${targetArg}`);
}
const unitFile = resolve(repoRoot, unitArg);
if (!unitFile.startsWith(resolve(repoRoot) + sep)) {
    throw new Error("--unit deve essere interno al repository");
}
const [unit, registry] = await Promise.all([
    readFile(unitFile, "utf8").then((raw) => JSON.parse(raw) as unknown),
    readFile(
        resolve(repoRoot, "sources", "registry", "sources.v2.json"),
        "utf8",
    ).then((raw) => sourceRegistryV2Schema.parse(JSON.parse(raw) as unknown)),
]);
const blockers = workflowTransitionBlockers(
    unit,
    targetArg as WorkflowStatus,
    registry,
);
if (blockers.length === 0) {
    console.log(`Transizione tecnicamente consentita verso ${targetArg}.`);
    console.log("Questo controllo non aggiunge né sostituisce una review umana.");
} else {
    console.error(`Transizione bloccata verso ${targetArg}:`);
    for (const blocker of blockers) console.error(`  - ${blocker}`);
    process.exitCode = 1;
}
