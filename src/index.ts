/**
 * API pubblica di @strutture-js/normativa.
 *
 * Nota di architettura: questo package NON viene mai importato da
 * strutture-js. E' il corpus documentale a puntare al codice, mai il
 * contrario (niente dipendenze circolari, niente impatto sul bundle).
 */
export * from "./lib/index.ts";
export * from "./schema/index.ts";
export * from "./code-map/index.ts";
