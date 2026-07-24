import { z } from "zod";
import { isoDateSchema, isoDateTimeSchema, sha256Schema } from "./unit.schema.ts";

/**
 * Registro delle fonti ufficiali (sources/sources.json).
 * Append-only: una fonte registrata non viene modificata, se ne aggiunge una
 * nuova (vedi sicurezza editoriale).
 */
export const registeredSourceSchema = z.object({
  sourceId: z.string().min(1),
  authority: z.string().min(1),
  title: z.string().min(1),
  actNumber: z.string().min(1),
  actDate: isoDateSchema,
  gazette: z.string().min(1),
  gazetteSupplement: z.string().optional(),
  url: z.string().url().or(z.literal("[DA_VERIFICARE: registrare URL ufficiale della Gazzetta o del CS.LL.PP.]")),
  localFile: z.string().min(1),
  pdfSha256: sha256Schema,
  pdfBytes: z.number().int().nonnegative().optional(),
  pageCount: z.number().int().positive().optional(),
  acquiredAt: isoDateTimeSchema.or(z.literal("[DA_VERIFICARE]")),
  manualVerification: z.object({
    by: z.string().nullable(),
    at: isoDateTimeSchema.nullable(),
  }),
});

export const sourceRegistrySchema = z.object({
  registryVersion: z.literal(1),
  sources: z.array(registeredSourceSchema).min(1),
});

export type RegisteredSource = z.infer<typeof registeredSourceSchema>;
export type SourceRegistry = z.infer<typeof sourceRegistrySchema>;
