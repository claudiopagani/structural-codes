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

export function visibleTableNumberSuffix(officialNumber, caption) {
  if (!caption || !officialNumber) return "";
  return new RegExp(`^\\s*Tab(?:ella|\\.)\\s*${escapeRegExp(officialNumber)}\\s*\\)`, "iu").test(caption) ? ")" : "";
}
