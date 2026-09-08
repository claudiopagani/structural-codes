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
