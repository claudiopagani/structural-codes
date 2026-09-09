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
