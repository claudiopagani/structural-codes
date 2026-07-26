import type { SourceRegistryV2 } from "../../src/schema/source-registry-v2.schema.ts";
import { validateCanonicalUnitSemantics } from "./validate-canonical-unit.ts";

export const WORKFLOW_STATUSES = [
    "draft",
    "extracted",
    "source-checked",
    "double-reviewed",
    "published",
    "superseded",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

interface UnitWithWorkflow {
    workflow: {
        status: string;
    };
}

const allowedTransitions = new Map<WorkflowStatus, WorkflowStatus[]>([
    ["draft", ["extracted"]],
    ["extracted", ["source-checked"]],
    ["source-checked", ["double-reviewed"]],
    ["double-reviewed", ["published"]],
    ["published", ["superseded"]],
    ["superseded", []],
]);

export function workflowTransitionBlockers(
    value: unknown,
    target: WorkflowStatus,
    registry: SourceRegistryV2,
): string[] {
    const unit = value as UnitWithWorkflow;
    const current = unit.workflow.status as WorkflowStatus;
    if (!WORKFLOW_STATUSES.includes(current)) {
        return [`stato corrente sconosciuto: ${current}`];
    }
    if (!(allowedTransitions.get(current) ?? []).includes(target)) {
        return [`transizione non ammessa: ${current} → ${target}`];
    }
    const candidate = structuredClone(value) as UnitWithWorkflow;
    candidate.workflow.status = target;
    return validateCanonicalUnitSemantics(candidate, registry);
}
