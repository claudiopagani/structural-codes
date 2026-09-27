function clampRatio(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function buildGlobalScrubberEntries(entries) {
  const lastIndex = Math.max(0, entries.length - 1);
  return entries.map((entry, index) => ({
    ...entry,
    index,
    ratio: lastIndex === 0 ? 0 : index / lastIndex,
  }));
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
  return entries.find((entry) => entry.baseNumber === activeBaseNumber)?.id ?? null;
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
