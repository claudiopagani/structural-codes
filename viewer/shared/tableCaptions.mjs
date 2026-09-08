function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function tableCaptionPrefix(officialNumber) {
  return new RegExp(
    `^\\s*Tab(?:ella|\\.)\\s*${escapeRegExp(officialNumber)}(?:\\s*\\))?(?:\\s*[–—-])?\\s*`,
    "iu",
  );
}

export function visibleTableCaption(officialNumber, caption) {
  if (!caption || !officialNumber) return caption;
  return caption.replace(tableCaptionPrefix(officialNumber), "").trim();
}

export function visibleTableCaptionInline(officialNumber, caption, inline) {
  if (!inline || !caption || !officialNumber) return inline;
  const prefix = caption.match(tableCaptionPrefix(officialNumber))?.[0] ?? "";
  let remaining = prefix.length;
  return inline.flatMap((segment) => {
    if (remaining === 0) return [segment];
    if (segment.value.length <= remaining) {
      remaining -= segment.value.length;
      return [];
    }
    const value = segment.value.slice(remaining);
    remaining = 0;
    return [{ ...segment, value }];
  });
}

export function visibleTableNumberSuffix(officialNumber, caption) {
  if (!caption || !officialNumber) return "";
  return new RegExp(`^\\s*Tab(?:ella|\\.)\\s*${escapeRegExp(officialNumber)}\\s*\\)`, "iu").test(caption) ? ")" : "";
}
