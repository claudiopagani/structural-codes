import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const unitsDir = join(root, "corpus", "units", "circ2019");
const profile = "circ8-c88-step1-editorial-0.1.0";

type Inline = { kind: "text" | "math" | "em"; value: string; latex?: string };
type Evidence = { transformations?: Array<{ operation: string; ruleVersion: string; note: string }>; rawSha256?: string; normalizedSha256?: string };
type Text = { raw?: string; normalized: string; inline?: Inline[]; normalizationVersion?: string };
type Block = { blockId: string; kind: string; text?: Text; evidence?: Evidence; listMarker?: string; listLevel?: number; [key: string]: unknown };
type Unit = { blocks: Block[] };

async function readJson<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function addTransformation(block: Block, note: string): void {
    if (!block.evidence) return;
    block.evidence.transformations ??= [];
    if (!block.evidence.transformations.some((item) => item.ruleVersion === profile && item.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

function updateHashes(block: Block): void {
    if (!block.text || !block.evidence) return;
    if (block.text.raw !== undefined) block.evidence.rawSha256 = createHash("sha256").update(block.text.raw, "utf8").digest("hex");
    block.evidence.normalizedSha256 = createHash("sha256").update(block.text.normalized, "utf8").digest("hex");
}

function mergeWithNext(unit: Unit, index: number, note: string): void {
    const first = unit.blocks[index];
    const second = unit.blocks[index + 1];
    if (!first?.text || !second?.text) throw new Error("Capoversi da unire privi di testo");
    first.text.normalized = `${first.text.normalized.trimEnd()} ${second.text.normalized.trimStart()}`;
    first.text.raw = `${first.text.raw ?? first.text.normalized} ${second.text.raw ?? second.text.normalized}`;
    first.text.inline = undefined;
    first.text.normalizationVersion = profile;
    updateHashes(first);
    addTransformation(first, note);
    unit.blocks.splice(index + 1, 1);
}

function setEmphasis(block: Block, token: string): void {
    if (!block.text || block.text.inline?.some((segment) => segment.kind === "em" && segment.value === token)) return;
    const source = block.text.normalized;
    const at = source.indexOf(token);
    if (at < 0) throw new Error(`Titolo non trovato: ${token}`);
    block.text.inline = [
        ...(at > 0 ? [{ kind: "text" as const, value: source.slice(0, at) }] : []),
        { kind: "em", value: token },
        ...(at + token.length < source.length ? [{ kind: "text" as const, value: source.slice(at + token.length) }] : []),
    ];
    block.text.normalizationVersion = profile;
    addTransformation(block, `Applicata la resa in corsivo del titolo ${token} verificata sul PDF ufficiale.`);
}

function replaceMath(block: Block, plain: string, latex: string, note: string): void {
    if (!block.text) throw new Error("Blocco senza testo per la matematica");
    const source = block.text.normalized;
    const at = source.indexOf(plain);
    if (at < 0) throw new Error(`Espressione non trovata: ${plain}`);
    block.text.normalized = source.replace(plain, plain);
    block.text.inline = [
        ...(at > 0 ? [{ kind: "text" as const, value: source.slice(0, at) }] : []),
        { kind: "math", value: plain, latex },
        ...(at + plain.length < source.length ? [{ kind: "text" as const, value: source.slice(at + plain.length) }] : []),
    ];
    block.text.normalizationVersion = profile;
    addTransformation(block, note);
    updateHashes(block);
}

function makeDashListItem(block: Block, note: string): void {
    if (!block.text || !/^\s*-/u.test(block.text.normalized)) return;
    block.kind = "list-item";
    block.listMarker = "dash";
    block.listLevel = 0;
    block.text.normalized = block.text.normalized.replace(/^\s*[-–]\s*/u, "");
    block.text.raw = block.text.raw?.replace(/^\s*[-–]\s*/u, "");
    block.text.inline = undefined;
    block.text.normalizationVersion = profile;
    addTransformation(block, note);
    updateHashes(block);
}

const c884 = await readJson<Unit>(join(unitsDir, "c8.8.4.json"));
if (c884.blocks.length === 3 && c884.blocks[1]?.text?.normalized.endsWith("disponibile") && c884.blocks[2]?.text?.normalized.startsWith("e dalle ulteriori")) {
    mergeWithNext(c884, 1, "Ricostruito il capoverso unico verificato sul PDF ufficiale.");
}
await writeJson(join(unitsDir, "c8.8.4.json"), c884);

const c8853 = await readJson<Unit>(join(unitsDir, "c8.8.5.3.json"));
for (const token of ["Ponti a travi semplicemente appoggiate", "Ponti con impalcato continuo"]) {
    const block = c8853.blocks.find((candidate) => candidate.kind === "list-item" && candidate.text?.normalized.includes(token));
    if (!block) throw new Error(`Titolo dei casi non trovato: ${token}`);
    setEmphasis(block, token);
}
await writeJson(join(unitsDir, "c8.8.5.3.json"), c8853);

const c8855 = await readJson<Unit>(join(unitsDir, "c8.8.5.5.json"));
for (const block of c8855.blocks.slice(2, 4)) makeDashListItem(block, "Reso esplicito l’elenco puntato dei valori della domanda verificato sul PDF ufficiale.");
const thetaDemand = c8855.blocks[3];
if (!thetaDemand?.text) throw new Error("Voce θ della domanda non trovata in C8.8.5.5");
if (!thetaDemand.text.normalized.includes("θ > θ_y")) {
    thetaDemand.text.normalized = thetaDemand.text.normalized.replace("quando risulta per", "quando risulta θ > θ_y per");
    thetaDemand.text.raw = thetaDemand.text.raw?.replace("quando risulta per", "quando risulta θ > θ_y per");
    thetaDemand.text.normalizationVersion = profile;
    updateHashes(thetaDemand);
    addTransformation(thetaDemand, "Reintegrata la condizione θ > θ_y verificata sul PDF ufficiale.");
}
replaceMath(thetaDemand, "θ > θ_y", "\\theta>\\theta_y", "Resa in matematica inline la condizione θ > θ_y verificata sul PDF ufficiale.");
await writeJson(join(unitsDir, "c8.8.5.5.json"), c8855);

const c887 = await readJson<Unit>(join(unitsDir, "c8.8.7.json"));
const zeta = c887.blocks.find((block) => block.text?.normalized.includes("E=0,80"));
if (!zeta?.text) throw new Error("Parametro ζ_E finale di C8.8.7 non trovato");
zeta.text.normalized = zeta.text.normalized.replace("E=0,80", "ζ_E=0,80");
replaceMath(zeta, "ζ_E=0,80", "\\zeta_E=0{,}80", "Ripristinato il parametro ζ_E in matematica inline secondo il PDF ufficiale.");
await writeJson(join(unitsDir, "c8.8.7.json"), c887);

console.log("fix-circ8-c88-step1-editorial: C8.8.4, C8.8.5.3, C8.8.5.5 e C8.8.7 aggiornati");
