import { test } from "node:test";
import assert from "node:assert/strict";
import { normativeUnitSchema } from "../src/schema/unit.schema.ts";
import { normativeTableSchema } from "../src/schema/table.schema.ts";
import { circularMappingSchema } from "../src/schema/mapping.schema.ts";

const baseUnit = {
  id: "ntc2018:c3/s3.3/p3.3.7",
  slug: "ntc2018-c3-s3-3-p3-3-7",
  kind: "paragraph",
  numbering: "3.3.7",
  title: "Coefficiente di esposizione",
  documentId: "dm-ntc-2018-01-17",
  editionId: "gu-so8-2018-02-20",
  versionId: "ntc2018-originale",
  validity: { from: "2018-02-22", to: null },
  vigencyStatus: "in-force",
  relations: [],
  source: {
    sourceId: "gu-so8-2018-ntc",
    url: "https://www.gazzettaufficiale.it/eli/gu/2018/02/20/42/so/8/sg/pdf",
    authority: "Gazzetta Ufficiale della Repubblica Italiana",
    actNumber: "D.M. 17 gennaio 2018",
    actDate: "2018-01-17",
    gazette: "GU n. 42 del 20-02-2018",
    gazetteSupplement: "S.O. n. 8",
    pdfPages: [23],
    pdfSha256: "[DA_VERIFICARE]",
    acquiredAt: "[DA_VERIFICARE]",
    localFile: "raw-sources/ntc2018/gu-42-so8-2018-02-20.pdf",
  },
  formulas: ["ntc2018:c3/s3.3/eq3.3.7"],
  tables: ["ntc2018:c3/s3.3/tab3.3.ii"],
  figures: [],
  refsOut: [],
  workflow: {
    status: "needs-review",
    convertedBy: { kind: "llm", model: "deepseek-chat" },
    convertedAt: "[DA_VERIFICARE]",
    technicalReview: null,
    approvedBy: null,
  },
  hash: { sourceText: "[DA_VERIFICARE]", normalized: "[DA_VERIFICARE]" },
  reliability: "unverified",
  openIssues: [],
};

test("unita' valida supera lo schema", () => {
  const result = normativeUnitSchema.safeParse(baseUnit);
  assert.ok(result.success, JSON.stringify(result.error?.issues, null, 2));
});

test("slug incoerente con id viene rifiutato", () => {
  const result = normativeUnitSchema.safeParse({ ...baseUnit, slug: "slug-sbagliato" });
  assert.ok(!result.success);
});

test("ID malformato viene rifiutato", () => {
  const result = normativeUnitSchema.safeParse({ ...baseUnit, id: "NTC2018-4.1.2" });
  assert.ok(!result.success);
});

test("tabella con riga incompleta viene rifiutata", () => {
  const table = {
    id: "ntc2018:c3/s3.3/tab3.3.ii",
    officialNumber: "3.3.II",
    caption: "Test",
    source: { sourceId: "gu-so8-2018-ntc", pdfPages: [23] },
    headerRows: 1,
    columns: [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
    ],
    rows: [[{ columnKey: "a", text: "solo una cella" }]],
    notes: [],
    hash: { normalized: "[DA_VERIFICARE]" },
  };
  const result = normativeTableSchema.safeParse(table);
  assert.ok(!result.success);
});

test("tabella con colSpan corretto supera lo schema", () => {
  const table = {
    id: "ntc2018:c3/s3.3/tab3.3.ii",
    officialNumber: "3.3.II",
    caption: "Test",
    source: { sourceId: "gu-so8-2018-ntc", pdfPages: [23] },
    headerRows: 1,
    columns: [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
    ],
    rows: [
      [
        { columnKey: "a", text: "x" },
        { columnKey: "b", text: "y", noteRef: "1" },
      ],
      [{ columnKey: "a", text: "unita", colSpan: 2 }],
    ],
    notes: [{ ref: "1", text: "nota di prova" }],
    hash: { normalized: "[DA_VERIFICARE]" },
  };
  const result = normativeTableSchema.safeParse(table);
  assert.ok(result.success, JSON.stringify(result.error?.issues, null, 2));
});

test("tabella con nota orfana viene rifiutata", () => {
  const table = {
    id: "ntc2018:c3/s3.3/tab3.3.ii",
    officialNumber: "3.3.II",
    caption: "Test",
    source: { sourceId: "gu-so8-2018-ntc", pdfPages: [23] },
    headerRows: 1,
    columns: [{ key: "a", label: "A" }],
    rows: [[{ columnKey: "a", text: "x" }]],
    notes: [{ ref: "1", text: "nota non associata" }],
    hash: { normalized: "[DA_VERIFICARE]" },
  };
  const result = normativeTableSchema.safeParse(table);
  assert.ok(!result.success);
});

test("mapping confermato senza confirmedBy viene rifiutato", () => {
  const mapping = {
    mapping: "ntc2018-circ2019",
    chapter: "3",
    links: [
      {
        ntcUnitId: "ntc2018:c3/s3.3/p3.3.7",
        circUnitId: "circ2019:c3/s3.3/p-c3.3.7",
        linkKind: "direct",
        confirmation: "confirmed",
        confidence: "high",
        rationale: "test",
        suggestedBy: { kind: "script", model: null },
        confirmedBy: null,
      },
    ],
  };
  const result = circularMappingSchema.safeParse(mapping);
  assert.ok(!result.success);
});
