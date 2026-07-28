import { z } from "zod";
import { isoDateSchema, isoDateTimeSchema } from "./primitives.ts";

const sha256StrictSchema = z.string().regex(/^[a-f0-9]{64}$/, "SHA-256 esadecimale richiesto");
const officialGazzettaUrlSchema = z
    .string()
    .url()
    .refine((value) => {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "www.gazzettaufficiale.it";
    }, "URL HTTPS ufficiale gazzettaufficiale.it richiesto");
const localPdfPathSchema = z
    .string()
    .regex(
        /^raw-sources\/[a-z0-9][a-z0-9/-]*\.pdf$/,
        "percorso PDF relativo sotto raw-sources/ richiesto",
    )
    .refine((value) => !value.includes(".."), "segmenti .. non ammessi");

const manifestationSchema = z.object({
    sourceId: z.string().min(1),
    expressionId: z.string().min(1),
    mediaType: z.literal("application/pdf"),
    officialUrl: officialGazzettaUrlSchema,
    localFile: localPdfPathSchema,
    sha256: sha256StrictSchema,
    bytes: z.number().int().positive(),
    pageCount: z.number().int().positive(),
    acquiredAt: isoDateTimeSchema,
    verification: z.object({
        status: z.enum(["local-hash-verified", "remote-byte-identical"]),
        verifiedAt: isoDateTimeSchema,
        method: z.enum(["local-sha256", "streamed-remote-sha256"]),
        manifestRecordId: z.string().min(1),
    }),
});

const expressionSchema = z.object({
    expressionId: z.string().min(1),
    language: z.literal("it"),
    version: z.enum(["original", "consolidated"]),
    validFrom: isoDateSchema.nullable(),
    validTo: isoDateSchema.nullable(),
    officialConsolidation: z.boolean(),
});

const legalRelationSchema = z.object({
    type: z.enum(["amends", "interprets"]),
    targetWorkId: z.string().min(1),
    note: z.string().min(1),
});

const temporalEffectSchema = z.object({
    effectId: z.string().min(1),
    type: z.enum(["substitutes", "adds", "temporarily-suspends"]),
    targetWorkId: z.string().min(1),
    targetCitation: z.string().min(1),
    legalOperationFrom: isoDateSchema,
    statedFrom: isoDateSchema.nullable(),
    statedThrough: isoDateSchema.nullable(),
    note: z.string().min(1),
});

const workSchema = z.object({
    workId: z.string().min(1),
    actType: z.enum(["decree", "circular"]),
    legalRole: z.enum(["base-act", "interpretive-circular", "amending-act"]),
    title: z.string().min(1),
    authority: z.array(z.string().min(1)).min(1),
    actNumber: z.string().min(1),
    issuedOn: isoDateSchema,
    publishedOn: isoDateSchema,
    effectiveFrom: isoDateSchema.nullable(),
    effectiveTo: isoDateSchema.nullable(),
    effectiveDateBasis: z.string().min(1),
    publication: z.object({
        gazette: z.string().min(1),
        supplement: z.string().nullable(),
        redactionCode: z.string().regex(/^\d{2}[A-Z]\d{5}$/),
        eliUri: officialGazzettaUrlSchema,
        officialLandingPage: officialGazzettaUrlSchema,
    }),
    components: z
        .array(
            z.object({
                componentId: z.string().min(1),
                kind: z.enum(["decree-body", "technical-annex", "circular-body"]),
                label: z.string().min(1),
            }),
        )
        .min(1),
    expressions: z.array(expressionSchema).min(1),
    manifestations: z.array(manifestationSchema).min(1),
    relations: z.array(legalRelationSchema),
    temporalEffects: z.array(temporalEffectSchema),
});

export const sourceRegistryV2Schema = z
    .object({
        registryVersion: z.literal(2),
        status: z.literal("provisional-source-verified"),
        scopeReviewedThrough: isoDateSchema,
        corpusDisclaimer: z.string().min(1),
        works: z.array(workSchema).min(1),
    })
    .superRefine((registry, ctx) => {
        const workIds = new Set(registry.works.map((work) => work.workId));
        const seenWorkIds = new Set<string>();
        const expressionIds = new Set<string>();
        const sourceIds = new Set<string>();

        registry.works.forEach((work, workIndex) => {
            if (seenWorkIds.has(work.workId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["works", workIndex, "workId"],
                    message: `workId duplicato: ${work.workId}`,
                });
            }
            seenWorkIds.add(work.workId);

            const localExpressionIds = new Set(work.expressions.map((item) => item.expressionId));
            for (const expression of work.expressions) {
                if (expressionIds.has(expression.expressionId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["works", workIndex, "expressions"],
                        message: `expressionId duplicato: ${expression.expressionId}`,
                    });
                }
                expressionIds.add(expression.expressionId);
            }

            work.manifestations.forEach((manifestation, manifestationIndex) => {
                if (sourceIds.has(manifestation.sourceId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["works", workIndex, "manifestations", manifestationIndex, "sourceId"],
                        message: `sourceId duplicato: ${manifestation.sourceId}`,
                    });
                }
                sourceIds.add(manifestation.sourceId);
                if (!localExpressionIds.has(manifestation.expressionId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [
                            "works",
                            workIndex,
                            "manifestations",
                            manifestationIndex,
                            "expressionId",
                        ],
                        message: "manifestazione collegata a expressionId inesistente nel work",
                    });
                }
            });

            [...work.relations, ...work.temporalEffects].forEach((relation) => {
                if (!workIds.has(relation.targetWorkId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["works", workIndex],
                        message: `targetWorkId non registrato: ${relation.targetWorkId}`,
                    });
                }
            });
        });
    });

const sourceVerificationRecordSchema = z.object({
    recordId: z.string().min(1),
    sourceId: z.string().min(1),
    officialUrl: officialGazzettaUrlSchema,
    httpStatus: z.literal(200),
    remoteBytes: z.number().int().positive(),
    remoteSha256: sha256StrictSchema,
    localFile: localPdfPathSchema,
    localBytes: z.number().int().positive(),
    localSha256: sha256StrictSchema,
    result: z.literal("byte-identical"),
});

export const sourceVerificationManifestSchema = z.object({
    manifestVersion: z.literal(1),
    manifestId: z.string().min(1),
    performedAt: isoDateTimeSchema,
    performedBy: z.object({
        kind: z.literal("automated-agent"),
        name: z.string().min(1),
    }),
    method: z.string().min(1),
    records: z.array(sourceVerificationRecordSchema).min(1),
});

export type SourceRegistryV2 = z.infer<typeof sourceRegistryV2Schema>;
export type SourceVerificationManifest = z.infer<typeof sourceVerificationManifestSchema>;
