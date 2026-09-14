import fs from "node:fs";
import path from "node:path";

const repositoryRoot = process.cwd();
const ruleVersion = "continuous-note-flow-0.1.0";
const transformationNote =
  "Collocata la nota subito dopo il richiamo per la resa in scorrimento continuo; il testo normativo resta invariato.";

type JsonRecord = Record<string, unknown>;
type Unit = JsonRecord & { blocks: JsonRecord[] };

interface Placement {
  source: string;
  notePrefix: string;
  afterPrefix: string;
  destination?: string;
  destinationBlockPrefix?: string;
  kind?: string;
}

const placements: Placement[] = [
  { source: "circ2019/c3.2.1.json", notePrefix: "² Si veda al riguardo", afterPrefix: "Strategie progettuali alternative", kind: "footnote" },
  { source: "circ2019/c6.json", notePrefix: "Il primo passo della progettazione geotecnica", afterPrefix: "Per progettazione geotecnica si intende" },
  { source: "circ2019/c7.1.json", notePrefix: "Pur essendo la capacità", afterPrefix: "La norma indica, per ciascuno stato limite" },
  { source: "circ2019/c7.2.1.json", notePrefix: "Questo requisito è essenziale", afterPrefix: "Nel caso in cui in un edificio" },
  { source: "circ2019/c7.2.2.json", notePrefix: "I fattori di sovraresistenza", afterPrefix: "Per conseguire gli obiettivi insiti" },
  { source: "circ2019/c7.2.2.json", notePrefix: "Per evitare che, in forza", afterPrefix: "Per una struttura alla quale" },
  { source: "circ2019/c7.2.3.json", notePrefix: "Per facilitare la progettazione", afterPrefix: "Elementi Secondari" },
  { source: "circ2019/c7.2.6.json", notePrefix: "Il coefficiente di fessurazione", afterPrefix: "La norma precisa che in ogni caso" },
  { source: "circ2019/c7.2.6.json", notePrefix: "Si specifica che l’eccentricità accidentale", afterPrefix: "Per semplicità di analisi" },
  { source: "circ2019/c7.3.3.1.json", notePrefix: "L’analisi lineare dinamica", afterPrefix: "C7.3.3.1 ANALISI LINEARE DINAMICA" },
  { source: "circ2019/c7.3.3.2.json", notePrefix: "L’analisi lineare statica", afterPrefix: "C7.3.3.2 ANALISI LINEARE STATICA" },
  { source: "circ2019/c8.2.json", notePrefix: "Per quanto riguarda le costruzioni esistenti", afterPrefix: "In generale, la valutazione della sicurezza" },
  { source: "circ2019/c8.4.json", notePrefix: "È opportuno che gli interventi", afterPrefix: "Le NTC confermano le tre categorie" },
  { source: "circ2019/c8.5.4.1.json", notePrefix: "³Dalla formula emerge", afterPrefix: "Nel determinare la stima aggiornata" },
  { source: "circ2019/c11.1.json", notePrefix: "1 http://ec.europa.eu", afterPrefix: "Mediante lo strumento informatico" },
  {
    source: "circ2019/c7.4.json",
    notePrefix: "Le verifiche sugli elementi strutturali",
    afterPrefix: "Nelle verifiche di cui al § 7.3.6.1",
    destination: "circ2019/c7.3.6.1.json",
    destinationBlockPrefix: "Nelle verifiche di cui al § 7.3.6.1",
  },
];

function readUnit(relativePath: string): Unit {
  const unit = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "corpus/units", relativePath), "utf8")) as Unit;
  if (!Array.isArray(unit.blocks)) throw new Error(`Unità senza blocchi: ${relativePath}`);
  return unit;
}

function blockText(block: JsonRecord): string {
  const text = block.text as JsonRecord | undefined;
  return typeof text?.normalized === "string" ? text.normalized : "";
}

function findBlockIndex(unit: Unit, prefix: string, label: string): number {
  const index = unit.blocks.findIndex((block) => blockText(block).startsWith(prefix));
  if (index < 0) throw new Error(`Blocco non trovato (${label}): ${prefix}`);
  return index;
}

function findBlockIndexOrNull(unit: Unit, prefix: string): number | null {
  const index = unit.blocks.findIndex((block) => blockText(block).startsWith(prefix));
  return index < 0 ? null : index;
}

function addTransformation(block: JsonRecord): void {
  const evidence = block.evidence as JsonRecord | undefined;
  if (!evidence) throw new Error(`Blocco senza evidence: ${String(block.blockId)}`);
  const transformations = (evidence.transformations ?? []) as JsonRecord[];
  if (!transformations.some((item) => item.ruleVersion === ruleVersion)) {
    transformations.push({ operation: "manual-correction", ruleVersion, note: transformationNote });
  }
  evidence.transformations = transformations;
}

function takeNote(unit: Unit, prefix: string, relativePath: string): JsonRecord {
  const index = findBlockIndex(unit, prefix, `nota in ${relativePath}`);
  const note = unit.blocks[index];
  if (!note) throw new Error(`Nota non disponibile alla posizione ${index}: ${relativePath}`);
  if (note.kind !== "footnote" && note.kind !== "paragraph") {
    throw new Error(`Il blocco candidato non è una nota: ${String(note.blockId)}`);
  }
  unit.blocks.splice(index, 1);
  return note;
}

function insertAfter(unit: Unit, note: JsonRecord, prefix: string, relativePath: string): void {
  const index = findBlockIndex(unit, prefix, `richiamo in ${relativePath}`);
  unit.blocks.splice(index + 1, 0, note);
}

function writeUnit(relativePath: string, unit: Unit): void {
  fs.writeFileSync(path.join(repositoryRoot, "corpus/units", relativePath), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

function removeDuplicateNote(relativePath: string, prefix: string): void {
  const unit = readUnit(relativePath);
  const index = findBlockIndexOrNull(unit, prefix);
  if (index === null) return;
  const duplicate = unit.blocks[index];
  if (!duplicate || duplicate.kind !== "footnote") throw new Error(`Il duplicato non è una nota: ${relativePath}`);
  unit.blocks.splice(index, 1);
  writeUnit(relativePath, unit);
}

function applyPlacement(placement: Placement): void {
  const sourceUnit = readUnit(placement.source);
  const destinationPath = placement.destination ?? placement.source;
  const destinationUnit = destinationPath === placement.source ? sourceUnit : readUnit(destinationPath);
  const sourceNoteIndex = findBlockIndexOrNull(sourceUnit, placement.notePrefix);
  if (sourceNoteIndex === null && destinationPath !== placement.source) {
    if (findBlockIndexOrNull(destinationUnit, placement.notePrefix) !== null) return;
    throw new Error(`Nota non trovata né nella sorgente né nella destinazione: ${placement.notePrefix}`);
  }
  const note = takeNote(sourceUnit, placement.notePrefix, placement.source);
  const previousKind = note.kind;
  if (placement.kind) note.kind = placement.kind;
  if (destinationPath !== placement.source) {
    const destinationId = destinationUnit.id;
    if (typeof destinationId !== "string") throw new Error(`Unità di destinazione senza id: ${destinationPath}`);
    note.blockId = `${destinationId}#block-footnote-010`;
  }
  addTransformation(note);
  insertAfter(destinationUnit, note, placement.destinationBlockPrefix ?? placement.afterPrefix, destinationPath);
  if (placement.kind && previousKind !== placement.kind) addTransformation(note);
  writeUnit(placement.source, sourceUnit);
  if (destinationPath !== placement.source) writeUnit(destinationPath, destinationUnit);
}

// The PDF has one footnote ⁷, attached to the C7.2.6 paragraph. A previous
// split duplicated it at the end of C7.3.1; remove only that unsupported copy.
removeDuplicateNote("circ2019/c7.3.1.json", "Si specifica che l’eccentricità accidentale");

for (const placement of placements) applyPlacement(placement);

console.log(`Continuous note flow: applied ${placements.length} placements and removed 1 duplicate note.`);
