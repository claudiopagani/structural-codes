export function mobileIndexExpansion(activeLevelIds, expanded, session) {
  if (expanded.session === session) {
    return { chapterId: expanded.chapterId, paragraphId: expanded.paragraphId };
  }
  return { chapterId: activeLevelIds[0] ?? null, paragraphId: activeLevelIds[1] ?? null };
}
