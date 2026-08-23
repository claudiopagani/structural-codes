/** Identificatore dello schema JSON delle unità canoniche distribuite. */
export const CANONICAL_UNIT_SCHEMA_ID =
    "urn:structural-codes:schema:canonical-unit:v2" as const;

/** Versione dello schema delle unità inclusa in questa prerelease. */
export const CANONICAL_UNIT_SCHEMA_VERSION = "2.0.0-alpha.2" as const;

/** Identificatore dello schema JSON dei manifest degli asset canonici. */
export const ASSET_MANIFEST_SCHEMA_ID =
    "urn:structural-codes:schema:asset-manifest:v2" as const;

/** Versione dello schema degli asset inclusa in questa prerelease. */
export const ASSET_MANIFEST_SCHEMA_VERSION = "2.0.0-alpha.1" as const;

export type StructuralCodesDocumentId = "ntc2018" | "circ2019";
export type RelationReviewStatus = "proposed" | "confirmed" | "rejected";

export interface CanonicalRelationLike {
    relationId: string;
    type: string;
    targetUnitId: string;
    basis: "textual" | "editorial";
    rationale: string;
    review: {
        status: RelationReviewStatus;
    };
}

export interface CanonicalUnitLike {
    id: string;
    numbering: {
        official: string;
        sortKey: string;
    };
    hierarchy: {
        parentId: string | null;
        ancestorIds: string[];
        position: number;
    };
    relations: CanonicalRelationLike[];
}

export interface IncomingRelation<TUnit extends CanonicalUnitLike> {
    sourceUnit: TUnit;
    relation: CanonicalRelationLike;
}

const unitIdPattern =
    /^urn:structural-codes:it:unit:(ntc2018|circ2019):[a-z0-9][a-z0-9:._-]*$/u;

/** Controlla soltanto la forma dell'URN; la presenza nel corpus va verificata a parte. */
export function isCanonicalUnitId(value: string): boolean {
    return unitIdPattern.test(value);
}

/** Restituisce il documento codificato nell'URN, senza inferire relazioni. */
export function documentIdFromUnitId(
    value: string,
): StructuralCodesDocumentId | null {
    const match = unitIdPattern.exec(value);
    return (match?.[1] as StructuralCodesDocumentId | undefined) ?? null;
}

/** Ordinamento deterministico basato esclusivamente sul sortKey canonico. */
export function compareCanonicalUnits<TUnit extends CanonicalUnitLike>(
    left: TUnit,
    right: TUnit,
): number {
    return left.numbering.sortKey.localeCompare(right.numbering.sortKey, "it", {
        numeric: true,
    });
}

/** Crea un indice intenzionale e rifiuta ID duplicati invece di sovrascriverli. */
export function createUnitIndex<TUnit extends { id: string }>(
    units: Iterable<TUnit>,
): ReadonlyMap<string, TUnit> {
    const index = new Map<string, TUnit>();
    for (const unit of units) {
        if (index.has(unit.id)) {
            throw new Error(`unit ID duplicato: ${unit.id}`);
        }
        index.set(unit.id, unit);
    }
    return index;
}

/** Lookup lineare utile per collezioni piccole o già caricate in memoria. */
export function findUnitById<TUnit extends { id: string }>(
    units: Iterable<TUnit>,
    unitId: string,
): TUnit | undefined {
    for (const unit of units) {
        if (unit.id === unitId) return unit;
    }
    return undefined;
}

/**
 * Inverte le relazioni esplicite presenti nei record.
 * Non usa mai la somiglianza della numerazione come fonte canonica.
 */
export function findIncomingRelations<TUnit extends CanonicalUnitLike>(
    units: Iterable<TUnit>,
    targetUnitId: string,
): IncomingRelation<TUnit>[] {
    const incoming: IncomingRelation<TUnit>[] = [];
    for (const sourceUnit of units) {
        for (const relation of sourceUnit.relations) {
            if (relation.targetUnitId === targetUnitId) {
                incoming.push({ sourceUnit, relation });
            }
        }
    }
    return incoming.sort((left, right) =>
        compareCanonicalUnits(left.sourceUnit, right.sourceUnit),
    );
}
