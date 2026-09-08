/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const json = async (path: string) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const block = (u: any, prefix: string) => u.blocks.find((x: any) => x.text?.normalized.startsWith(prefix));
const has = (b: any, kind: string, value: string) => b.text.inline.some((x: any) => x.kind === kind && x.value === value);

test("NTC 7 PDF 230-239 conserva liste, enfasi e quantità", async () => {
    const nodes = await json("corpus/units/ntc2018/7.4.4.3.json");
    assert.deepEqual(nodes.blocks.filter((x: any) => x.kind === "list-item").map((x: any) => x.listMarker), ["dash", "dash"]);
    assert.equal(has(block(nodes, "interamente confinati"), "strong", "interamente confinati:"), true);
    const walls = await json("corpus/units/ntc2018/7.4.4.5.1.json");
    assert.deepEqual(walls.blocks.filter((x: any) => x.kind === "list-item").map((x: any) => x.listMarker), ["none", "none", "none"]);
    assert.equal(has(block(walls, "Verifica a taglio-compressione"), "em", "Verifica a taglio-compressione del calcestruzzo dell’anima"), true);
    const columns = await json("corpus/units/ntc2018/7.4.4.2.1.json");
    assert.equal(has(block(columns, "Per le strutture in CD"), "math", "55%"), true);
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
