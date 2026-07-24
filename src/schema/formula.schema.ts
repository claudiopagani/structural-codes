import { z } from "zod";
import { unitIdSchema } from "./unit.schema.ts";

/**
 * Descrittore formula: obbligatorio solo per formule implementate o in
 * verifica (evita duplicazione del corpus). Il LaTeX vive nel MDX; qui si
 * duplica solo per formule collegate al codice, per audit e RAG.
 */
export const formulaVariableSchema = z.object({
  symbol: z.string().min(1),
  description: z.string().min(1),
  unit: z.string().optional(),
});

export const formulaDescriptorSchema = z.object({
  id: unitIdSchema,
  officialNumber: z.string().nullable(),
  unitId: unitIdSchema,
  latex: z.string().min(1),
  rawExtract: z.string().min(1),
  variables: z.array(formulaVariableSchema).default([]),
  verificationStatus: z.enum(["unverified", "source-verified", "implemented", "test-covered"]),
  implementedBy: z.array(z.string()).default([]),
  coveredByTests: z.array(z.string()).default([]),
});

export type FormulaDescriptor = z.infer<typeof formulaDescriptorSchema>;
