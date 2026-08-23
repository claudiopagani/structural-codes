/**
 * API pubblica di Structural Codes.
 *
 * L'entry point principale è compatibile con Node e browser: espone contratti
 * di schema e helper puri per unità/relazioni. Le funzioni basate su filesystem
 * e crypto di Node sono intenzionalmente isolate nel subpath `./lib`.
 */
export * from "./corpus/index.ts";
export * from "./schema/index.ts";
