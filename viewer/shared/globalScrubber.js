function clampRatio(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function buildGlobalScrubberEntries(entries, maximumLevel = Number.POSITIVE_INFINITY) {
  const visibleEntries = Number.isFinite(maximumLevel) ? entries.filter((entry) => entry.level <= maximumLevel) : entries;
  const lastIndex = Math.max(0, visibleEntries.length - 1);
  return visibleEntries.map((entry, index) => ({
    ...entry,
    index,
    ratio: lastIndex === 0 ? 0 : index / lastIndex,
  }));
}

export function globalScrubberAnnotationRatios(allEntries, scrubberEntries) {
  const visibleRatios = new Map(scrubberEntries.map((entry) => [entry.id, entry.ratio]));
  const visiblePositions = allEntries.flatMap((entry, index) => visibleRatios.has(entry.id) ? [{ index, ratio: visibleRatios.get(entry.id) }] : []);
  const ratios = new Map();
  let nextVisible = 0;
  for (const [index, entry] of allEntries.entries()) {
    while (nextVisible < visiblePositions.length && visiblePositions[nextVisible].index < index) nextVisible += 1;
    const previous = visiblePositions[nextVisible - 1] ?? visiblePositions[0];
    const next = visiblePositions[nextVisible] ?? visiblePositions.at(-1);
    if (!previous || !next) continue;
    const span = next.index - previous.index;
    ratios.set(entry.id, span === 0 ? previous.ratio : previous.ratio + (next.ratio - previous.ratio) * (index - previous.index) / span);
  }
  return ratios;
}

export function globalScrubberEntryAtRatio(entries, ratio) {
  if (entries.length === 0) return null;
  const index = Math.round(clampRatio(ratio) * (entries.length - 1));
  return entries[index] ?? null;
}

export function globalScrubberRatioForId(entries, id, fallbackRatio = 0) {
  if (entries.length < 2) return 0;
  const entry = entries.find((candidate) => candidate.id === id);
  return entry?.ratio ?? clampRatio(fallbackRatio);
}

export function resolveGlobalScrubberActiveId(entries, activeId, activeBaseNumber) {
  if (activeId && entries.some((entry) => entry.id === activeId)) return activeId;
  if (!activeBaseNumber) return null;
  const exactEntry = entries.find((entry) => entry.baseNumber === activeBaseNumber);
  if (exactEntry) return exactEntry.id;
  let closestAncestor = null;
  for (const entry of entries) {
    if (!activeBaseNumber.startsWith(`${entry.baseNumber}.`)) continue;
    if (!closestAncestor || entry.baseNumber.length > closestAncestor.baseNumber.length) closestAncestor = entry;
  }
  return closestAncestor?.id ?? null;
}

export function globalScrubberKeyboardIndex(currentIndex, key, entryCount) {
  if (entryCount <= 0) return -1;
  const lastIndex = entryCount - 1;
  const safeIndex = Math.max(0, Math.min(lastIndex, currentIndex));
  const pageStep = Math.max(1, Math.round(entryCount * 0.1));
  if (key === "Home") return 0;
  if (key === "End") return lastIndex;
  if (key === "ArrowUp") return Math.max(0, safeIndex - 1);
  if (key === "ArrowDown") return Math.min(lastIndex, safeIndex + 1);
  if (key === "PageUp") return Math.max(0, safeIndex - pageStep);
  if (key === "PageDown") return Math.min(lastIndex, safeIndex + pageStep);
  return safeIndex;
}

export function createGlobalScrubberDragSession(entries, onCommit) {
  let current = null;
  let finished = false;
  return {
    preview(ratio) {
      if (!finished) current = globalScrubberEntryAtRatio(entries, ratio);
      return current;
    },
    commit() {
      if (finished) return null;
      finished = true;
      if (current) onCommit(current);
      return current;
    },
    cancel() {
      finished = true;
    },
  };
}
