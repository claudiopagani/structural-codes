import { z } from "zod";
import { unitIdSchema } from "./unit.schema.ts";

/**
 * Mapping NTC <-> Circolare.
 * - Pre-match automatico: confirmation "suggested", MAI "confirmed".
 * - Conferma solo umana (ingegnere), registra confirmedBy.
 * - ntcUnitId null: paragrafo della Circolare senza corrispondenza.
 */
export const circularLinkSchema = z.object({
    ntcUnitId: unitIdSchema.nullable(),
    circUnitId: unitIdSchema,
    linkKind: z.enum(["direct", "indirect", "transversal"]),
    confirmation: z.enum(["suggested", "confirmed", "rejected"]),
    confidence: z.enum(["low", "medium", "high"]),
    rationale: z.string().min(1),
    suggestedBy: z.object({
        kind: z.enum(["script", "llm", "human"]),
        model: z.string().nullable().default(null),
    }),
    confirmedBy: z.string().nullable().default(null),
});

export const circularMappingSchema = z
    .object({
        mapping: z.literal("ntc2018-circ2019"),
        chapter: z.string().min(1),
        links: z.array(circularLinkSchema),
    })
    .superRefine((mapping, ctx) => {
        for (const [index, link] of mapping.links.entries()) {
            if (link.confirmation === "confirmed" && link.confirmedBy === null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["links", index, "confirmedBy"],
                    message: "link confermato senza confirmedBy",
                });
            }
            if (link.confirmation === "suggested" && link.confirmedBy !== null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["links", index, "confirmedBy"],
                    message: "link suggested non deve avere confirmedBy",
                });
            }
        }
    });

export type CircularLink = z.infer<typeof circularLinkSchema>;
export type CircularMapping = z.infer<typeof circularMappingSchema>;
