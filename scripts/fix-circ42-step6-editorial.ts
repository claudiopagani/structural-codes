import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Block = { blockId: string; kind: string; listMarker?: "bullet" | "dash" | "none" };
type Unit = { blocks: Block[] };

const path = join(process.cwd(), "corpus", "units", "circ2019", "c4.2.12.1.7.7.1.json");
const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
const items = unit.blocks.filter((block) => block.kind === "list-item");
if (items.length !== 2 || !items.every((block) => /#block-item-[12]$/u.test(block.blockId))) {
    throw new Error("Le due voci finali di C4.2.12.1.7.7.1 non sono state trovate");
}
for (const item of items) item.listMarker = "dash";
await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
