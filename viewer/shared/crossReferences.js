const unitPattern = /(^|[^\p{L}\p{N}])(§\s*C?\d+(?:\.\d+)+|C\d+(?:\.\d+)+|\d+(?:\.\d+){2,})/giu;
const assetPatterns = [
  { kind: "table", pattern: /\b(?:Tab\.?|Tabella)\s+(C?\d+(?:\.\d+)*(?:\.[IVXLCDM]+)?)/giu },
  { kind: "figure", pattern: /\b(?:Fig\.?|Figura)\s+(C?\d+(?:\.\d+)+)/giu },
  { kind: "formula", pattern: /\b(?:formula|equazione|relazione)\s+(?:n\.?\s*)?\[?(C?\d+(?:\.\d+)+)\]?/giu },
  { kind: "formula", pattern: /\[(C?\d+(?:\.\d+)+)\]/giu },
];

function normalizedNumber(value) {
  return value.replace(/^C/iu, "").replace(/[.\s]+$/gu, "").toUpperCase();
}

function documentHint(value) {
  return /^C/iu.test(value.trim().replace(/^§\s*/iu, "")) ? "circ2019" : null;
}

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}

export function findCrossReferences(value) {
  const source = String(value ?? "");
  const candidates = [];
  for (const { kind, pattern } of assetPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      candidates.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        kind,
        number: normalizedNumber(match[1]),
        documentHint: documentHint(match[1]),
      });
    }
  }
  unitPattern.lastIndex = 0;
  for (const match of source.matchAll(unitPattern)) {
    const prefixLength = match[1].length;
    const raw = match[2];
    candidates.push({
      start: match.index + prefixLength,
      end: match.index + prefixLength + raw.length,
      text: raw,
      kind: "unit",
      number: normalizedNumber(raw.replace(/^§\s*/iu, "")),
      documentHint: documentHint(raw),
    });
  }
  const accepted = [];
  for (const candidate of candidates.sort((left, right) => left.start - right.start || (left.kind === "unit" ? 1 : -1) || right.end - left.end)) {
    if (!accepted.some((current) => overlaps(current, candidate))) accepted.push(candidate);
  }
  return accepted.sort((left, right) => left.start - right.start);
}

function compactText(unit, maximum = 110) {
  const value = unit.blocks
    .filter((block) => block.blockId !== unit.titleBlockId)
    .flatMap((block) => block.text?.normalized ? [block.text.normalized] : [])
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
  return value.length > maximum ? `${value.slice(0, maximum - 1).trimEnd()}…` : value;
}

function assetKindFor(collection) {
  return collection === "formulas" ? "formula" : collection === "tables" ? "table" : "figure";
}

function preferredDocument(reference, sourceDocument) {
  if (reference.documentHint) return reference.documentHint;
  return sourceDocument === "circ2019" ? "ntc2018" : sourceDocument;
}

function targetKey(targetType, targetId) {
  return `${targetType}:${targetId}`;
}

export function buildCrossReferenceIndexPayload({ units, assetCollections }) {
  const unitTargets = units.map((unit) => ({
    id: unit.id,
    document: unit.document,
    numbering: unit.numbering.official,
    title: unit.title,
    snippet: compactText(unit),
  }));
  const unitById = new Map(unitTargets.map((unit) => [unit.id, unit]));
  const unitByDocumentAndNumber = new Map(unitTargets.map((unit) => [`${unit.document}:${normalizedNumber(unit.numbering)}`, unit]));
  const ownerByAssetId = new Map();
  for (const unit of units) {
    for (const block of unit.blocks) {
      if (block.assetId && !ownerByAssetId.has(block.assetId)) ownerByAssetId.set(block.assetId, { unit, blockId: block.blockId });
    }
  }
  const assets = [];
  for (const [collection, records] of Object.entries(assetCollections)) {
    const kind = assetKindFor(collection);
    for (const asset of records) {
      if (!asset.officialNumber) continue;
      const owner = ownerByAssetId.get(asset.id);
      if (!owner) continue;
      assets.push({
        id: asset.id,
        kind,
        unitId: owner.unit.id,
        blockId: owner.blockId,
        officialNumber: asset.officialNumber,
        ...(kind === "table" && asset.caption ? { title: asset.caption, snippet: asset.caption } : {}),
        ...(kind === "figure" ? { title: asset.caption, snippet: asset.alt } : {}),
      });
    }
  }
  const assetByDocumentKindAndNumber = new Map(assets.map((asset) => {
    const owner = unitById.get(asset.unitId);
    return [`${owner.document}:${asset.kind}:${normalizedNumber(asset.officialNumber)}`, asset];
  }));
  const backlinks = [];
  const seen = new Set();
  const referencedAssetIds = new Set();
  for (const source of units) {
    for (const block of source.blocks) {
      if (!block.text?.normalized || block.blockId === source.titleBlockId) continue;
      for (const reference of findCrossReferences(block.text.normalized)) {
        const preferred = preferredDocument(reference, source.document);
        const documents = preferred === source.document ? [preferred] : [preferred, source.document];
        let target = null;
        let targetType = reference.kind;
        for (const document of documents) {
          target = reference.kind === "unit"
            ? unitByDocumentAndNumber.get(`${document}:${reference.number}`)
            : assetByDocumentKindAndNumber.get(`${document}:${reference.kind}:${reference.number}`);
          if (target) break;
        }
        if (!target || (targetType === "unit" && target.id === source.id)) continue;
        if (targetType !== "unit") {
          referencedAssetIds.add(target.id);
          continue;
        }
        const key = `${targetKey(targetType, target.id)}:${source.id}:${block.blockId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        backlinks.push({
          targetType,
          targetId: target.id,
          sourceUnitId: source.id,
          sourceBlockId: block.blockId,
        });
      }
    }
  }
  return { formatVersion: 1, units: unitTargets, assets: assets.filter((asset) => referencedAssetIds.has(asset.id)), backlinks };
}

export function createCrossReferenceLookup(index) {
  const unitById = new Map(index.units.map((unit) => [unit.id, unit]));
  const unitByDocumentAndNumber = new Map(index.units.map((unit) => [`${unit.document}:${normalizedNumber(unit.numbering)}`, unit]));
  const assetById = new Map(index.assets.map((asset) => [asset.id, asset]));
  const assetByDocumentKindAndNumber = new Map(index.assets.map((asset) => {
    const unit = unitById.get(asset.unitId);
    return [`${unit.document}:${asset.kind}:${normalizedNumber(asset.officialNumber)}`, asset];
  }));
  const backlinksByTarget = new Map();
  for (const backlink of index.backlinks) {
    const key = targetKey(backlink.targetType, backlink.targetId);
    const group = backlinksByTarget.get(key) ?? [];
    group.push(backlink);
    backlinksByTarget.set(key, group);
  }
  return { unitById, unitByDocumentAndNumber, assetById, assetByDocumentKindAndNumber, backlinksByTarget };
}

export function resolveCrossReference(lookup, reference, sourceDocument) {
  const preferred = preferredDocument(reference, sourceDocument);
  const documents = preferred === sourceDocument ? [preferred] : [preferred, sourceDocument];
  for (const document of documents) {
    const target = reference.kind === "unit"
      ? lookup.unitByDocumentAndNumber.get(`${document}:${reference.number}`)
      : lookup.assetByDocumentKindAndNumber.get(`${document}:${reference.kind}:${reference.number}`);
    if (target) return reference.kind === "unit" ? { targetType: "unit", unit: target } : { targetType: reference.kind, unit: lookup.unitById.get(target.unitId), asset: target };
  }
  return null;
}
