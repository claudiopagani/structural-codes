import { sha256OfText } from "../../src/lib/hash.ts";
import type { SourceRegistryV2 } from "../../src/schema/source-registry-v2.schema.ts";

interface Evidence {
    sourceId: string;
    pdfPage: number;
    region: unknown;
    rawSha256: string;
    normalizedSha256: string;
}

interface CanonicalBlock {
    blockId: string;
    kind: string;
    origin: "official" | "editorial";
    text?: {
        raw: string;
        normalized: string;
        inline?: Array<{
            kind: "text" | "math";
            value: string;
            latex?: string;
        }>;
    } | string;
    assetId?: string;
    evidence?: Evidence;
}

interface Citation {
    citationId: string;
    sourceBlockId: string;
    span: { start: number; end: number };
    rawText: string;
    target:
        | { kind: "internal-unit"; unitId: string }
        | { kind: "external"; uri: string; label: string };
    resolution: string;
}

interface Relation {
    relationId: string;
    targetUnitId: string;
    evidenceBlockIds: string[];
    review: {
        status: string;
        reviewedBy: { actorId: string; kind: string } | null;
        reviewedAt: string | null;
    };
}

interface Review {
    type: string;
    reviewer: {
        actorId: string;
        kind: string;
    };
    result: string;
}

interface CanonicalUnit {
    id: string;
    workId: string;
    expressionId: string;
    titleBlockId: string;
    hierarchy: {
        parentId: string | null;
        ancestorIds: string[];
    };
    validity: {
        from: string | null;
        to: string | null;
        asOf: string;
    };
    blocks: CanonicalBlock[];
    citations: Citation[];
    relations: Relation[];
    assets: {
        formulaIds: string[];
        tableIds: string[];
        figureIds: string[];
    };
    workflow: {
        status: string;
        createdBy: {
            actorId: string;
            kind: string;
        };
        reviews: Review[];
        openIssues: Array<{
            severity: string;
        }>;
    };
    integrity?: {
        canonicalization: string;
        sha256: string;
    };
}

function duplicateValues(values: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const value of values) {
        if (seen.has(value)) duplicates.add(value);
        seen.add(value);
    }
    return [...duplicates].sort();
}

function isTextPayload(
    value: CanonicalBlock["text"],
): value is { raw: string; normalized: string } {
    return typeof value === "object" && value !== null;
}

export function validateCanonicalUnitSemantics(
    value: unknown,
    registry: SourceRegistryV2,
    knownUnitIds?: ReadonlySet<string>,
): string[] {
    const unit = value as CanonicalUnit;
    const errors: string[] = [];

    if (JSON.stringify(unit).includes("[DA_VERIFICARE")) {
        errors.push("placeholder [DA_VERIFICARE] non ammesso nel canonico v2");
    }

    const work = registry.works.find((item) => item.workId === unit.workId);
    if (work === undefined) {
        errors.push(`workId non registrato: ${unit.workId}`);
    } else if (!work.expressions.some((item) => item.expressionId === unit.expressionId)) {
        errors.push(`expressionId non appartenente al work: ${unit.expressionId}`);
    }

    const knownSourceIds = new Set(
        registry.works.flatMap((item) =>
            item.manifestations.map((manifestation) => manifestation.sourceId),
        ),
    );
    const blockIds = unit.blocks.map((block) => block.blockId);
    for (const duplicate of duplicateValues(blockIds)) {
        errors.push(`blockId duplicato: ${duplicate}`);
    }
    const blockById = new Map(unit.blocks.map((block) => [block.blockId, block] as const));
    const titleBlock = blockById.get(unit.titleBlockId);
    if (titleBlock === undefined) {
        errors.push(`titleBlockId inesistente: ${unit.titleBlockId}`);
    } else if (titleBlock.kind !== "heading" || titleBlock.origin !== "official") {
        errors.push("titleBlockId deve indicare un heading ufficiale");
    }

    if (
        unit.hierarchy.parentId !== null &&
        unit.hierarchy.ancestorIds.at(-1) !== unit.hierarchy.parentId
    ) {
        errors.push("parentId deve essere l'ultimo elemento di ancestorIds");
    }
    if (new Set(unit.hierarchy.ancestorIds).size !== unit.hierarchy.ancestorIds.length) {
        errors.push("ancestorIds contiene duplicati");
    }

    for (const block of unit.blocks) {
        if (block.origin !== "official") continue;
        if (block.evidence === undefined) {
            errors.push(`${block.blockId}: evidence mancante`);
            continue;
        }
        if (!knownSourceIds.has(block.evidence.sourceId)) {
            errors.push(`${block.blockId}: sourceId non registrato ${block.evidence.sourceId}`);
        }
        if (isTextPayload(block.text)) {
            if (sha256OfText(block.text.raw) !== block.evidence.rawSha256) {
                errors.push(`${block.blockId}: rawSha256 non corrisponde al testo`);
            }
            if (sha256OfText(block.text.normalized) !== block.evidence.normalizedSha256) {
                errors.push(`${block.blockId}: normalizedSha256 non corrisponde al testo`);
            }
            if (
                block.text.inline !== undefined &&
                block.text.inline.map(({ value }) => value).join("") !==
                    block.text.normalized
            ) {
                errors.push(
                    `${block.blockId}: i segmenti inline non ricompongono il testo normalizzato`,
                );
            }
        }
    }

    for (const duplicate of duplicateValues(unit.citations.map((item) => item.citationId))) {
        errors.push(`citationId duplicato: ${duplicate}`);
    }
    for (const citation of unit.citations) {
        const sourceBlock = blockById.get(citation.sourceBlockId);
        if (sourceBlock === undefined) {
            errors.push(`${citation.citationId}: sourceBlockId inesistente`);
            continue;
        }
        if (!isTextPayload(sourceBlock.text)) {
            errors.push(`${citation.citationId}: sourceBlockId non contiene testo ufficiale`);
            continue;
        }
        if (
            citation.span.start >= citation.span.end ||
            citation.span.end > sourceBlock.text.normalized.length
        ) {
            errors.push(`${citation.citationId}: span fuori dai limiti`);
        } else if (
            sourceBlock.text.normalized.slice(citation.span.start, citation.span.end) !==
            citation.rawText
        ) {
            errors.push(`${citation.citationId}: rawText non corrisponde allo span`);
        }
        if (
            knownUnitIds !== undefined &&
            citation.resolution === "resolved" &&
            citation.target.kind === "internal-unit" &&
            !knownUnitIds.has(citation.target.unitId)
        ) {
            errors.push(`${citation.citationId}: target interno inesistente`);
        }
    }

    for (const duplicate of duplicateValues(unit.relations.map((item) => item.relationId))) {
        errors.push(`relationId duplicato: ${duplicate}`);
    }
    for (const relation of unit.relations) {
        if (knownUnitIds !== undefined && !knownUnitIds.has(relation.targetUnitId)) {
            errors.push(`${relation.relationId}: targetUnitId inesistente`);
        }
        for (const blockId of relation.evidenceBlockIds) {
            if (!blockById.has(blockId)) {
                errors.push(`${relation.relationId}: evidenceBlockId inesistente ${blockId}`);
            }
        }
        if (
            ["confirmed", "rejected"].includes(relation.review.status) &&
            (relation.review.reviewedBy === null || relation.review.reviewedAt === null)
        ) {
            errors.push(`${relation.relationId}: review conclusa senza revisore o data`);
        }
    }

    const assetBlockIds = new Set(
        unit.blocks
            .filter((block) => block.assetId !== undefined)
            .map((block) => block.assetId!),
    );
    const declaredAssetIds = [
        ...unit.assets.formulaIds,
        ...unit.assets.tableIds,
        ...unit.assets.figureIds,
    ];
    for (const assetId of declaredAssetIds) {
        if (!assetBlockIds.has(assetId)) {
            errors.push(`asset dichiarato senza blocco: ${assetId}`);
        }
    }
    for (const assetId of assetBlockIds) {
        if (!declaredAssetIds.includes(assetId)) {
            errors.push(`blocco asset non dichiarato in assets: ${assetId}`);
        }
    }

    if (
        unit.validity.from !== null &&
        unit.validity.to !== null &&
        unit.validity.to < unit.validity.from
    ) {
        errors.push("validity.to precedente a validity.from");
    }
    if (unit.validity.from !== null && unit.validity.asOf < unit.validity.from) {
        errors.push("validity.asOf precedente a validity.from");
    }

    if (["source-checked", "double-reviewed", "published", "superseded"].includes(unit.workflow.status)) {
        for (const block of unit.blocks) {
            if (block.origin === "official" && block.evidence?.region === null) {
                errors.push(`${block.blockId}: region obbligatoria dallo stato source-checked`);
            }
        }
    }

    if (["double-reviewed", "published", "superseded"].includes(unit.workflow.status)) {
        const acceptedHumanReviews = unit.workflow.reviews.filter(
            (review) =>
                review.result === "accepted" &&
                review.reviewer.kind === "human" &&
                review.reviewer.actorId !== unit.workflow.createdBy.actorId,
        );
        if (!acceptedHumanReviews.some((review) => review.type === "source")) {
            errors.push("review umana della fonte mancante");
        }
        if (
            !acceptedHumanReviews.some((review) =>
                ["technical", "normative"].includes(review.type),
            )
        ) {
            errors.push("review umana tecnica o normativa mancante");
        }
    }

    if (["published", "superseded"].includes(unit.workflow.status)) {
        if (unit.workflow.openIssues.some((issue) => issue.severity === "blocking")) {
            errors.push("unità pubblicata con issue bloccanti");
        }
        if (unit.integrity === undefined) {
            errors.push("unità pubblicata senza integrity");
        }
    }

    return errors;
}
