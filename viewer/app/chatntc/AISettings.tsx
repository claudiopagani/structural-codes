"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { LocalAIConfiguration } from "./LocalAIConfiguration";
import { PROVIDERS, isProviderId, modelCapabilities, type ProviderId } from "./providerRegistry";

/** Standalone composition only; never exported by structural-codes-viewer. */
export function AISettings({ configuration }: { configuration: LocalAIConfiguration }) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const initial = configuration.selection;
  const [provider, setProvider] = useState<ProviderId>(initial?.provider ?? "deepseek");
  const [model, setModel] = useState(initial?.model ?? PROVIDERS.deepseek.models[0]);
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  function apply(event: FormEvent) {
    event.preventDefault();
    try {
      // Explicit projection inside the configuration persists only provider/model.
      let storage: Storage | undefined;
      try { storage = window.localStorage; } catch { /* Memory-only mode also works with storage blocked. */ }
      configuration.configure({ provider, model: model.trim() }, key.trim(), storage);
      setKey(""); setError(""); setStatus(configuration.hasKey ? "Configurazione applicata. Chiave solo in memoria." : "Configurazione applicata. Verrà usata la chiave dell'ambiente locale.");
    } catch { setError("Controlla il model ID e la chiave API."); }
  }
  return <details ref={details} className="scv-ai-settings" onKeyDown={(event) => {
    if (event.key === "Escape" && details.current) { details.current.open = false; details.current.querySelector("summary")?.focus(); }
  }}>
    <summary>Impostazioni AI</summary>
    <form className="scv-ai-form" onSubmit={apply} aria-label="Impostazioni AI">
      <small>{configuration.selection ? `Attivo: ${PROVIDERS[configuration.selection.provider].label} · ${configuration.selection.model}` : "Attiva la configurazione dell'ambiente locale fino ad Applica impostazioni."}</small>
      <label htmlFor={`${id}-provider`}>Provider</label>
      <select id={`${id}-provider`} value={provider} onChange={(event) => {
        const next = event.target.value;
        if (!isProviderId(next)) return;
        configuration.clearKey(); setKey(""); setProvider(next); setModel(PROVIDERS[next].models[0]); setStatus("Chiave rimossa: configura il provider selezionato.");
      }}>{Object.entries(PROVIDERS).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}</select>
      <label htmlFor={`${id}-model`}>Modello / model ID</label>
      <input id={`${id}-model`} list={`${id}-models`} value={model} maxLength={150} required autoComplete="off" onChange={(event) => setModel(event.target.value)} />
      <datalist id={`${id}-models`}>{PROVIDERS[provider].models.map((value) => <option key={value} value={value} />)}</datalist>
      <small>{modelCapabilities(provider, model).structuredOutput === "prompt-json" ? "Model ID manuale: formato JSON verificato, massimo un retry." : "Modello consigliato con output strutturato."}</small>
      <label htmlFor={`${id}-key`}>API key</label>
      <input id={`${id}-key`} type="password" value={key} maxLength={512} autoComplete="off" spellCheck={false} onChange={(event) => setKey(event.target.value)} aria-describedby={`${id}-privacy`} />
      <small id={`${id}-privacy`}>Solo in memoria fino al reload. Lascia vuoto e applica per usare la chiave configurata nell&apos;ambiente locale.</small>
      <p>Domanda, storico recente ed evidence vengono inviati al provider scelto. Le chiamate possono comportare costi sul tuo account. Nessuna ricerca web.</p>
      <div className="scv-ai-actions"><button type="submit">Applica impostazioni</button><button type="button" onClick={() => { configuration.clearKey(); setKey(""); setStatus("Chiave rimossa dalla memoria."); }}>Rimuovi chiave</button></div>
      {status && <small role="status">{status}</small>}{error && <small role="alert">{error}</small>}
    </form>
  </details>;
}
