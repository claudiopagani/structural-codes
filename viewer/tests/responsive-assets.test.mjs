import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("figure e tabelle conservano una larghezza leggibile nel pannello stretto", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../shared/CorpusContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /className="figure-scroll"/);
  assert.match(component, /"--scv-figure-scale": displayScale/);
  assert.match(styles, /\.scv-root \.figure-scroll \{[^}]*overflow-x: auto/);
  assert.match(styles, /\.scv-root \.table-asset table \{ width: max\(100%, 744px\)/);
  assert.match(styles, /@media \(max-width: 767\.98px\) \{[^]*?\.scv-root \.figure-asset img \{ width: max\(100%, min\(760px, calc\(480px \* var\(--scv-figure-scale\)\)\)\)/);
});
