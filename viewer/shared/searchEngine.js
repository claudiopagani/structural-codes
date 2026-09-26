export const searchIndexFormatVersion = 4;

export const searchRankingWeights = Object.freeze({
  priority: Object.freeze({
    numberExact: 9_000_000,
    assetExact: 8_000_000,
    titleExact: 7_000_000,
    numberKeyword: 6_000_000,
    titleTerms: 5_000_000,
    phrase: 4_000_000,
    proximity: 3_000_000,
    allTerms: 2_000_000,
    partial: 1_000_000,
  }),
  field: Object.freeze({
    matchedTerm: 20_000,
    titleFrequency: 2_000,
    bodyRelevance: 420,
    assetRelevance: 260,
    exactNumberPrefix: 90_000,
  }),
  proximity: Object.freeze({ sameBlock: 80_000, ordered: 35_000, window: 24, perTokenSaved: 1_500 }),
  candidatePoolMinimum: 300,
  candidatePoolPerResult: 28,
  partialExpansionLimit: 8,
});

const assetLabels = Object.freeze({ formula: "formula", table: "tabella", figure: "figura" });

export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("it")
    .replace(/[’`]/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

export function tokenizeSearchText(value) {
  return normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function parseNormativeReference(value) {
  const match = String(value ?? "").normalize("NFKC").trim().match(/^§?\s*(c)?\s*(\d+(?:\.\d+)*)\.?$/iu);
  if (!match) return null;
  return { numbering: match[2], documentHint: match[1] ? "circ2019" : null };
}

function normalizeAssetNumber(value) {
  return normalizeSearchText(value)
    .replace(/^(?:formula|tabella|tab\.?|figura|fig\.?)\s*/u, "")
    .replace(/^\[|\]$/gu, "")
    .replace(/\s+/gu, "");
}

function assetKindForLabel(label) {
  if (/^formula$/iu.test(label)) return "formula";
  if (/^tab(?:ella)?\.?$/iu.test(label)) return "table";
  if (/^fig(?:ura)?\.?$/iu.test(label)) return "figure";
  return null;
}

function parseAssetIntent(value) {
  const source = String(value ?? "").normalize("NFKC").trim();
  const bracketed = source.match(/^\[\s*([^\]]+)\s*\]$/u);
  if (bracketed) return { kind: "formula", exactNumber: normalizeAssetNumber(bracketed[1]), searchText: "" };
  const labelled = source.match(/^(formula|tab(?:ella)?\.?|fig(?:ura)?\.?)\s*(?:n\.?\s*)?(.*)$/iu);
  if (!labelled) return null;
  const kind = assetKindForLabel(labelled[1]);
  const remainder = labelled[2].trim();
  const number = remainder.replace(/^\[\s*|\s*\]$/gu, "");
  const exactNumber = /^[c]?\d+(?:\.[\p{L}\p{N}()_-]+)+$/iu.test(number) ? normalizeAssetNumber(number) : null;
  return { kind, exactNumber, searchText: exactNumber ? "" : remainder };
}

function parseMixedReference(value) {
  const source = String(value ?? "").normalize("NFKC").trim();
  const match = source.match(/^§?\s*(c)?\s*(\d+(?:\.\d+)+)\.?\s+(.+)$/iu);
  if (!match) return null;
  return { numbering: match[2], documentHint: match[1] ? "circ2019" : null, searchText: match[3] };
}

function frequencies(tokens) {
  const result = new Map();
  for (const token of tokens) result.set(token, (result.get(token) ?? 0) + 1);
  return result;
}

function appendVarint(bytes, value) {
  let remaining = value >>> 0;
  while (remaining >= 128) {
    bytes.push((remaining & 127) | 128);
    remaining >>>= 7;
  }
  bytes.push(remaining);
}

function encodePosting(posting) {
  const bytes = [];
  let previousUnitIndex = 0;
  for (let position = 0; position < posting.length; position += 4) {
    appendVarint(bytes, posting[position] - previousUnitIndex);
    appendVarint(bytes, posting[position + 1]);
    appendVarint(bytes, posting[position + 2]);
    appendVarint(bytes, posting[position + 3]);
    previousUnitIndex = posting[position];
  }
  return Buffer.from(bytes).toString("base64");
}

function decodePosting(value) {
  const bytes = typeof Buffer === "undefined"
    ? Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
    : Buffer.from(value, "base64");
  const values = [];
  let byteOffset = 0;
  let previousUnitIndex = 0;
  const readVarint = () => {
    let result = 0;
    let shift = 0;
    while (byteOffset < bytes.length) {
      const byte = bytes[byteOffset++];
      result |= (byte & 127) << shift;
      if ((byte & 128) === 0) return result;
      shift += 7;
    }
    throw new Error("Posting list troncata.");
  };
  while (byteOffset < bytes.length) {
    previousUnitIndex += readVarint();
    values.push(previousUnitIndex, readVarint(), readVarint(), readVarint());
  }
  return values;
}

function compactBlockId(unitId, blockId) {
  return blockId?.startsWith(`${unitId}#`) ? blockId.slice(unitId.length) : blockId;
}

function expandedBlockId(unit, blockId) {
  return blockId?.startsWith("#") ? `${unit.id}${blockId}` : blockId;
}

export function buildSearchIndexPayload(sourceUnits) {
  const postings = new Map();
  const references = new Map();
  const assetReferences = new Map();
  const units = sourceUnits.map((unit, unitIndex) => {
    const titleNormalized = normalizeSearchText(unit.title);
    const titleTokens = tokenizeSearchText(titleNormalized);
    const sourceSegments = unit.segments ?? (unit.text ? [{ blockId: unit.titleBlockId, text: unit.text }] : []);
    const segments = sourceSegments.flatMap((segment) => {
      const text = String(segment.text ?? "").replace(/\s+/gu, " ").trim();
      if (!text) return [];
      return [{
        blockId: compactBlockId(unit.id, segment.blockId),
        ...(segment.assetId ? { assetId: segment.assetId } : {}),
        ...(segment.assetKind ? { assetKind: segment.assetKind } : {}),
        ...(segment.officialNumber ? { officialNumber: segment.officialNumber } : {}),
        text,
      }];
    });
    const bodyTokens = segments.flatMap((segment) => segment.assetId ? [] : tokenizeSearchText(segment.text));
    const assetTokens = segments.flatMap((segment) => segment.assetId ? tokenizeSearchText(segment.text) : []);
    const titleTerms = frequencies(titleTokens);
    const bodyTerms = frequencies(bodyTokens);
    const assetTerms = frequencies(assetTokens);
    const allTerms = new Set([...titleTerms.keys(), ...bodyTerms.keys(), ...assetTerms.keys()]);
    for (const term of allTerms) {
      const posting = postings.get(term) ?? [];
      posting.push(unitIndex, titleTerms.get(term) ?? 0, bodyTerms.get(term) ?? 0, assetTerms.get(term) ?? 0);
      postings.set(term, posting);
    }
    const numbering = unit.numbering.replace(/^C/iu, "");
    const reference = references.get(numbering) ?? [-1, -1];
    reference[unit.document === "ntc2018" ? 0 : 1] = unitIndex;
    references.set(numbering, reference);
    segments.forEach((segment, segmentIndex) => {
      if (!segment.assetKind || !segment.officialNumber) return;
      const key = `${segment.assetKind}:${normalizeAssetNumber(segment.officialNumber)}`;
      const targets = assetReferences.get(key) ?? [];
      targets.push([unitIndex, segmentIndex]);
      assetReferences.set(key, targets);
    });
    return {
      id: unit.id,
      document: unit.document,
      numbering: unit.numbering,
      title: unit.title,
      titleNormalized,
      titleBlockId: compactBlockId(unit.id, unit.titleBlockId),
      chunkPath: unit.chunkPath,
      segments,
      textLength: bodyTokens.length,
      assetTextLength: assetTokens.length,
    };
  });
  return {
    formatVersion: searchIndexFormatVersion,
    normalization: "NFKC lowercase it-IT; apostrophe and whitespace folding; tokenization at build time; block and asset targets",
    units,
    references: Object.fromEntries([...references].sort(([left], [right]) => left.localeCompare(right, "it", { numeric: true }))),
    assetReferences: Object.fromEntries([...assetReferences].sort(([left], [right]) => left.localeCompare(right, "it", { numeric: true }))),
    postings: Object.fromEntries([...postings].sort(([left], [right]) => left.localeCompare(right, "it")).map(([term, posting]) => [term, encodePosting(posting)])),
  };
}

function documentAllowed(document, mode) {
  return mode === "combined" || (mode === "ntc" ? document === "ntc2018" : document === "circ2019");
}

function numberingMatches(unit, reference) {
  if (!reference || (reference.documentHint && unit.document !== reference.documentHint)) return false;
  const numbering = unit.numbering.replace(/^C/iu, "");
  return numbering === reference.numbering || numbering.startsWith(`${reference.numbering}.`);
}

function foldWithOffsets(value) {
  let normalized = "";
  const offsets = [];
  let previousWasWhitespace = false;
  for (let offset = 0; offset < value.length;) {
    const codePoint = value.codePointAt(offset);
    const character = String.fromCodePoint(codePoint);
    const folded = character.normalize("NFKC").toLocaleLowerCase("it").replace(/[’`]/gu, "'");
    for (const foldedCharacter of folded) {
      if (/\s/u.test(foldedCharacter)) {
        if (!previousWasWhitespace && normalized.length > 0) {
          normalized += " ";
          offsets.push(offset);
        }
        previousWasWhitespace = true;
      } else {
        normalized += foldedCharacter;
        for (let index = 0; index < foldedCharacter.length; index += 1) offsets.push(offset);
        previousWasWhitespace = false;
      }
    }
    offset += character.length;
  }
  return { normalized: normalized.trimEnd(), offsets };
}

function mergeRanges(ranges) {
  const sorted = ranges.sort(([left], [right]) => left - right);
  const merged = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

function sourceEndOffset(source, folded, normalizedOffset) {
  const sourceOffset = folded.offsets[normalizedOffset];
  if (sourceOffset === undefined) return source.length;
  const codePoint = source.codePointAt(sourceOffset);
  return sourceOffset + (codePoint === undefined ? 1 : String.fromCodePoint(codePoint).length);
}

export function highlightedSnippet(value, normalizedQuery, queryTokens) {
  const source = String(value ?? "").replace(/\s+/gu, " ").trim();
  if (!source) return { snippet: "", highlights: [] };
  const folded = foldWithOffsets(source);
  let normalizedOffset = normalizedQuery ? folded.normalized.indexOf(normalizedQuery) : -1;
  if (normalizedOffset < 0) normalizedOffset = queryTokens.map((token) => folded.normalized.indexOf(token)).find((offset) => offset >= 0) ?? -1;
  const sourceOffset = normalizedOffset >= 0 ? folded.offsets[normalizedOffset] ?? 0 : 0;
  let start = Math.max(0, sourceOffset - 64);
  let end = Math.min(source.length, start + 180);
  if (start > 0) {
    const boundary = source.indexOf(" ", start);
    if (boundary >= 0 && boundary < sourceOffset) start = boundary + 1;
  }
  if (end < source.length) {
    const boundary = source.lastIndexOf(" ", end);
    if (boundary > sourceOffset) end = boundary;
  }
  const excerpt = source.slice(start, end);
  const excerptFolded = foldWithOffsets(excerpt);
  const ranges = [];
  for (const token of new Set(queryTokens)) {
    let offset = 0;
    while (offset < excerptFolded.normalized.length) {
      const found = excerptFolded.normalized.indexOf(token, offset);
      if (found < 0) break;
      const from = excerptFolded.offsets[found] ?? found;
      const to = sourceEndOffset(excerpt, excerptFolded, found + token.length - 1);
      ranges.push([from, Math.max(from + 1, to)]);
      offset = found + Math.max(1, token.length);
    }
  }
  const prefix = start > 0 ? "…" : "";
  const snippet = `${prefix}${excerpt}${end < source.length ? "…" : ""}`;
  return { snippet, highlights: mergeRanges(ranges).map(([from, to]) => [from + prefix.length, to + prefix.length]) };
}

function resultFor(unit, source, normalizedQuery, queryTokens, score, matchKind, segment) {
  return {
    id: unit.id,
    document: unit.document,
    numbering: unit.numbering,
    title: unit.title,
    chunkPath: unit.chunkPath,
    ...highlightedSnippet(source || unit.title, normalizedQuery, queryTokens),
    score: Math.round(score),
    matchKind,
    ...(segment?.blockId ? { blockId: expandedBlockId(unit, segment.blockId) } : {}),
    ...(segment?.assetId ? { assetId: segment.assetId } : {}),
    ...(segment?.assetKind ? { assetKind: segment.assetKind } : {}),
  };
}

function exactReferenceResult(index, reference, mode) {
  const pair = index.references[reference.numbering];
  if (!pair) return [];
  let unitIndex = -1;
  if (reference.documentHint === "circ2019") {
    if (mode !== "ntc") unitIndex = pair[1];
  } else if (mode === "circ") unitIndex = pair[1];
  else unitIndex = pair[0] >= 0 ? pair[0] : mode === "combined" ? pair[1] : -1;
  const unit = index.units[unitIndex];
  return unit ? [resultFor(unit, `${unit.numbering} — ${unit.title}`, normalizeSearchText(unit.numbering), tokenizeSearchText(unit.numbering), searchRankingWeights.priority.numberExact, "number-exact", null)] : [];
}

function exactAssetResults(index, kind, number, mode) {
  const kinds = kind ? [kind] : ["formula", "table", "figure"];
  const results = [];
  for (const assetKind of kinds) {
    const targets = index.assetReferences[`${assetKind}:${normalizeAssetNumber(number)}`] ?? [];
    for (const [unitIndex, segmentIndex] of targets) {
      const unit = index.units[unitIndex];
      const segment = unit?.segments[segmentIndex];
      if (!unit || !segment || !documentAllowed(unit.document, mode)) continue;
      const label = assetLabels[assetKind];
      const source = `${label[0].toLocaleUpperCase("it")}${label.slice(1)} ${segment.officialNumber ?? number} — ${segment.text}`;
      const priority = assetKind === "figure" ? searchRankingWeights.priority.titleExact : searchRankingWeights.priority.assetExact;
      results.push(resultFor(unit, source, normalizeSearchText(number), tokenizeSearchText(number), priority, "asset-exact", segment));
    }
  }
  return results.sort((left, right) => right.score - left.score || left.numbering.localeCompare(right.numbering, "it", { numeric: true }));
}

function spanMetrics(tokens, queryTokens) {
  if (queryTokens.length === 0) return { all: false, span: Infinity, ordered: false };
  const wanted = new Set(queryTokens);
  const counts = new Map();
  let satisfied = 0;
  let left = 0;
  let bestSpan = Infinity;
  for (let right = 0; right < tokens.length; right += 1) {
    const token = tokens[right];
    if (!wanted.has(token)) continue;
    const next = (counts.get(token) ?? 0) + 1;
    counts.set(token, next);
    if (next === 1) satisfied += 1;
    while (satisfied === wanted.size && left <= right) {
      bestSpan = Math.min(bestSpan, right - left + 1);
      const leftToken = tokens[left++];
      if (!wanted.has(leftToken)) continue;
      const remaining = (counts.get(leftToken) ?? 1) - 1;
      counts.set(leftToken, remaining);
      if (remaining === 0) satisfied -= 1;
    }
  }
  let cursor = -1;
  let ordered = true;
  for (const token of queryTokens) {
    cursor = tokens.indexOf(token, cursor + 1);
    if (cursor < 0) { ordered = false; break; }
  }
  return { all: Number.isFinite(bestSpan), span: bestSpan, ordered };
}

function segmentMetrics(segment, queryTokens, normalizedQuery, textCache) {
  let indexed = textCache.get(segment);
  if (!indexed) {
    const normalized = normalizeSearchText(segment.text);
    indexed = { normalized, tokens: tokenizeSearchText(normalized) };
    textCache.set(segment, indexed);
  }
  const { normalized, tokens } = indexed;
  const span = spanMetrics(tokens, queryTokens);
  const phrase = queryTokens.length > 1 && normalized.includes(normalizedQuery);
  let proximityBoost = 0;
  if (span.all) {
    proximityBoost += searchRankingWeights.proximity.sameBlock;
    if (span.ordered && queryTokens.length > 1) proximityBoost += searchRankingWeights.proximity.ordered;
    proximityBoost += Math.max(0, searchRankingWeights.proximity.window - span.span) * searchRankingWeights.proximity.perTokenSaved;
  }
  return { segment, phrase, ...span, proximityBoost };
}

function nearestAssetSegment(unit, assetKind, anchorIndex) {
  let selected = null;
  let distance = Infinity;
  unit.segments.forEach((segment, index) => {
    if (segment.assetKind !== assetKind) return;
    const nextDistance = Math.abs(index - anchorIndex);
    if (nextDistance < distance) { selected = segment; distance = nextDistance; }
  });
  return selected;
}

export function createSearchEngine(index) {
  if (index.formatVersion !== searchIndexFormatVersion) throw new Error(`Formato indice ricerca non supportato: ${index.formatVersion}`);
  const postingCache = new Map();
  const segmentTextCache = new WeakMap();
  const postingTerms = Object.keys(index.postings);
  const decodedPosting = (term) => {
    let posting = postingCache.get(term);
    if (!posting) {
      posting = decodePosting(index.postings[term]);
      postingCache.set(term, posting);
    }
    return posting;
  };
  return {
    search({ query, mode = "combined", limit = 12 }) {
      const maximum = Math.max(1, Math.min(50, Number(limit) || 12));
      const reference = parseNormativeReference(query);
      if (reference) {
        const exactReference = exactReferenceResult(index, reference, mode);
        if (exactReference.length > 0) return exactReference.slice(0, maximum);
        const exactAssets = exactAssetResults(index, null, reference.numbering, mode);
        if (exactAssets.length > 0) return exactAssets.slice(0, maximum);
        return [];
      }
      const assetIntent = parseAssetIntent(query);
      if (assetIntent?.exactNumber) return exactAssetResults(index, assetIntent.kind, assetIntent.exactNumber, mode).slice(0, maximum);
      const mixedReference = assetIntent ? null : parseMixedReference(query);
      const searchText = assetIntent?.searchText || mixedReference?.searchText || query;
      const normalizedQuery = normalizeSearchText(searchText);
      const queryTokens = [...new Set(tokenizeSearchText(normalizedQuery))];
      if (normalizeSearchText(query).length < 2 || (queryTokens.length === 0 && !mixedReference && !assetIntent)) return [];
      const candidates = new Map();
      queryTokens.forEach((token) => {
        const matchedTerms = index.postings[token]
          ? [{ term: token, partial: false }]
          : token.length >= 4
            ? postingTerms.filter((term) => term.startsWith(token)).slice(0, searchRankingWeights.partialExpansionLimit).map((term) => ({ term, partial: true }))
            : [];
        const matchesForToken = new Map();
        for (const { term, partial } of matchedTerms) {
          const posting = decodedPosting(term);
          const documentFrequency = posting.length / 4;
          const inverseFrequency = Math.log(1 + index.units.length / Math.max(1, documentFrequency));
          for (let position = 0; position < posting.length; position += 4) {
            const unitIndex = posting[position];
            const unit = index.units[unitIndex];
            if (!documentAllowed(unit.document, mode)) continue;
            const local = matchesForToken.get(unitIndex) ?? { titleFrequency: 0, bodyScore: 0, assetScore: 0, partial: false };
            local.titleFrequency += posting[position + 1];
            local.bodyScore += inverseFrequency * (posting[position + 2] / Math.max(1, Math.sqrt(unit.textLength)));
            local.assetScore += inverseFrequency * (posting[position + 3] / Math.max(1, Math.sqrt(unit.assetTextLength)));
            local.partial ||= partial;
            matchesForToken.set(unitIndex, local);
          }
        }
        for (const [unitIndex, local] of matchesForToken) {
          const candidate = candidates.get(unitIndex) ?? { unitIndex, matchedTerms: 0, titleFrequency: 0, bodyScore: 0, assetScore: 0, partialTerms: 0, numberMatched: false };
          candidate.matchedTerms += 1;
          candidate.titleFrequency += local.titleFrequency;
          candidate.bodyScore += local.bodyScore;
          candidate.assetScore += local.assetScore;
          if (local.partial) candidate.partialTerms += 1;
          candidates.set(unitIndex, candidate);
        }
      });
      if (mixedReference) {
        index.units.forEach((unit, unitIndex) => {
          if (!documentAllowed(unit.document, mode) || !numberingMatches(unit, mixedReference)) return;
          const candidate = candidates.get(unitIndex) ?? { unitIndex, matchedTerms: 0, titleFrequency: 0, bodyScore: 0, assetScore: 0, partialTerms: 0, numberMatched: false };
          candidate.numberMatched = true;
          candidates.set(unitIndex, candidate);
        });
      }
      let candidateValues = [...candidates.values()];
      if (assetIntent) candidateValues = candidateValues.filter(({ unitIndex }) => index.units[unitIndex].segments.some((segment) => segment.assetKind === assetIntent.kind));
      const allTerms = candidateValues.filter((candidate) => candidate.matchedTerms === queryTokens.length);
      const pool = (allTerms.length > 0 ? allTerms : candidateValues)
        .sort((left, right) => Number(right.numberMatched) - Number(left.numberMatched) || right.matchedTerms - left.matchedTerms || right.titleFrequency - left.titleFrequency || (right.bodyScore + right.assetScore) - (left.bodyScore + left.assetScore))
        .slice(0, Math.max(searchRankingWeights.candidatePoolMinimum, maximum * searchRankingWeights.candidatePoolPerResult));
      const ranked = pool.map((candidate) => {
        const unit = index.units[candidate.unitIndex];
        const titleTokens = tokenizeSearchText(unit.titleNormalized);
        const titleExact = !mixedReference && queryTokens.length > 0 && unit.titleNormalized.includes(normalizedQuery);
        const titleAll = queryTokens.length > 0 && queryTokens.every((token) => titleTokens.some((titleToken) => titleToken === token || (candidate.partialTerms > 0 && titleToken.startsWith(token))));
        const segmentScores = unit.segments.map((segment, segmentIndex) => ({ ...segmentMetrics(segment, queryTokens, normalizedQuery, segmentTextCache), segmentIndex }));
        const best = segmentScores.sort((left, right) => Number(right.phrase) - Number(left.phrase) || Number(right.all) - Number(left.all) || right.proximityBoost - left.proximityBoost || Number(Boolean(right.segment.assetId)) - Number(Boolean(left.segment.assetId)))[0] ?? null;
        const allQueryTerms = candidate.matchedTerms === queryTokens.length;
        const nearTerms = best?.all && best.span <= searchRankingWeights.proximity.window;
        let matchKind;
        let priority;
        if (titleExact) { matchKind = "title"; priority = searchRankingWeights.priority.titleExact; }
        else if (candidate.numberMatched && allQueryTerms) { matchKind = "number-keyword"; priority = searchRankingWeights.priority.numberKeyword; }
        else if (titleAll) { matchKind = "title"; priority = searchRankingWeights.priority.titleTerms; }
        else if (best?.phrase) { matchKind = "phrase"; priority = searchRankingWeights.priority.phrase; }
        else if (nearTerms && queryTokens.length > 1) { matchKind = "proximity"; priority = searchRankingWeights.priority.proximity; }
        else if (allQueryTerms) { matchKind = "text"; priority = searchRankingWeights.priority.allTerms; }
        else { matchKind = "partial"; priority = searchRankingWeights.priority.partial; }
        let targetSegment = best?.segment ?? null;
        if (assetIntent && targetSegment?.assetKind !== assetIntent.kind) targetSegment = nearestAssetSegment(unit, assetIntent.kind, best?.segmentIndex ?? 0);
        else if (titleExact || titleAll) targetSegment = null;
        const score = priority
          + candidate.matchedTerms * searchRankingWeights.field.matchedTerm
          + candidate.titleFrequency * searchRankingWeights.field.titleFrequency
          + candidate.bodyScore * searchRankingWeights.field.bodyRelevance
          + candidate.assetScore * searchRankingWeights.field.assetRelevance
          + (candidate.numberMatched ? searchRankingWeights.field.exactNumberPrefix : 0)
          + (best?.proximityBoost ?? 0);
        return { unit, score, matchKind, source: titleExact || titleAll ? unit.title : best?.segment.text || unit.title, segment: targetSegment };
      });
      return ranked
        .sort((left, right) => right.score - left.score || left.unit.numbering.localeCompare(right.unit.numbering, "it", { numeric: true }))
        .slice(0, maximum)
        .map(({ unit, source, score, matchKind, segment }) => resultFor(unit, source, normalizedQuery, queryTokens, score, matchKind, segment));
    },
  };
}
