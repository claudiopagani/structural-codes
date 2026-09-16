import "server-only";
import type { ChatNTCValidationIssue } from "../../shared/chatntc/index.js";

export const CHATNTC_ERRORS = {
  CHATNTC_DISABLED: [404, "ChatNTC disponibile solo in modalità locale/debug esplicitamente abilitata."],
  LOCAL_ONLY: [403, "ChatNTC è disponibile solo tramite un indirizzo locale."],
  ORIGIN_NOT_ALLOWED: [403, "Origine della richiesta non consentita."],
  INVALID_REQUEST: [400, "Domanda o storico non conformi al contratto HTTP ChatNTC."],
  INVALID_CONTEXT: [400, "Il paragrafo selezionato non corrisponde al corpus. Selezionalo di nuovo o invia una domanda generica."],
  REQUEST_TOO_LARGE: [413, "Richiesta ChatNTC troppo grande."],
  UNSUPPORTED_MEDIA_TYPE: [415, "È richiesto Content-Type application/json."],
  REQUEST_TIMEOUT: [408, "Tempo di lettura della richiesta scaduto."],
  REQUEST_ABORTED: [408, "Richiesta interrotta."],
  PROVIDER_NOT_CONFIGURED: [503, "Provider ChatNTC non configurato o non supportato."],
  API_KEY_MISSING: [503, "Inserisci una chiave API nelle Impostazioni AI oppure configura l'ambiente locale."],
  INVALID_PROVIDER_CONFIG: [400, "Configurazione del provider non valida."],
  INVALID_CREDENTIALS: [401, "Chiave API non valida o priva delle autorizzazioni necessarie."],
  RATE_LIMIT: [429, "Limite di richieste del provider raggiunto. Riprova più tardi."],
  QUOTA_EXCEEDED: [402, "Credito o quota del provider esauriti."],
  INVALID_MODEL: [400, "Modello non disponibile per questo account o provider."],
  PROVIDER_UNAVAILABLE: [503, "Provider temporaneamente non disponibile."],
  PROVIDER_TIMEOUT: [504, "Il provider non ha risposto entro il limite configurato."],
  PROVIDER_ERROR: [502, "La chiamata al provider non è riuscita."],
  INVALID_PROVIDER_RESPONSE: [502, "Il provider ha restituito una risposta vuota, incompleta o non supportata."],
  INVALID_PROVIDER_JSON: [502, "Il provider ha restituito JSON non parseabile."],
  INVALID_RESPONSE_SCHEMA: [502, "La risposta non rispetta il contratto strutturato ChatNTC."],
  CITATION_VALIDATION_FAILED: [502, "La risposta è stata respinta dalla validazione delle citazioni."],
  RETRIEVAL_FAILED: [500, "Impossibile costruire l'evidence dal corpus locale."],
  VALIDATION_FAILED: [500, "Impossibile completare la validazione contro il corpus locale."],
  INTERNAL_ERROR: [500, "Impossibile completare la richiesta ChatNTC."],
} as const;

export type ChatNTCErrorCode = keyof typeof CHATNTC_ERRORS;

export function errorCategory(code: ChatNTCErrorCode): string {
  const categories: Partial<Record<ChatNTCErrorCode, string>> = {
    INVALID_CREDENTIALS: "invalid_credentials", API_KEY_MISSING: "invalid_credentials", RATE_LIMIT: "rate_limit",
    QUOTA_EXCEEDED: "quota_exceeded", PROVIDER_TIMEOUT: "timeout", REQUEST_TIMEOUT: "timeout",
    PROVIDER_UNAVAILABLE: "provider_unavailable", INVALID_MODEL: "invalid_model", INVALID_PROVIDER_RESPONSE: "malformed_response",
    INVALID_PROVIDER_JSON: "malformed_response", INVALID_RESPONSE_SCHEMA: "malformed_response", CITATION_VALIDATION_FAILED: "citation_validation_failed",
  };
  return categories[code] ?? "unknown";
}

/** No upstream message, body, URL, headers, credentials or cause are retained. */
export class ChatNTCServerError extends Error {
  readonly code: ChatNTCErrorCode;
  readonly validationIssues?: ChatNTCValidationIssue[];
  constructor(code: ChatNTCErrorCode, validationIssues?: ChatNTCValidationIssue[]) {
    super(CHATNTC_ERRORS[code][1]);
    this.name = "ChatNTCServerError";
    this.code = code;
    this.validationIssues = validationIssues;
  }
}

const safe = (value: string, maximum: number) => value.replace(/[\u0000-\u001f\u007f]/gu, " ").slice(0, maximum);
export function publicError(error: unknown, debug = false) {
  const code = error instanceof ChatNTCServerError && Object.hasOwn(CHATNTC_ERRORS, error.code) ? error.code : "INTERNAL_ERROR";
  // Reconstruct from the allowlist even if a thrown error's message was mutated.
  const diagnostics = debug && error instanceof ChatNTCServerError && code === "CITATION_VALIDATION_FAILED" && error.validationIssues
    ? error.validationIssues.map((issue) => ({ code: safe(issue.code, 80), ...(issue.category ? { category: issue.category } : {}), path: safe(issue.path, 200), message: safe(issue.message, 300),
      ...(issue.reference ? { reference: safe(issue.reference, 120) } : {}) })) : undefined;
  return { status: CHATNTC_ERRORS[code][0], body: { ok: false as const, error: { code, category: errorCategory(code), message: CHATNTC_ERRORS[code][1],
    ...(debug && code === "CITATION_VALIDATION_FAILED" ? { accounting: "hard-rejected" as const } : {}),
    ...(diagnostics?.length ? { diagnostics } : {}) } } };
}
