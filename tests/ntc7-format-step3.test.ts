/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const json = async (path: string) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const block = (u: any, prefix: string) => u.blocks.find((x: any) => x.text?.normalized.startsWith(prefix));
const has = (b: any, kind: string, value: string) => b.text.inline.some((x: any) => x.kind === kind && x.value === value);

test("NTC 7 PDF 230-239 conserva liste, enfasi e quantità", async () => {
    const typologies = await json("corpus/units/ntc2018/7.4.3.1.json");
    assert.deepEqual(typologies.blocks.filter((x: any) => x.text?.normalized.startsWith("r² =") || x.text?.normalized.startsWith("lₛ² =")).map((x: any) => [x.kind, x.listMarker, x.listLevel, x.indentLevel]), [["list-item", "none", 1, 1], ["list-item", "none", 1, 1]]);
    const behaviour = await json("corpus/units/ntc2018/7.4.3.2.json");
    assert.deepEqual(behaviour.blocks.filter((x: any) => x.kind === "list-item").map((x: any) => [x.listMarker, x.listLevel]), [["none", undefined], ["dash", 1], ["dash", 1], ["dash", 1], ["none", undefined], ["dash", 1], ["dash", 1], ["dash", 1]]);
    const nodes = await json("corpus/units/ntc2018/7.4.4.3.json");
    assert.deepEqual(nodes.blocks.filter((x: any) => x.kind === "list-item").map((x: any) => x.listMarker), ["dash", "dash"]);
    assert.equal(has(block(nodes, "interamente confinati"), "strong", "interamente confinati:"), true);
    const walls = await json("corpus/units/ntc2018/7.4.4.5.1.json");
    assert.deepEqual(walls.blocks.filter((x: any) => x.kind === "list-item").map((x: any) => x.listMarker), ["none", "none", "none"]);
    assert.equal(has(block(walls, "Verifica a taglio-compressione"), "strong-em", "Verifica a taglio-compressione del calcestruzzo dell’anima"), true);
    const columns = await json("corpus/units/ntc2018/7.4.4.2.1.json");
    assert.equal(has(block(columns, "Per le strutture in CD"), "math", "55%"), true);
    assert.equal(columns.blocks.find((x: any) => x.text?.normalized.startsWith("M_i,d è il momento"))?.kind, "paragraph");
    assert.deepEqual(columns.blocks.filter((x: any) => x.text?.normalized.startsWith("M_c,Rd") || x.text?.normalized.startsWith("M_b,Rd") || x.text?.normalized.startsWith("l_p è")).map((x: any) => [x.kind, x.listMarker]), [["list-item", "none"], ["list-item", "none"], ["list-item", "none"], ["list-item", "none"]]);
});

test("NTC 7 PDF 230-239 conserva le cinque caption di figura", async () => {
    for (const file of ["7.4-step1.json", "7.4-step2.json"]) {
        const manifest = await json(`corpus/assets/ntc2018/${file}`);
        for (const figure of manifest.figures.filter((x: any) => x.pdfPage >= 230 && x.pdfPage <= 239)) {
            assert.deepEqual(figure.captionInline.map((x: any) => x.kind), ["strong", "em"]);
            assert.equal(figure.captionInline.map((x: any) => x.value).join(""), figure.caption);
        }
    }
});
