import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Tokenizer } from "@huggingface/tokenizers";

export const BGE_M3_TOKENIZER_MODEL = "BAAI/bge-m3" as const;
export const BGE_M3_TOKENIZER_REVISION = "5617a9f61b028005a4858fdac845db406aefb181" as const;
export const BGE_M3_TOKENIZER_METHOD = "Hugging Face tokenizer.json via @huggingface/tokenizers 0.2.0" as const;
export const BGE_M3_TOKENIZER_FILES = [
  { name: "tokenizer.json", sha256: "21106b6d7dab2952c1d496fb21d5dc9db75c28ed361a05f5020bbba27810dd08", bytes: 17098108 },
  { name: "tokenizer_config.json", sha256: "a62b2b6784f990259fddef5f16388693a8043be4f69179e6a5257eeb3f9abac4", bytes: 444 },
] as const;

export interface BgeM3Tokenizer {
  encode(text: string, options?: { add_special_tokens?: boolean }): { ids: number[] };
  decode(ids: number[], options?: { skip_special_tokens?: boolean }): string;
}

export interface BgeM3TokenizerMetadata {
  model: typeof BGE_M3_TOKENIZER_MODEL;
  revision: typeof BGE_M3_TOKENIZER_REVISION;
  method: typeof BGE_M3_TOKENIZER_METHOD;
  tokenizerFile: string;
  tokenizerConfigFile: string;
  tokenizerSha256: string;
  tokenizerConfigSha256: string;
  specialTokensIncluded: true;
  specialTokensConvention: "add_special_tokens=true (XLM-RoBERTa post-processor)";
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export async function loadBgeM3Tokenizer(directory: string): Promise<{
  tokenizer: BgeM3Tokenizer;
  metadata: BgeM3TokenizerMetadata;
}> {
  const tokenizerFile = `${directory}/tokenizer.json`;
  const tokenizerConfigFile = `${directory}/tokenizer_config.json`;
  const [tokenizerBytes, tokenizerConfigBytes] = await Promise.all([
    readFile(tokenizerFile), readFile(tokenizerConfigFile),
  ]);
  const tokenizerSha256 = sha256(tokenizerBytes);
  const tokenizerConfigSha256 = sha256(tokenizerConfigBytes);
  const expectedTokenizer = BGE_M3_TOKENIZER_FILES[0];
  const expectedConfig = BGE_M3_TOKENIZER_FILES[1];
  if (tokenizerBytes.byteLength !== expectedTokenizer.bytes || tokenizerSha256 !== expectedTokenizer.sha256
    || tokenizerConfigBytes.byteLength !== expectedConfig.bytes || tokenizerConfigSha256 !== expectedConfig.sha256) {
    throw new Error("Asset tokenizer BGE-M3 non corrispondenti alla revisione ufficiale pinned.");
  }
  const tokenizerJson = JSON.parse(tokenizerBytes.toString("utf8")) as object;
  const tokenizerConfig = JSON.parse(tokenizerConfigBytes.toString("utf8")) as object;
  const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
  return { tokenizer, metadata: {
    model: BGE_M3_TOKENIZER_MODEL, revision: BGE_M3_TOKENIZER_REVISION, method: BGE_M3_TOKENIZER_METHOD,
    tokenizerFile, tokenizerConfigFile, tokenizerSha256, tokenizerConfigSha256,
    specialTokensIncluded: true, specialTokensConvention: "add_special_tokens=true (XLM-RoBERTa post-processor)",
  } };
}

export function tokenCount(tokenizer: BgeM3Tokenizer, text: string, addSpecialTokens = true): number {
  return tokenizer.encode(text, { add_special_tokens: addSpecialTokens }).ids.length;
}
