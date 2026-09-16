import { isProviderId, validModel, type ProviderSelection } from "./providerRegistry";

const PREFERENCES_KEY = "chatntc.ai.preferences.v1";
export function isLoopback(hostname: string): boolean { return ["localhost", "127.0.0.1", "[::1]"].includes(hostname); }

/** Private in-memory credential vault. JSON serialization reveals no credentials. */
export class LocalAIConfiguration {
  #selection: ProviderSelection | undefined;
  #key = "";
  get selection(): ProviderSelection | undefined { return this.#selection ? { ...this.#selection } : undefined; }
  get hasKey(): boolean { return Boolean(this.#key); }
  restore(storage: Pick<Storage, "getItem">) {
    try {
      const value = JSON.parse(storage.getItem(PREFERENCES_KEY) ?? "null");
      if (value && isProviderId(value.provider) && validModel(value.model)) this.#selection = { provider: value.provider, model: value.model };
    } catch { /* Storage unavailable: session-only preferences still work. */ }
  }
  configure(selection: ProviderSelection, apiKey: string, storage?: Pick<Storage, "setItem">) {
    if (!isProviderId(selection.provider) || !validModel(selection.model) || (apiKey && !/^[\x21-\x7e]{1,512}$/u.test(apiKey))) throw new Error("Configurazione AI non valida.");
    this.#selection = { provider: selection.provider, model: selection.model }; this.#key = apiKey;
    try { storage?.setItem(PREFERENCES_KEY, JSON.stringify(this.#selection)); } catch { /* Preferences are optional. */ }
  }
  clearKey() { this.#key = ""; }
  /** Called only when the user sends a question; never passed to a history store. */
  requestHeaders(): Record<string, string> {
    return this.#selection ? { "x-chatntc-provider": this.#selection.provider, "x-chatntc-model": this.#selection.model,
      ...(this.#key ? { "x-chatntc-api-key": this.#key } : {}) } : {};
  }
}
