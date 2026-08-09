const editorialTableNotePatterns = [
  /^\s*\[(?:TABELLA|ASSET)_[^\]]+\]/i,
  /\bevidence\b/i,
  /\b(?:revisione|review) (?:umana|visuale)\b/i,
  /\bverifica (?:manuale|umana|visuale)\b/i,
  /\bconfronto cella per cella\b/i,
  /\btrascritt[aoe]\b/i,
  /\btrascrizione\b/i,
  /\brender\b/i,
  /\bpagin[ae] PDF\b/i,
  /\bgriglia ricostruita automaticamente\b/i,
  /\bmodello corrente\b/i,
  /\bschema corrente\b/i,
  /\bdescrizion[ei] (?:testuali|strutturat[ae])\b/i,
  /\bnon rappresentabil[ei]\b/i,
  /\bissue bloccante\b/i,
  /\bprima della pubblicazione\b/i,
];

/**
 * Le note canoniche possono contenere sia testo ufficiale sia annotazioni di
 * lavorazione. Il viewer di lettura mostra soltanto ciò che può appartenere
 * alla fonte normativa; le annotazioni restano disponibili nei manifest.
 *
 * @param {string} note
 */
export function isEditorialTableNote(note) {
  return editorialTableNotePatterns.some((pattern) => pattern.test(note));
}

/** @param {string[]} notes */
export function visibleTableNotes(notes) {
  return notes.filter((note) => !isEditorialTableNote(note));
}
