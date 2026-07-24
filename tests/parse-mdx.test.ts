import { test } from "node:test";
import assert from "node:assert/strict";
import {
    splitFrontmatter,
    parseSimpleYaml,
    extractOfficialText,
    extractComponents,
    findFreeText,
} from "../src/lib/parse-mdx.ts";

const SAMPLE = `---
id: ntc2018:c3/s3.3/p3.3.7
slug: ntc2018-c3-s3-3-p3-3-7
numbering: "3.3.7"
validity: { from: "2018-02-22", to: null }
tables: ["ntc2018:c3/s3.3/tab3.3.ii"]
refsOut:
  - { targetId: "ntc2018:c3/s3.3/p3.3.4", scope: "explicit", rawText: "vedi 3.3.4" }
workflow:
  status: needs-review
  approvedBy: null
---

<OfficialText hash="x">
Testo ufficiale verbatim.
</OfficialText>

<Formula id="ntc2018:c3/s3.3/eq3.3.7" number="3.3.7" latex="c_e(z)" />
`;

test("splitFrontmatter separa frontmatter e body", () => {
    const parsed = splitFrontmatter(SAMPLE);
    assert.equal(parsed.frontmatter.id, "ntc2018:c3/s3.3/p3.3.7");
    assert.ok(parsed.body.includes("<OfficialText"));
});

test("parseSimpleYaml gestisce scalari, inline e blocchi", () => {
    const fm = parseSimpleYaml(`
numbering: "3.3.7"
count: 23
valid: true
empty: null
validity: { from: "2018-02-22", to: null }
list: [a, b, c]
`);
    assert.equal(fm.numbering, "3.3.7");
    assert.equal(fm.count, 23);
    assert.equal(fm.valid, true);
    assert.equal(fm.empty, null);
    assert.deepEqual(fm.validity, { from: "2018-02-22", to: null });
    assert.deepEqual(fm.list, ["a", "b", "c"]);
});

test("parseSimpleYaml gestisce liste inline di oggetti", () => {
    const fm = parseSimpleYaml(`
refsOut:
  - { targetId: "ntc2018:c3/s3.3/p3.3.4", scope: "explicit", rawText: "vedi" }
`);
    const refs = fm.refsOut as Array<Record<string, unknown>>;
    assert.equal(refs[0]!.targetId, "ntc2018:c3/s3.3/p3.3.4");
    assert.equal(refs[0]!.scope, "explicit");
});

test("parseSimpleYaml gestisce oggetti annidati multilinea", () => {
    const fm = parseSimpleYaml(`
workflow:
  status: needs-review
  approvedBy: null
`);
    const wf = fm.workflow as Record<string, unknown>;
    assert.equal(wf.status, "needs-review");
    assert.equal(wf.approvedBy, null);
});

test("extractOfficialText prende solo il contenuto verbatim", () => {
    const text = extractOfficialText(splitFrontmatter(SAMPLE).body);
    assert.equal(text, "Testo ufficiale verbatim.");
});

test("extractComponents legge gli attributi", () => {
    const components = extractComponents(splitFrontmatter(SAMPLE).body);
    const formula = components.find((c) => c.name === "Formula");
    assert.equal(formula?.attributes.id, "ntc2018:c3/s3.3/eq3.3.7");
    assert.equal(formula?.attributes.latex, "c_e(z)");
});

test("findFreeText segnala testo fuori dai componenti", () => {
    const dirty = `<OfficialText hash="x">ok</OfficialText>

Questo testo non dovrebbe stare qui.
`;
    const free = findFreeText(dirty);
    assert.ok(free.length > 0);
    assert.ok(free[0]!.includes("Questo testo"));
});
