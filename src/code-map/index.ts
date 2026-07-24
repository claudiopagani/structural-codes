import { z } from "zod";
import { unitIdSchema } from "../schema/unit.schema.ts";

/**
 * Code-map: fonte machine-readable del collegamento normativa <-> codice.
 * Vive QUI (non nei moduli di calcolo) per evitare dipendenze circolari e
 * impatto sul bundle di strutture-js. I test verificano che gli export
 * dichiarati esistano davvero nel package strutture-js.
 */
export const codeMapEntrySchema = z.object({
    key: z.string().min(1),
    unitIds: z.array(unitIdSchema).min(1),
    formulaIds: z.array(unitIdSchema).default([]),
    tableIds: z.array(unitIdSchema).default([]),
    circularUnitIds: z.array(unitIdSchema).default([]),
    editionsValidated: z.array(z.string().min(1)).min(1),
    role: z.enum(["primary", "secondary", "informative"]),
    implementationStatus: z.enum(["implemented", "partial", "not-implemented"]),
    export: z
        .object({
            package: z.string().min(1),
            name: z.string().min(1),
            assumptions: z.array(z.string()).default([]),
        })
        .nullable(),
    tests: z.array(z.string()).default([]),
    applications: z.array(z.string()).default([]),
});

export const codeMapSchema = z.object({
    area: z.string().min(1),
    entries: z.array(codeMapEntrySchema),
});

export type CodeMapEntry = z.infer<typeof codeMapEntrySchema>;
export type CodeMap = z.infer<typeof codeMapSchema>;

const maps: CodeMap[] = [
    // Popolato in Fase 2 (pilota vento): code-map/ntc2018-wind.ts
];

export function getAllCodeMapEntries(): CodeMapEntry[] {
    return maps.flatMap((m) => m.entries);
}
