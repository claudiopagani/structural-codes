import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

async function json(relativePath: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return JSON.parse(await readFile(join(root, relativePath), "utf8"));
}

test("NTC 4.6 e Circolare C4.6 conservano il perimetro senza asset", async () => {
    const [ntc, circ] = await Promise.all([
        json("corpus/units/ntc2018/4.6.json"),
        json("corpus/units/circ2019/c4.6.json"),
    ]);
    assert.deepEqual(ntc.assets, { formulaIds: [], tableIds: [], figureIds: [] });
    assert.deepEqual(circ.assets, { formulaIds: [], tableIds: [], figureIds: [] });
    assert.equal(ntc.blocks.filter((block: { kind: string }) => block.kind === "paragraph").length, 4);
    assert.equal(circ.blocks.filter((block: { kind: string }) => block.kind === "paragraph").length, 7);
});

test("C4.6 conserva in corsivo la definizione citata", async () => {
    const unit = await json("corpus/units/circ2019/c4.6.json");
    const phrase = "sistemi costruttivi diversi da quelli disciplinati dalle presenti norme tecniche";
    const block = unit.blocks.find((candidate: { text?: { normalized: string } }) => candidate.text?.normalized.includes(phrase));
    assert.ok(block);
    assert.deepEqual(block.text.inline, [
        { kind: "text", value: "Le NTC chiariscono che si intendono per “" },
        { kind: "em", value: phrase },
        { kind: "text", value: "” quelli per cui le regole di progettazione ed esecuzione non siano previste nelle NTC stesse o nei riferimenti tecnici e nei documenti di comprovata validità di cui al Capitolo 12, nel rispetto dei livelli di sicurezza previsti dalle norme tecniche. Si estende quindi il concetto di sistemi costruttivi disciplinati dalla normativa tecnica nazionale, oltre a quelli esplicitamente trattati (quali strutture in c.a. e c.a.p., in carpenteria metallica, miste acciaio-cls, in legno ed in muratura), anche ai sistemi costruttivi le cui regole di progettazione siano riportate nei documenti di comprovata validità di cui al Capitolo 12, nel rispetto dei livelli di sicurezza delle norme tecniche nazionali. In altre parole si intendono disciplinati dalle norme tecniche nazionali anche quei sistemi costruttivi compiutamente trattati negli Eurocodici, quali, a mero titolo esemplificativo, quelli basati sull’impiego dell’alluminio, a condizione che siano applicate le Appendici nazionali italiane agli stessi Eurocodici." },
    ]);
});
