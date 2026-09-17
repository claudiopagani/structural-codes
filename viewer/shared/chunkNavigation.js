export function navigationChunkWindow(lookup, targetPath) {
  const position = lookup?.chunkIndexByPath.get(targetPath);
  if (position === undefined) return { previous: null, target: targetPath, next: null };
  return {
    previous: lookup.chunkPaths[position - 1] ?? null,
    target: targetPath,
    next: lookup.chunkPaths[position + 1] ?? null,
  };
}

export function navigationChunkPaths(lookup, targetPath) {
  const window = navigationChunkWindow(lookup, targetPath);
  return [window.previous, window.target, window.next].filter(Boolean);
}

export function isChunkNearRenderedWindow(lookup, targetPath, renderedPaths) {
  const position = lookup?.chunkIndexByPath.get(targetPath);
  if (position === undefined) return false;
  return [position - 1, position, position + 1].some((candidate) => {
    const path = lookup.chunkPaths[candidate];
    return Boolean(path && renderedPaths.has(path));
  });
}

export function primarySummaryForVisibleUnit(lookup, unitId, primaryAnchorByFallbackId) {
  return lookup?.unitById.get(unitId) ?? primaryAnchorByFallbackId?.get(unitId) ?? null;
}

export function progressiveChunkTargetsForVisibleUnit(lookup, unitId, primaryAnchorByFallbackId) {
  const summary = primarySummaryForVisibleUnit(lookup, unitId, primaryAnchorByFallbackId);
  if (!lookup || !summary) return { previous: null, next: null };
  const chunkUnits = lookup.unitsByChunkPath.get(summary.chunkPath) ?? [];
  const position = chunkUnits.findIndex((unit) => unit.id === summary.id);
  if (position < 0) return { previous: null, next: null };
  const adjacent = navigationChunkWindow(lookup, summary.chunkPath);
  return {
    previous: position <= 1 ? adjacent.previous : null,
    next: position >= chunkUnits.length - 2 ? adjacent.next : null,
  };
}
