import { z } from "zod";
import { isValidUnitId, slugify } from "../lib/ids.ts";
import { REVIEW_MARKERS } from "../lib/markers.ts";

export const unitIdSchema = z
    .string()
    .refine(isValidUnitId, "ID non conforme alla convenzione gerarchica (es. ntc2018:c3/s3.3/p3.3.7)");

export const reviewMarkerSchema = z.enum(REVIEW_MARKERS);

export const unitKindSchema = z.enum([
    "document",
    "chapter",
    "section",
    "paragraph",
    "subparagraph",
    "annex",
]);

export const vigencyStatusSchema = z.enum(["in-force", "amended", "superseded", "repealed"]);

export const workflowStatusSchema = z.enum([
    "source-acquired",
    "extracted",
    "segmented",
    "converted",
    "automatically-validated",
    "needs-review",
    "technically-reviewed",
    "approved",
    "published",
    "deprecated",
]);

export const reliabilitySchema = z.enum([
    "unverified",
    "source-checked",
    "technically-reviewed",
    "approved",
]);

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data attesa in formato YYYY-MM-DD");

export const isoDateTimeSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, "datetime ISO 8601 atteso");

export const sha256Schema = z
    .string()
    .regex(/^([a-f0-9]{64}|\[DA_VERIFICARE[^\]]*\])$/, "hash SHA-256 esadecimale o marcatore [DA_VERIFICARE]");

export const sourceRefSchema = z.object({
    sourceId: z.string().min(1),
    url: z.string().url().or(z.literal("[DA_VERIFICARE]")),
    authority: z.string().min(1),
    actNumber: z.string().min(1),
    actDate: isoDateSchema,
    gazette: z.string().min(1),
    gazetteSupplement: z.string().optional(),
    pdfPages: z.array(z.number().int().positive()).min(1),
    pdfSha256: sha256Schema,
    acquiredAt: isoDateTimeSchema.or(z.literal("[DA_VERIFICARE]")),
    localFile: z.string().min(1),
});

export const normativeRelationSchema = z.object({
    type: z.enum(["amends", "replaces", "supersedes", "clarifies"]),
    targetId: unitIdSchema,
    note: z.string().optional(),
});

export const refOutSchema = z.object({
    targetId: unitIdSchema,
    scope: z.enum(["explicit", "ambiguous"]),
    rawText: z.string().min(1),
});

export const workflowSchema = z.object({
    status: workflowStatusSchema,
    convertedBy: z.object({
        kind: z.enum(["llm", "human"]),
        model: z.string().optional(),
    }),
    convertedAt: isoDateTimeSchema.or(z.literal("[DA_VERIFICARE]")),
    technicalReview: z
        .object({ by: z.string().min(1), at: isoDateTimeSchema })
        .nullable(),
    approvedBy: z.string().nullable(),
});

export const hashBlockSchema = z.object({
    sourceText: sha256Schema,
    normalized: sha256Schema,
});

export const openIssueSchema = z.object({
    marker: reviewMarkerSchema,
    note: z.string().min(1),
});

export const normativeUnitSchema = z
    .object({
        id: unitIdSchema,
        slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
        kind: unitKindSchema,
        numbering: z.string().min(1),
        title: z.string().min(1),
        documentId: z.string().min(1),
        editionId: z.string().min(1),
        versionId: z.string().min(1),
        validity: z.object({
            from: isoDateSchema.or(z.literal("[DA_VERIFICARE]")),
            to: isoDateSchema.nullable(),
        }),
        vigencyStatus: vigencyStatusSchema,
        relations: z.array(normativeRelationSchema).default([]),
        source: sourceRefSchema,
        formulas: z.array(unitIdSchema).default([]),
        tables: z.array(unitIdSchema).default([]),
        figures: z.array(unitIdSchema).default([]),
        refsOut: z.array(refOutSchema).default([]),
        workflow: workflowSchema,
        hash: hashBlockSchema,
        reliability: reliabilitySchema,
        openIssues: z.array(openIssueSchema).default([]),
    })
    .superRefine((unit, ctx) => {
        if (unit.slug !== slugify(unit.id)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["slug"],
                message: `slug incoerente con id: atteso "${slugify(unit.id)}", trovato "${unit.slug}"`,
            });
        }
    });

export type NormativeUnit = z.infer<typeof normativeUnitSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
export type ReviewMarkerType = z.infer<typeof reviewMarkerSchema>;
