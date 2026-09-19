/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

test("NTC 8.4 rende in grassetto corsivo i titoli delle categorie di intervento", async () => {
    const unit = JSON.parse(await readFile(join(root, "corpus", "units", "ntc2018", "8.4.json"), "utf8"));
    for (const title of [
        "interventi di riparazione o locali:",
        "interventi di miglioramento:",
        "interventi di adeguamento:",
    ]) {
        const block = unit.blocks.find((candidate: any) => candidate.text?.normalized.includes(title));
        assert.ok(block, title);
        assert.ok(block.text.inline.some((segment: any) => segment.kind === "strong-em" && segment.value === title), title);
    }
});
