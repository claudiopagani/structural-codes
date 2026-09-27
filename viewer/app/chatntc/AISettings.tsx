"use client";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApplySettingsIcon, CloseIcon } from "../../shared/chatntc-ui/ChatNTCIcons";
import { LocalAIConfiguration } from "./LocalAIConfiguration";
import { PROVIDERS, isProviderId, modelCapabilities, type ProviderId } from "./providerRegistry";

function AIField({ children, htmlFor, label }: { children: ReactNode; htmlFor: string; label: string }) {
  return <div className="scv-ai-field"><label htmlFor={htmlFor}>{label}</label>{children}</div>;
}

/** Standalone composition only; never exported by structural-codes-viewer. */
export function AISettings({ configuration, embedded = false }: { configuration: LocalAIConfiguration; embedded?: boolean }) {
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
  const form = <form className="scv-ai-form" onSubmit={apply} aria-label="Impostazioni AI">
      <div className="scv-ai-selection-badge" data-configured={configuration.selection ? "true" : "false"}>
        {configuration.selection ? `Attivo: ${PROVIDERS[configuration.selection.provider].label} · ${configuration.selection.model}` : "Attiva la configurazione dell'ambiente locale fino ad Applica impostazioni."}
      </div>
      <AIField htmlFor={`${id}-provider`} label="Provider">
        <select id={`${id}-provider`} value={provider} onChange={(event) => {
          const next = event.target.value;
          if (!isProviderId(next)) return;
          configuration.clearKey(); setKey(""); setProvider(next); setModel(PROVIDERS[next].models[0]); setStatus("Chiave rimossa: configura il provider selezionato.");
        }}>{Object.entries(PROVIDERS).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}</select>
      </AIField>
      <AIField htmlFor={`${id}-model`} label="Modello">
        <input id={`${id}-model`} list={`${id}-models`} value={model} maxLength={150} required autoComplete="off" spellCheck={false} placeholder={provider === "openrouter" ? "vendor/model oppure vendor/model:free" : "Digita un model ID"} onChange={(event) => setModel(event.target.value)} />
      </AIField>
      <datalist id={`${id}-models`}>{PROVIDERS[provider].models.map((value) => <option key={value} value={value} />)}</datalist>
      {modelCapabilities(provider, model).structuredOutput === "prompt-json" && <small>Formato JSON da istruzioni, verificato dopo la risposta; massimo un retry.</small>}
      {provider === "openrouter" && <small>
        Puoi sostituire il suggerimento con qualsiasi model ID, anche temporaneo: copia l&apos;ID esatto dal <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">catalogo OpenRouter</a>.
        {" "}Non serve aggiornare ChatNTC. Disponibilità e prezzi possono cambiare; openrouter/auto seleziona automaticamente il modello e non garantisce gratuità.
      </small>}
      <AIField htmlFor={`${id}-key`} label="API key">
        <input id={`${id}-key`} type="password" value={key} maxLength={512} autoComplete="off" spellCheck={false} onChange={(event) => setKey(event.target.value)} />
      </AIField>
      <div className="scv-ai-actions"><button type="submit"><ApplySettingsIcon />Applica impostazioni</button><button type="button" onClick={() => { configuration.clearKey(); setKey(""); setStatus("Chiave rimossa dalla memoria."); }}><CloseIcon className="scv-ai-action-icon" />Rimuovi API key</button></div>
      {status && <small role="status">{status}</small>}{error && <small role="alert">{error}</small>}
    </form>;
  if (embedded) return <div className="scv-ai-settings scv-ai-settings-embedded">{form}</div>;
  return <details ref={details} className="scv-ai-settings" onKeyDown={(event) => {
    if (event.key === "Escape" && details.current) { details.current.open = false; details.current.querySelector("summary")?.focus(); }
  }}>
    <summary>Impostazioni AI</summary>
    {form}
  </details>;
}
