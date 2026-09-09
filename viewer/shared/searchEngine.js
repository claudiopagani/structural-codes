export const searchIndexFormatVersion = 3;

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
  for (let position = 0; position < posting.length; position += 3) {
    appendVarint(bytes, posting[position] - previousUnitIndex);
    appendVarint(bytes, posting[position + 1]);
    appendVarint(bytes, posting[position + 2]);
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
    values.push(previousUnitIndex, readVarint(), readVarint());
  }
  return values;
}

export function buildSearchIndexPayload(sourceUnits) {
  const postings = new Map();
  const references = new Map();
  const units = sourceUnits.map((unit, unitIndex) => {
    const titleNormalized = normalizeSearchText(unit.title);
    const titleTokens = tokenizeSearchText(titleNormalized);
    const textTokens = tokenizeSearchText(unit.text);
    const titleTerms = frequencies(titleTokens);
    const textTerms = frequencies(textTokens);
    const allTerms = new Set([...titleTerms.keys(), ...textTerms.keys()]);
    for (const term of allTerms) {
      const posting = postings.get(term) ?? [];
      posting.push(unitIndex, titleTerms.get(term) ?? 0, textTerms.get(term) ?? 0);
      postings.set(term, posting);
    }
    const numbering = unit.numbering.replace(/^C/iu, "");
    const reference = references.get(numbering) ?? [-1, -1];
    reference[unit.document === "ntc2018" ? 0 : 1] = unitIndex;
    references.set(numbering, reference);
    return {
      id: unit.id,
      document: unit.document,
      numbering: unit.numbering,
      title: unit.title,
      titleNormalized,
      chunkPath: unit.chunkPath,
      text: unit.text,
      textLength: textTokens.length,
    };
  });
  return {
    formatVersion: searchIndexFormatVersion,
    normalization: "NFKC lowercase it-IT; apostrophe and whitespace folding; tokenization at build time",
    units,
    references: Object.fromEntries([...references].sort(([left], [right]) => left.localeCompare(right, "it", { numeric: true }))),
    postings: Object.fromEntries([...postings].sort(([left], [right]) => left.localeCompare(right, "it")).map(([term, posting]) => [term, encodePosting(posting)])),
  };
}

function documentAllowed(document, mode) {
  return mode === "combined" || (mode === "ntc" ? document === "ntc2018" : document === "circ2019");
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
        offsets.push(offset);
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

function highlightedSnippet(value, normalizedQuery, queryTokens) {
  const source = String(value ?? "").replace(/\s+/gu, " ").trim();
  if (!source) return { snippet: "", highlights: [] };
  const folded = foldWithOffsets(source);
  let normalizedOffset = normalizedQuery ? folded.normalized.indexOf(normalizedQuery) : -1;
  if (normalizedOffset < 0) {
    normalizedOffset = queryTokens.map((token) => folded.normalized.indexOf(token)).find((offset) => offset >= 0) ?? -1;
  }
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
      const to = excerptFolded.offsets[found + token.length] ?? Math.min(excerpt.length, from + token.length);
      ranges.push([from, Math.max(from + 1, to)]);
      offset = found + Math.max(1, token.length);
    }
  }
  const prefix = start > 0 ? "…" : "";
  const snippet = `${prefix}${excerpt}${end < source.length ? "…" : ""}`;
  return { snippet, highlights: mergeRanges(ranges).map(([from, to]) => [from + prefix.length, to + prefix.length]) };
}

function resultFor(unit, normalizedQuery, queryTokens, score, matchKind) {
  const source = unit.text || unit.title;
  return {
    id: unit.id,
    document: unit.document,
    numbering: unit.numbering,
    title: unit.title,
    chunkPath: unit.chunkPath,
    ...highlightedSnippet(source, normalizedQuery, queryTokens),
    score: Math.round(score),
    matchKind,
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
  return unit ? [resultFor(unit, "", [], 4_000_000, "number-exact")] : [];
}

export function createSearchEngine(index) {
  if (index.formatVersion !== searchIndexFormatVersion) throw new Error(`Formato indice ricerca non supportato: ${index.formatVersion}`);
  const normalizedTextCache = new Map();
  const postingCache = new Map();
  return {
    search({ query, mode = "combined", limit = 12 }) {
      const maximum = Math.max(1, Math.min(50, Number(limit) || 12));
      const reference = parseNormativeReference(query);
      if (reference) return exactReferenceResult(index, reference, mode).slice(0, maximum);
      const normalizedQuery = normalizeSearchText(query);
      const queryTokens = [...new Set(tokenizeSearchText(normalizedQuery))];
      if (normalizedQuery.length < 2 || queryTokens.length === 0) return [];
      const candidates = new Map();
      for (const token of queryTokens) {
        const encodedPosting = index.postings[token];
        if (!encodedPosting) continue;
        let posting = postingCache.get(token);
        if (!posting) {
          posting = decodePosting(encodedPosting);
          postingCache.set(token, posting);
        }
        const documentFrequency = posting.length / 3;
        const inverseFrequency = Math.log(1 + index.units.length / Math.max(1, documentFrequency));
        for (let position = 0; position < posting.length; position += 3) {
          const unitIndex = posting[position];
          const unit = index.units[unitIndex];
          if (!documentAllowed(unit.document, mode)) continue;
          const candidate = candidates.get(unitIndex) ?? { unitIndex, matchedTerms: 0, titleFrequency: 0, textScore: 0 };
          candidate.matchedTerms += 1;
          candidate.titleFrequency += posting[position + 1];
          candidate.textScore += inverseFrequency * (posting[position + 2] / Math.max(1, Math.sqrt(unit.textLength)));
          candidates.set(unitIndex, candidate);
        }
      }
      const allTerms = [...candidates.values()].filter((candidate) => candidate.matchedTerms === queryTokens.length);
      const pool = (allTerms.length > 0 ? allTerms : [...candidates.values()])
        .sort((left, right) => right.matchedTerms - left.matchedTerms || right.titleFrequency - left.titleFrequency || right.textScore - left.textScore)
        .slice(0, Math.max(250, maximum * 24));
      const ranked = pool.map((candidate) => {
        const unit = index.units[candidate.unitIndex];
        const titleMatch = unit.titleNormalized.includes(normalizedQuery)
          || queryTokens.every((token) => unit.titleNormalized.includes(token));
        let normalizedText = normalizedTextCache.get(candidate.unitIndex);
        if (normalizedText === undefined) {
          normalizedText = normalizeSearchText(unit.text);
          normalizedTextCache.set(candidate.unitIndex, normalizedText);
        }
        const phraseMatch = queryTokens.length > 1 && normalizedText.includes(normalizedQuery);
        const matchKind = titleMatch ? "title" : phraseMatch ? "phrase" : "text";
        const priority = titleMatch ? 3_000_000 : phraseMatch ? 2_000_000 : 1_000_000;
        const score = priority + candidate.matchedTerms * 10_000 + candidate.titleFrequency * 1_000 + candidate.textScore * 100;
        return { unit, score, matchKind };
      });
      return ranked
        .sort((left, right) => right.score - left.score || left.unit.numbering.localeCompare(right.unit.numbering, "it", { numeric: true }))
        .slice(0, maximum)
        .map(({ unit, score, matchKind }) => resultFor(unit, normalizedQuery, queryTokens, score, matchKind));
    },
  };
}
