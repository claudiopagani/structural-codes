import { z } from "zod";

export const isoDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data attesa in formato YYYY-MM-DD");

export const isoDateTimeSchema = z
    .string()
    .datetime({ offset: true });
