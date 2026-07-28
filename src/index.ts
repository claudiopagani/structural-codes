/**
 * API pubblica di Structural Codes.
 *
 * Nota di architettura: questo package NON viene mai importato da
 * structural-checks-ts. È il corpus documentale a puntare al codice, mai il
 * contrario: niente dipendenze circolari e nessun impatto sul bundle.
 */
export * from "./lib/index.ts";
export * from "./schema/index.ts";
