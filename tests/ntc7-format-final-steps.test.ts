/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const json = async (path: string) => JSON.parse(await readFile(new URL(path, root), "utf8"));

test("NTC 7 PDF 260-292 conserva marcatori, etichette e sigle in corsivo", async () => {
    for (const fileName of await readdir(new URL("corpus/units/ntc2018/", root))) {
        if (!fileName.startsWith("7.")) continue;
        const unit = await json(`corpus/units/ntc2018/${fileName}`);
        for (const block of unit.blocks) {
            const page = block.evidence?.pdfPage ?? 0;
            if (page < 260 || page > 292 || !block.text) continue;
            if (block.kind === "list-item") {
                assert.ok(block.listMarker, `${fileName}:${block.blockId}`);
                const label = (block.text.raw ?? "").trimStart().match(/^([a-z]\)|\d+\.)\s/u)?.[1];
                if (label) {
                    assert.ok(block.text.normalized.startsWith(`${label} `), `${fileName}:${block.blockId}: etichetta`);
                    assert.ok(block.text.inline.some((part: any) => part.kind === "em" && part.value === label));
                }
            }
            if (block.kind !== "heading") {
                assert.equal(block.text.inline.some((part: any) => part.kind === "text" && /\b(?:SLV|SLC|SLD|SLU)\b/u.test(part.value)), false, `${fileName}:${block.blockId}: sigla`);
            }
        }
    }
});

test("NTC 7 PDF 260-292 conserva corsivi interni e caption strutturate", async () => {
    const bridge = await json("corpus/units/ntc2018/7.9.5.1.1.json");
    for (const value of ["Presso-flessione", "Taglio"]) {
        const heading = bridge.blocks.find((block: any) => block.text?.normalized === value);
        assert.deepEqual(heading.text.inline, [{ kind: "em", value }]);
    }
    const foundations = await json("corpus/units/ntc2018/7.11.5.3.1.json");
    assert.equal(foundations.blocks.filter((block: any) => block.kind === "heading" && !block.text.normalized.startsWith("7.")).every((block: any) => block.text.inline[0].kind === "em"), true);

    const assets = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    for (const asset of [...assets.tables, ...assets.figures]) {
        assert.equal(asset.captionInline.map((part: any) => part.value).join(""), asset.caption, asset.officialNumber);
    }
    assert.deepEqual(assets.figures.find((figure: any) => figure.officialNumber === "7.11.2").captionInline.map((part: any) => part.kind), ["strong", "em", "math"]);
    assert.equal(assets.tables.find((table: any) => table.officialNumber === "7.11.III").captionInline.some((part: any) => part.kind === "math" && part.latex === "\\gamma_R"), true);
});

test("NTC 7 PDF 260-292 conserva gli elenchi innestati e i punti dopo [7.9.17]", async () => {
    const confined = await json("corpus/units/ntc2018/7.8.6.3.json");
    assert.deepEqual(confined.blocks.filter((block: any) => block.blockId.endsWith("#block-d") || block.blockId.includes("#block-d-")).map((block: any) => [block.listMarker, block.listLevel]), [["dash", undefined], ["none", 1], ["none", 1], ["none", 1], ["none", 1]]);
    const bridge = await json("corpus/units/ntc2018/7.9.5.1.1.json");
    assert.deepEqual(bridge.blocks.filter((block: any) => ["M_Ed", "M_Rd"].some((label) => block.text?.normalized.startsWith(label))).map((block: any) => [block.kind, block.listMarker]), [["list-item", "none"], ["list-item", "none"]]);
    const confinement = await json("corpus/units/ntc2018/7.9.6.1.1.json");
    assert.deepEqual(confinement.blocks.filter((block: any) => ["block-subheading-rectangular", "block-subheading-circular"].some((id) => block.blockId.endsWith(`#${id}`))).map((block: any) => [block.kind, block.listMarker]), [["list-item", "bullet"], ["list-item", "bullet"]]);
    assert.equal(confinement.blocks.find((block: any) => block.assetId?.endsWith("7.9.6.1.1-7.9.18"))?.indentLevel, 1);
});

test("NTC 7 PDF 260-269 conserva l'elenco labeled dopo [7.8.0]", async () => {
    const unit = await json("corpus/units/ntc2018/7.8.1.5.2.json");
    const blocks = unit.blocks.filter((block: any) => block.blockId.includes("#block-p9-"));
    assert.deepEqual(blocks.map((block: any) => [block.kind, block.listMarker]), [
        ["paragraph", undefined],
        ["list-item", "none"],
        ["list-item", "none"],
        ["list-item", "none"],
        ["list-item", "none"],
        ["paragraph", undefined],
    ]);
    assert.deepEqual(blocks.slice(1, 5).map((block: any) => block.text.inline[0]), [
        { kind: "math", value: "α", latex: "\\alpha" },
        { kind: "math", value: "S", latex: "S" },
        { kind: "math", value: "Z", latex: "Z" },
        { kind: "math", value: "H", latex: "H" },
    ]);
});
