import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Block = {
  kind: string;
  listMarker?: string;
  text?: { raw: string; normalized: string; inline?: Array<{ kind: string; value: string }> };
  evidence?: { rawSha256: string; normalizedSha256: string; transformations: Array<{ operation: string; ruleVersion: string; note: string }> };
};
type Unit = { blocks: Block[] };
const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc12-editorial-formatting-0.1.0";
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const path = join(root, "corpus/units/ntc2018/12.json");
const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
for (const index of [2, 3, 4, 6, 7, 8, 9]) {
  const block = unit.blocks[index]!;
  const text = block.text!;
  if (!text.normalized.startsWith("- ")) throw new Error(`Trattino ufficiale atteso nel blocco ${index}.`);
  block.kind = "list-item";
  block.listMarker = "dash";
  text.normalized = text.normalized.slice(2);
  if (text.inline?.[0]?.kind === "text") {
    text.inline[0].value = text.inline[0].value.replace(/^-\s*/, "");
    if (!text.inline[0].value) text.inline.shift();
  }
  if (block.evidence && !block.evidence.transformations.some((entry) => entry.ruleVersion === profile)) {
    block.evidence.transformations.push({
      operation: "manual-correction",
      ruleVersion: profile,
      note: "Esplicitato il marcatore con trattino e il relativo rientro, verificati nel render della fonte ufficiale.",
    });
  }
}
for (const block of unit.blocks) {
  if (block.text && block.evidence) {
    block.evidence.rawSha256 = hash(block.text.raw);
    block.evidence.normalizedSha256 = hash(block.text.normalized);
  }
}
await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
