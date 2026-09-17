/** Public catalog. Official documentation checked 2026-09-15. */
export const PROVIDERS = {
  deepseek: { label: "DeepSeek", models: ["deepseek-flash", "deepseek-v4-pro"], output: "json-object", reasoning: "disabled" },
  openai: { label: "OpenAI", models: ["gpt-5.6-luna"], output: "json-schema", reasoning: "provider-default" },
  anthropic: { label: "Anthropic / Claude", models: ["claude-sonnet-5", "claude-haiku-4-5-20251001"], output: "json-schema", reasoning: "provider-default" },
  gemini: { label: "Google Gemini", models: ["gemini-3.8-flash", "gemini-3.1-flash-lite"], output: "json-schema", reasoning: "provider-default" },
  // OpenRouter catalog changes weekly and is not mirrored here: "openrouter/auto"
  // is the only bundled suggestion (official auto-router). Type any "vendor/model"
  // ID manually (including short-lived free models); typed IDs stay "prompt-json"
  // with the bounded retry and the shared citation validation.
  openrouter: { label: "OpenRouter", models: ["openrouter/auto"], output: "prompt-json", reasoning: "provider-default" },
} as const;
export type ProviderId = keyof typeof PROVIDERS;
export interface ProviderSelection { provider: ProviderId; model: string }
export function isProviderId(value: unknown): value is ProviderId { return typeof value === "string" && Object.hasOwn(PROVIDERS, value); }
/** Slash is allowed only inside OpenRouter-style "vendor/model" IDs; no URL, scheme or spaces. */
export function validModel(value: unknown): value is string {
  return typeof value === "string" && value.length <= 150
    && /^[a-zA-Z0-9][a-zA-Z0-9._:-]*(\/[a-zA-Z0-9][a-zA-Z0-9._:-]*)?$/u.test(value);
}
export function modelCapabilities(provider: ProviderId, model: string) {
  const known = (PROVIDERS[provider].models as readonly string[]).includes(model);
  return { structuredOutput: known ? PROVIDERS[provider].output : "prompt-json", streaming: false,
    cancellation: true, toolCalling: false, reasoning: known ? PROVIDERS[provider].reasoning : "provider-default" } as const;
}
