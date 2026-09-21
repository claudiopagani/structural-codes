import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Tokenizer } from "@huggingface/tokenizers";
import { loadBgeM3Tokenizer, tokenCount } from "../.local/chatntc-semantic-tool/scripts/bge-m3-tokenizer.js";
import {
  createSemanticLengthAuditReport, metricForUnit, numericStats, percentile, sortLongestUnits,
  thresholdCounts, writeSemanticLengthAuditReport,
} from "../.local/chatntc-semantic-tool/scripts/semantic-length-audit.js";
import { semanticTextForUnit } from "../.local/chatntc-semantic-tool/server/chatntc/semanticIndex.js";

const unit = (document, numbering, text, title = `Titolo ${numbering}`) => {
  const id = `urn:fixture:${document}:${numbering}`;
  return { id, document, kind: "paragraph", numbering: { official: numbering, sortKey: numbering }, title,
    titleBlockId: `${id}#heading`, hierarchy: { parentId: null, ancestorIds: [], position: 1 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-01-01" },
    blocks: [
      { blockId: `${id}#heading`, kind: "heading", origin: "official", text: { raw: "raw diverso", normalized: title, normalizationVersion: "fixture" } },
      { blockId: `${id}#p1`, kind: "paragraph", origin: "official", text: { raw: text, normalized: text, normalizationVersion: "fixture" } },
      { blockId: `${id}#empty`, kind: "paragraph", origin: "official", text: { raw: " ", normalized: " ", normalizationVersion: "fixture" } },
    ], relations: [], review: { status: "draft" },
  };
};
const units = [unit("ntc2018", "1.1", "breve testo."), unit("circ2019", "C1.1", "testo molto più lungo con parole aggiuntive."), unit("ntc2018", "1.2", "testo medio")];
const fakeTokenizer = { calls: [], encode(text, options) { this.calls.push({ text, options }); return { ids: Array.from(text, (_, index) => index) }; } };

test("usa semanticTextForUnit esatto, esclude title block e conta il blocco più lungo", () => {
  const metric = metricForUnit(units[0], fakeTokenizer);
  assert.equal(metric.tokenCount, semanticTextForUnit(units[0]).length);
  assert.equal(metric.textBlockCount, 1);
  assert.equal(metric.longestTextBlockTokenCount, "breve testo.".length);
  assert.equal(fakeTokenizer.calls[0].text, semanticTextForUnit(units[0]));
  assert.equal(fakeTokenizer.calls[0].options.add_special_tokens, true);
  assert.doesNotMatch(fakeTokenizer.calls[0].text, /raw diverso/u);
});

test("carica un tokenizer fixture e include special token solo quando richiesto", () => {
  const json = { version: "1.0", truncation: null, padding: null, added_tokens: [{ id: 0, content: "<s>", single_word: false, lstrip: false, rstrip: false, normalized: false, special: true }], normalizer: null, pre_tokenizer: { type: "Whitespace" }, post_processor: { type: "TemplateProcessing", single: [{ SpecialToken: { id: "<s>", type_id: 0 } }, { Sequence: { id: "A", type_id: 0 } }], pair: [{ SpecialToken: { id: "<s>", type_id: 0 } }, { Sequence: { id: "A", type_id: 0 } }, { Sequence: { id: "B", type_id: 1 } }], special_tokens: { "<s>": { id: "<s>", ids: [0], tokens: ["<s>"] } } }, decoder: null, model: { type: "WordPiece", unk_token: "[UNK]", continuing_subword_prefix: "##", max_input_chars_per_word: 100, vocab: { "<s>": 0, "[UNK]": 1, hello: 2 } } };
  const tokenizer = new Tokenizer(json, { model_max_length: 8192 });
  assert.equal(tokenCount(tokenizer, "hello", true), 2);
  assert.equal(tokenCount(tokenizer, "hello", false), 1);
});

test("percentili, soglie e ordinamento sono deterministici", () => {
  assert.equal(percentile([1, 2, 3, 4], 0.75), 3.25);
  assert.deepEqual(numericStats([1, 2, 3, 4]), { min: 1, max: 4, mean: 2.5, median: 2.5, p75: 3.25, p90: 3.7, p95: 3.85, p99: 3.97 });
  assert.deepEqual(thresholdCounts([500, 1000, 2000], [512, 1000]), [{ threshold: 512, count: 2, percentage: 66.67 }, { threshold: 1000, count: 1, percentage: 33.33 }]);
  const sorted = sortLongestUnits([{ unitId: "b", document: "ntc2018", numbering: "2", title: "b", characterCount: 5, wordCount: 1, tokenCount: 10, textBlockCount: 1, longestTextBlockTokenCount: 1 }, { unitId: "a", document: "circ2019", numbering: "1", title: "a", characterCount: 5, wordCount: 1, tokenCount: 10, textBlockCount: 1, longestTextBlockTokenCount: 1 }, { unitId: "c", document: "ntc2018", numbering: "3", title: "c", characterCount: 7, wordCount: 1, tokenCount: 9, textBlockCount: 1, longestTextBlockTokenCount: 1 }]);
  assert.deepEqual(sorted.map((entry) => entry.unitId), ["a", "b", "c"]);
});

test("report JSON distingue NTC/Circolare e non contiene embedding o chunk", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "chatntc-semantic-audit-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const report = createSemanticLengthAuditReport({ units, corpusFingerprint: "a".repeat(64), tokenizerMetadata: {
    model: "BAAI/bge-m3", revision: "fixture", method: "fixture", tokenizerFile: "fixture", tokenizerConfigFile: "fixture",
    tokenizerSha256: "a", tokenizerConfigSha256: "b", specialTokensIncluded: true, specialTokensConvention: "fixture",
  }, tokenizer: fakeTokenizer, generatedAt: "2026-01-01T00:00:00.000Z" });
  const output = join(directory, "unit-lengths.json");
  await writeSemanticLengthAuditReport(output, report);
  const parsed = JSON.parse(await readFile(output, "utf8"));
  assert.equal(parsed.documents.ntc2018.unitCount, 2);
  assert.equal(parsed.documents.circ2019.unitCount, 1);
  assert.equal(parsed.units.length, 3);
  assert.equal("vectors" in parsed, false);
  assert.equal("embedding" in parsed, false);
  assert.equal("chunks" in parsed, false);
});

test("loader ufficiale legge soltanto asset già presenti e verificati", async (t) => {
  const directory = fileURLToPath(new URL("../.local/bge-m3-tokenizer/", import.meta.url));
  try {
    const loaded = await loadBgeM3Tokenizer(directory);
    assert.equal(loaded.metadata.model, "BAAI/bge-m3");
    assert.equal(loaded.metadata.specialTokensIncluded, true);
    assert.ok(tokenCount(loaded.tokenizer, "ciao mondo", true) > tokenCount(loaded.tokenizer, "ciao mondo", false));
  } catch (error) {
    if (error?.code === "ENOENT") { t.skip("asset ufficiali non predisposti; il test non scarica rete"); return; }
    throw error;
  }
});
