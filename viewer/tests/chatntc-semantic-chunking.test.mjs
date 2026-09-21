import assert from "node:assert/strict";
import test from "node:test";
import {
  CHATNTC_SEMANTIC_CHUNKING_DEFAULTS, CHATNTC_SEMANTIC_TOKENIZER_MODEL, CHATNTC_SEMANTIC_TOKENIZER_REVISION,
  chunkSemanticUnit, semanticInputFingerprint, semanticTextForChunk, semanticTextForUnit,
} from "../.local/chatntc-semantic-tool/server/chatntc/semanticIndex.js";

const tokenizer = {
  encode(text, options = {}) {
    const ids = Array.from(text, (character) => character.codePointAt(0));
    return { ids: options.add_special_tokens === false ? ids : [0, ...ids, 2] };
  },
  decode(ids) { return String.fromCodePoint(...ids); },
};

function unit(number, texts) {
  const id = `urn:fixture:ntc2018:${number}`;
  return { id, document: "ntc2018", kind: "paragraph", numbering: { official: number, sortKey: number }, title: `Titolo ${number}`,
    titleBlockId: `${id}#heading`, hierarchy: { parentId: null, ancestorIds: [], position: 1 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-01-01" }, relations: [], review: { status: "draft" },
    blocks: [{ blockId: `${id}#heading`, kind: "heading", origin: "official",
      text: { raw: `Titolo ${number}`, normalized: `Titolo ${number}`, normalizationVersion: "fixture" } },
    ...texts.map((text, index) => ({ blockId: `${id}#p${index}`, kind: "paragraph", origin: "official",
      text: { raw: text, normalized: text, normalizationVersion: "fixture" } }))],
  };
}

const policy = CHATNTC_SEMANTIC_CHUNKING_DEFAULTS;
const fingerprint = (chunks, selectedPolicy = policy) => semanticInputFingerprint(chunks, {
  policy: selectedPolicy, tokenizerModel: CHATNTC_SEMANTIC_TOKENIZER_MODEL, tokenizerRevision: CHATNTC_SEMANTIC_TOKENIZER_REVISION,
});

test("unità sotto e al limite producono un solo chunk", () => {
  const short = unit("short", ["a".repeat(100)]);
  const exactBodyLength = 1000 - 2 - semanticTextForUnit(unit("exact", [""])).length;
  const exact = unit("exact", ["a".repeat(exactBodyLength)]);
  assert.equal(tokenizer.encode(semanticTextForUnit(exact)).ids.length, 1000);
  assert.equal(chunkSemanticUnit(short, tokenizer, policy).length, 1);
  assert.equal(chunkSemanticUnit(exact, tokenizer, policy).length, 1);
});

test("unità oltre il limite produce chunk entro il target e overlap di blocchi completi", () => {
  const sourceBlocks = ["A".repeat(140), "B".repeat(140), "C".repeat(140), "D".repeat(140), "E".repeat(140), "F".repeat(140), "G".repeat(140), "H".repeat(140)];
  const chunks = chunkSemanticUnit(unit("many", sourceBlocks), tokenizer, policy);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.tokenCount <= policy.maxChunkTokens));
  assert.ok(chunks.slice(1).some((chunk, index) => sourceBlocks.some((block) => chunks[index].text.includes(block) && chunk.text.includes(block))));
  assert.ok(chunks.every((chunk, index) => chunk.chunkId === `urn:fixture:ntc2018:many#chunk-${index + 1}`));
  assert.ok(chunks.every((chunk) => chunk.chunkCount === chunks.length));
});

test("un singolo blocco oltre il limite viene diviso usando i token del tokenizer", () => {
  const chunks = chunkSemanticUnit(unit("huge", ["Z".repeat(3500)]), tokenizer, policy);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.tokenCount <= policy.maxChunkTokens));
  assert.ok(chunks.slice(1).some((chunk) => chunk.text.includes("Z".repeat(100))));
});

test("chunk, chunkId e fingerprint sono deterministici e dipendono dalla policy", () => {
  const source = unit("stable", ["testo ".repeat(500)]);
  const first = chunkSemanticUnit(source, tokenizer, policy);
  const second = chunkSemanticUnit(structuredClone(source), tokenizer, policy);
  assert.deepEqual(second, first);
  assert.equal(fingerprint(first), fingerprint(second));
  assert.notEqual(fingerprint(first, { maxChunkTokens: 900, overlapTokens: 150 }), fingerprint(first));
  assert.notEqual(fingerprint(first, { maxChunkTokens: 1000, overlapTokens: 100 }), fingerprint(first));
  assert.notEqual(fingerprint(first.map((chunk, index) => index ? chunk : { ...chunk, title: "Titolo cambiato" })), fingerprint(first));
  assert.match(semanticTextForChunk(first[0]), /chunk: 1\//u);
});
