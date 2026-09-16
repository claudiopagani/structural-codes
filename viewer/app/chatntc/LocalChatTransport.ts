import { isChatNTCResponse } from "../../shared/chatntc/responseContract.js";
import { ChatTransportError, type ChatRequest, type ChatResult, type ChatTransport } from "../../shared/chatntc-ui/transport.js";
import { isLoopback, type LocalAIConfiguration } from "./LocalAIConfiguration";

const messages: Record<string, string> = {
  CHATNTC_DISABLED: "ChatNTC non è abilitato su questo server locale.",
  PROVIDER_NOT_CONFIGURED: "Il servizio ChatNTC deve essere configurato sul server.",
  API_KEY_MISSING: "Inserisci una chiave API nelle Impostazioni AI oppure configura l'ambiente locale.",
  INVALID_CREDENTIALS: "Chiave API non valida o non autorizzata. Controlla le Impostazioni AI.",
  RATE_LIMIT: "Limite di richieste raggiunto. Riprova più tardi.",
  QUOTA_EXCEEDED: "Credito o quota del provider esauriti. Controlla il tuo account.",
  INVALID_MODEL: "Modello non disponibile. Controlla il model ID nelle Impostazioni AI.",
  PROVIDER_UNAVAILABLE: "Provider temporaneamente non disponibile.",
  INVALID_PROVIDER_JSON: "Il provider non ha restituito un JSON valido.",
  INVALID_RESPONSE_SCHEMA: "La risposta non rispetta il contratto ChatNTC.",
  INVALID_PROVIDER_RESPONSE: "Il provider ha restituito una risposta incompleta o non utilizzabile.",
  INVALID_PROVIDER_CONFIG: "La configurazione del servizio sul server non è valida.",
  PROVIDER_TIMEOUT: "La risposta ha richiesto troppo tempo. Puoi riprovare.",
  CITATION_VALIDATION_FAILED: "La risposta è stata bloccata perché le citazioni non sono valide. Puoi riformulare la domanda.",
  INVALID_CONTEXT: "Il paragrafo selezionato non è disponibile. Selezionalo di nuovo o invia una domanda generica.",
  INVALID_REQUEST: "Controlla la domanda e riprova.",
  LOCAL_ONLY: "ChatNTC è disponibile soltanto nell'istanza locale.",
  ORIGIN_NOT_ALLOWED: "Apri ChatNTC dall'istanza locale del viewer.",
};
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Constructing/importing this transport never sends a request. Settings are standalone-only. */
export class LocalChatTransport implements ChatTransport {
  readonly capabilities = Object.freeze({ cancellation: true, streaming: false as const });
  constructor(private readonly fetchImpl: typeof fetch = fetch, private readonly configuration?: LocalAIConfiguration) {}

  async send(request: ChatRequest, options: { signal?: AbortSignal } = {}): Promise<ChatResult> {
    try {
      const headers = this.configuration?.requestHeaders() ?? {};
      if (this.configuration && (typeof window === "undefined" || !isLoopback(window.location.hostname))) throw new ChatTransportError("LOCAL_ONLY", messages.LOCAL_ONLY);
      // Native browser fetch must not receive a LocalChatTransport instance as its receiver.
      const fetchImpl = this.fetchImpl;
      const response = await fetchImpl("/api/chatntc", {
        method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(request),
        signal: options.signal, cache: "no-store", credentials: "same-origin", redirect: "error",
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const code = object(result) && object(result.error) && typeof result.error.code === "string" ? result.error.code : "REQUEST_FAILED";
        throw new ChatTransportError(code, messages[code] ?? "ChatNTC non ha potuto completare la risposta. Riprova tra poco.");
      }
      // Structural boundary check; canonical verification remains exclusively server-side.
      if (!object(result) || result.ok !== true || !isChatNTCResponse(result.response)
        || !object(result.validation) || result.validation.valid !== true || result.validation.scope !== "integrity-provenance-claim-coverage"
        || !object(result.evidence) || result.evidence.packageId !== result.response.evidencePackageId
        || typeof result.evidence.corpusFingerprint !== "string" || typeof result.evidence.artifactFingerprint !== "string"
        || (result.evidence.structuralCodesVersion !== undefined && typeof result.evidence.structuralCodesVersion !== "string")
        || !Array.isArray(result.evidence.warnings) || !result.evidence.warnings.every((item) => object(item) && typeof item.code === "string")
        || !Array.isArray(result.citations) || !object(result.generation)
        || (result.generation.provider !== null && typeof result.generation.provider !== "string")
        || (result.generation.model !== undefined && result.generation.model !== null && typeof result.generation.model !== "string")
        || !["generated", "abstained"].includes(String(result.generation.outcome))) throw new ChatTransportError("INVALID_RESULT", "La risposta ricevuta non ha un formato validato riconoscibile.");
      const answer = result.response;
      const declared = new Map(answer.claims.flatMap((claim) => claim.citations).map((citation) => [citation.evidenceId, citation]));
      if (result.citations.length !== answer.usedEvidenceIds.length || result.citations.some((citation, index) => {
        if (!object(citation) || citation.evidenceId !== answer.usedEvidenceIds[index]) return true;
        const source = declared.get(citation.evidenceId as string);
        return !source || Object.keys(citation).length !== Object.keys(source).length
          || Object.entries(source).some(([key, value]) => citation[key] !== value);
      })) throw new ChatTransportError("INVALID_RESULT", "Le citazioni ricevute non corrispondono alla risposta validata.");
      return result as unknown as ChatResult;
    } catch (error) {
      if (options.signal?.aborted) throw new ChatTransportError("CANCELLED", "Richiesta interrotta.");
      if (error instanceof ChatTransportError) throw error;
      throw new ChatTransportError("NETWORK_ERROR", "Impossibile contattare ChatNTC. Controlla che il viewer locale sia in esecuzione.");
    }
  }
}
