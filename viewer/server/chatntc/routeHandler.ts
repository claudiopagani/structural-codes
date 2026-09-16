import "server-only";
import type { ChatNTCProvider, ChatNTCRepository, ChatNTCRetrievalContext } from "../../shared/chatntc/index.js";
import { chatNTCEnabled, type ChatNTCEnvironment } from "./config.js";
import { ChatNTCServerError, publicError } from "./errors.js";
import { readLimitedText, withDeadline } from "./io.js";
import { runChatNTC, type ChatNTCRequest } from "./pipeline.js";
import { isProviderId, validModel, type ProviderSelection } from "../../app/chatntc/providerRegistry.js";

export const CHATNTC_HTTP_LIMITS = Object.freeze({ requestBytes: 65_536, questionCharacters: 4000,
  historyMessages: 6, messageCharacters: 2000, historyCharacters: 8000 });

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const nonEmpty = (value: unknown, max: number): value is string => typeof value === "string" && Boolean(value.trim()) && value.length <= max;

function parseRequest(value: unknown): ChatNTCRequest {
  if (!object(value) || Object.keys(value).some((key) => !["question", "history", "context"].includes(key))
    || !nonEmpty(value.question, CHATNTC_HTTP_LIMITS.questionCharacters)) throw new ChatNTCServerError("INVALID_REQUEST");
  const history = value.history === undefined ? [] : value.history;
  if (!Array.isArray(history) || history.length > CHATNTC_HTTP_LIMITS.historyMessages || history.length % 2 !== 0) throw new ChatNTCServerError("INVALID_REQUEST");
  let characters = 0;
  for (const [position, message] of history.entries()) {
    if (!object(message) || Object.keys(message).some((key) => key !== "role" && key !== "content")
      || message.role !== (position % 2 === 0 ? "user" : "assistant")
      || !nonEmpty(message.content, CHATNTC_HTTP_LIMITS.messageCharacters)) throw new ChatNTCServerError("INVALID_REQUEST");
    characters += message.content.length;
  }
  if (characters > CHATNTC_HTTP_LIMITS.historyCharacters) throw new ChatNTCServerError("INVALID_REQUEST");
  let context: ChatNTCRetrievalContext | undefined;
  if (value.context !== undefined) {
    const hint = value.context;
    if (!object(hint) || Object.keys(hint).some((key) => !["documentId", "unitId", "numbering", "blockId", "assetId"].includes(key))
      || !["ntc2018", "circ2019"].includes(String(hint.documentId))
      || !nonEmpty(hint.unitId, 250) || !nonEmpty(hint.numbering, 80)
      || (hint.blockId !== undefined && !nonEmpty(hint.blockId, 300))
      || (hint.assetId !== undefined && !nonEmpty(hint.assetId, 300))) throw new ChatNTCServerError("INVALID_CONTEXT");
    context = { documentId: hint.documentId as ChatNTCRetrievalContext["documentId"], unitId: hint.unitId, numbering: hint.numbering,
      ...(hint.blockId ? { blockId: hint.blockId as string } : {}), ...(hint.assetId ? { assetId: hint.assetId as string } : {}) };
  }
  return { question: value.question, history: history.map(({ role, content }) => ({ role, content })), ...(context ? { context } : {}) };
}

function assertLocalRequest(request: Request) {
  const url = new URL(request.url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || (request.headers.has("host") && request.headers.get("host") !== url.host)) throw new ChatNTCServerError("LOCAL_ONLY");
  const origin = request.headers.get("origin");
  if ((origin !== null && origin !== url.origin)
    || request.headers.get("sec-fetch-site") === "cross-site") throw new ChatNTCServerError("ORIGIN_NOT_ALLOWED");
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

/** Credential headers stay outside the chat request, retrieval, result and history. */
export function createChatNTCHandler(dependencies: {
  environment: () => ChatNTCEnvironment;
  repository: () => ChatNTCRepository;
  provider: (environment: ChatNTCEnvironment, selection?: ProviderSelection, apiKey?: string) => ChatNTCProvider;
}) {
  return async (request: Request): Promise<Response> => {
    try {
      const env = dependencies.environment();
      if (!chatNTCEnabled(env)) throw new ChatNTCServerError("CHATNTC_DISABLED");
      assertLocalRequest(request);
      const provider = request.headers.get("x-chatntc-provider");
      const model = request.headers.get("x-chatntc-model");
      const apiKey = request.headers.get("x-chatntc-api-key") ?? undefined;
      let selection: ProviderSelection | undefined;
      if (provider !== null || model !== null || apiKey !== undefined) {
        if (!isProviderId(provider) || !validModel(model)) throw new ChatNTCServerError("INVALID_PROVIDER_CONFIG");
        selection = { provider, model };
        if (apiKey !== undefined && (!/^[\x21-\x7e]{1,512}$/u.test(apiKey)
          || request.headers.get("origin") !== new URL(request.url).origin)) throw new ChatNTCServerError("ORIGIN_NOT_ALLOWED");
      }
      if (request.method !== "POST") throw new ChatNTCServerError("INVALID_REQUEST");
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ChatNTCServerError("UNSUPPORTED_MEDIA_TYPE");
      const size = request.headers.get("content-length");
      if (size !== null && (!/^\d+$/u.test(size) || Number(size) > CHATNTC_HTTP_LIMITS.requestBytes)) throw new ChatNTCServerError("REQUEST_TOO_LARGE");
      const raw = await withDeadline((signal) => readLimitedText(request.body, CHATNTC_HTTP_LIMITS.requestBytes, "REQUEST_TOO_LARGE", signal), 5000, "REQUEST_TIMEOUT", request.signal);
      let value: unknown;
      try { value = JSON.parse(raw); } catch { throw new ChatNTCServerError("INVALID_REQUEST"); }
      const input = parseRequest(value);
      let repository: ChatNTCRepository;
      try { repository = dependencies.repository(); } catch { throw new ChatNTCServerError("RETRIEVAL_FAILED"); }
      return json(await runChatNTC(input, { repository, provider: () => dependencies.provider(env, selection, apiKey), signal: request.signal }));
    } catch (error) {
      const failure = publicError(error);
      return json(failure.body, failure.status);
    }
  };
}
