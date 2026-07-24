import { z } from "zod";
import { unitIdSchema, sha256Schema } from "./unit.schema.ts";

/**
 * Tabelle normative: JSON strutturato con modello a celle + spanning esplicito.
 * Il Markdown non rappresenta celle unite e note associate; l'HTML non e'
 * validabile. Questo formato e' la fonte; CSV/HTML sono export derivati.
 */

export const tableCellSchema = z.object({
    columnKey: z.string().min(1),
    text: z.string(),
    colSpan: z.number().int().min(1).default(1),
    rowSpan: z.number().int().min(1).default(1),
    noteRef: z.string().optional(),
    sub: z.string().optional(),
    sup: z.string().optional(),
});

export const tableColumnSchema = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    unit: z.string().optional(),
});

export const tableNoteSchema = z.object({
    ref: z.string().min(1),
    text: z.string().min(1),
});

export const normativeTableSchema = z
    .object({
        id: unitIdSchema,
        officialNumber: z.string().min(1),
        caption: z.string().min(1),
        source: z.object({
            sourceId: z.string().min(1),
            pdfPages: z.array(z.number().int().positive()).min(1),
        }),
        headerRows: z.number().int().min(1),
        columns: z.array(tableColumnSchema).min(1),
        rows: z.array(z.array(tableCellSchema)).min(1),
        notes: z.array(tableNoteSchema).default([]),
        hash: z.object({ normalized: sha256Schema }),
    })
    .superRefine((table, ctx) => {
        const columnKeys = new Set(table.columns.map((c) => c.key));
        const columnCount = table.columns.length;

        // Griglia con contabilita' degli span: ogni riga deve coprire tutte le colonne.
        const occupied = new Set<string>(); // "row,col" occupate da rowSpan attive
        table.rows.forEach((row, rowIndex) => {
            let colCursor = 0;
            for (const cell of row) {
                while (occupied.has(`${rowIndex},${colCursor}`)) colCursor += 1;
                if (!columnKeys.has(cell.columnKey)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["rows", rowIndex],
                        message: `columnKey sconosciuto: "${cell.columnKey}"`,
                    });
                }
                for (let r = 0; r < cell.rowSpan; r += 1) {
                    for (let c = 0; c < cell.colSpan; c += 1) {
                        const key = `${rowIndex + r},${colCursor + c}`;
                        if (occupied.has(key)) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                path: ["rows", rowIndex],
                                message: `sovrapposizione di celle in riga ${rowIndex + r + 1}, colonna ${colCursor + c + 1}`,
                            });
                        }
                        occupied.add(key);
                    }
                }
                colCursor += cell.colSpan;
            }
            if (colCursor !== columnCount) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["rows", rowIndex],
                    message: `la riga copre ${colCursor} colonne, attese ${columnCount}`,
                });
            }
        });

        // Note: nessuna nota orfana, nessun riferimento pendente.
        const declaredRefs = new Set(table.notes.map((n) => n.ref));
        const usedRefs = new Set(
            table.rows.flat().map((c) => c.noteRef).filter((r): r is string => r !== undefined),
        );
        for (const ref of usedRefs) {
            if (!declaredRefs.has(ref)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["notes"],
                    message: `nota "${ref}" referenziata da una cella ma non dichiarata in notes[]`,
                });
            }
        }
        for (const note of table.notes) {
            if (!usedRefs.has(note.ref)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["notes"],
                    message: `nota "${note.ref}" dichiarata ma non associata ad alcuna cella`,
                });
            }
        }
    });

export type NormativeTable = z.infer<typeof normativeTableSchema>;
