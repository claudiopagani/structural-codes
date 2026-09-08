import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
// I record canonici contengono forme eterogenee di blocco.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(root, relativePath), "utf8"));
}

test("Circolare C4.5 conserva gerarchia e matematica inline verificate", async () => {
    for (const name of ["c4.5", "c4.5.2", "c4.5.2.2", "c4.5.2.2.1", "c4.5.2.3", "c4.5.4", "c4.5.5", "c4.5.6", "c4.5.6.1", "c4.5.6.2", "c4.5.6.4", "c4.5.7", "c4.5.8"]) {
        const unit = await json(`corpus/units/circ2019/${name}.json`);
        assert.equal(unit.blocks[0].kind, "heading", name);
    }

    const unit = await json("corpus/units/circ2019/c4.5.6.2.json");
    const math = unit.blocks.flatMap((block: { text?: { inline?: { kind: string; latex?: string }[] } }) =>
        block.text?.inline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex) ?? [],
    );
    for (const latex of ["\\Phi", "e_l", "f_{d,\\mathrm{rid}}", "\\Phi_1", "m=6e_l/l", "\\lambda=0", "N_d\\le\\Phi\\Phi_1 f_d t l", "e_a", "e_1"]) {
        assert.ok(math.includes(latex), latex);
    }
});
