import "server-only";
import { ChatNTCServerError, type ChatNTCErrorCode } from "./errors.js";

/** Bounds the entire operation, including response body reading; also handles mock transports. */
export async function withDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number,
  timeoutCode: "PROVIDER_TIMEOUT" | "REQUEST_TIMEOUT", parentSignal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    const fail = (code: ChatNTCErrorCode) => {
      reject(new ChatNTCServerError(code));
      controller.abort();
    };
    onAbort = () => fail("REQUEST_ABORTED");
    if (parentSignal?.aborted) onAbort();
    else parentSignal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => fail(timeoutCode), timeoutMs);
  });
  try {
    return await Promise.race([deadline, Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
      return operation(controller.signal);
    })]);
  } finally {
    clearTimeout(timer);
    if (onAbort) parentSignal?.removeEventListener("abort", onAbort);
  }
}

export async function readLimitedText(body: ReadableStream<Uint8Array> | null, limit: number,
  limitCode: ChatNTCErrorCode, signal: AbortSignal): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
      const { done, value } = await reader.read();
      if (done) return result + decoder.decode();
      bytes += value.byteLength;
      if (bytes > limit) { cancel(); throw new ChatNTCServerError(limitCode); }
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
