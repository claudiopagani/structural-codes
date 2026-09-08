import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
test("NTC 4.3 pp. 119-127 conserva marker, enfasi e didascalie", async () => {
    const plastic = await read("corpus/units/ntc2018/4.3.2.2.2.json");
    assert.ok(plastic.blocks.filter((block: { kind: string }) => block.kind === "list-item").every((block: { listMarker?: string }) => block.listMarker === "dash"));
    const columns = await read("corpus/units/ntc2018/4.3.5.1.json");
    assert.ok(columns.blocks.filter((block: { kind: string }) => block.kind === "list-item").every((block: { listMarker?: string }) => block.listMarker === "none"));
    const limits = await read("corpus/units/ntc2018/4.3.1.1.json");
    assert.ok(limits.blocks.some((block: { text?: { inline?: Array<{ kind: string }> } }) => block.text?.inline?.some((part) => part.kind === "em")));
    const manifest = await read("corpus/assets/ntc2018/4.3-step2.json");
    assert.ok(manifest.figures.filter((figure: { pdfPage: number }) => figure.pdfPage <= 127).every((figure: { caption: string; captionInline?: Array<{ kind: string; value: string }> }) => figure.captionInline?.[0]?.kind === "strong" && figure.captionInline.map((part) => part.value).join("") === figure.caption));
});
