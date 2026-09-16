# ChatNTC locale: BYOK multi-provider (STEP 5)

## Avvio

Dalla radice della repository, dopo l'installazione delle dipendenze:

```sh
npm run dev
```

Questo comando avvia lo standalone con ChatNTC abilitato, vincolato a
`127.0.0.1`. Aprire l'indirizzo locale stampato nel terminale, normalmente
`http://127.0.0.1:3000` (anche `localhost` è ammesso).

1. Aprire **ChatNTC e strumenti**, poi **Impostazioni AI**.
2. Scegliere DeepSeek, OpenAI, Anthropic / Claude o Google Gemini.
3. Inserire la propria API key.
4. Scegliere un modello consigliato oppure digitare un model ID.
5. Premere **Applica impostazioni** e inviare una domanda sulle NTC.

Le chiamate AI inviano domanda, ultimi turni ed evidence normativa al provider
scelto dall'utente e **possono comportare costi sul relativo account**. Non c'è
web search. La configurazione e l'apertura della chat non chiamano il provider.
Il selettore modifica una bozza: il nuovo provider diventa attivo con **Applica**.
Cambiare provider rimuove subito la precedente chiave in memoria. Un turno già
in corso conserva provider e modello catturati all'invio; **Stop** annulla la richiesta.
Il provider potrebbe comunque conteggiare l'elaborazione già iniziata.

`npm run viewer:dev` conserva il comportamento precedente: ChatNTC richiede
`CHATNTC_ENABLED=true`. In produzione occorre anche `CHATNTC_DEBUG=true`;
la route e le impostazioni continuano ad accettare solo indirizzi loopback.
Non esporre questa istanza locale mediante proxy pubblici o tunnel.

## Chiavi e preferenze

- La chiave inserita nella UI rimane in memoria nella scheda del browser.
  Non va in localStorage, IndexedDB, cronologia, URL, log applicativi o errori.
- Reload o **Rimuovi chiave** la eliminano. Il campo password viene svuotato
  dopo Applica. Applicare con campo vuoto seleziona la chiave dell'ambiente locale.
- Solo provider e model ID sono salvati in localStorage; messaggi e metadati
  delle risposte sono conservati attraverso `ChatHistoryStore` in IndexedDB.
- Una chat può continuare con provider diversi. Ogni risposta conserva provider,
  model ID richiesto, versione structural-codes, fingerprint e citazioni validate.
- Credenziali e configurazione non attraversano `ChatRequest` o `ChatHistoryStore`.
  Le chiavi possono transitare solo dalla UI alla route locale e da questa
  all'endpoint fisso del provider selezionato. Non sono ammessi endpoint personalizzati.
- Come per qualsiasi app browser, estensioni, strumenti di sviluppo e software
  con accesso al processo possono osservare la sessione; non condividere HAR o
  dump delle richieste che includano gli header di autenticazione.

Alternativa server-side: usare variabili d'ambiente o copiare `viewer/.env.example`
in `viewer/.env.local` (ignorato da Git). Mai usare prefissi `NEXT_PUBLIC_`/`VITE_`.

| Provider | API key | Model ID predefinito |
| --- | --- | --- |
| DeepSeek | `CHATNTC_DEEPSEEK_API_KEY` | `deepseek-flash` |
| OpenAI | `CHATNTC_OPENAI_API_KEY` | `gpt-5.6-luna` |
| Anthropic | `CHATNTC_ANTHROPIC_API_KEY` | `claude-sonnet-5` |
| Gemini | `CHATNTC_GEMINI_API_KEY` | `gemini-3.8-flash` |

`CHATNTC_PROVIDER` sceglie il provider dell'ambiente. Le variabili corrispondenti
`CHATNTC_<PROVIDER>_MODEL` ne scelgono il modello. `CHATNTC_TIMEOUT_MS` è il limite
complessivo (default 60000, massimo 120000 ms); resta compatibile il precedente
`CHATNTC_DEEPSEEK_TIMEOUT_MS`. Una selezione UI prevale sull'ambiente per provider
e modello; un'API key UI prevale solo per il provider selezionato. Mai fallback
alla chiave di un altro provider. Senza impostazioni UI viene usato l'ambiente.

## Architettura e contratto HTTP

```text
ComparisonViewer → AISettings + LocalAIConfiguration (solo standalone)
                 → ChatNTCHistoryPanel → ChatNTCPanel → ChatTransport
                                                       ↓
                                              LocalChatTransport
                                                       ↓
POST /api/chatntc → retrieval → Evidence Package → ChatNTCProvider
                                                   ├ DeepSeekAdapter
                                                   ├ OpenAIAdapter
                                                   ├ AnthropicAdapter
                                                   └ GeminiAdapter
                 ← risposta + metadati ← Citation Validator comune
```

Il corpo JSON resta `{question, history?, context?}`. La selezione locale usa
`x-chatntc-provider`, `x-chatntc-model` e, se presente, `x-chatntc-api-key`.
La chiave richiede selezione completa e `Origin` esattamente uguale all'origine
della route; Host, hostname e richieste cross-site vengono verificati. Nessun CORS.
Credenziali nel body vengono respinte. Risposte e richieste usano `no-store`;
i redirect verso altri endpoint sono vietati.

La risposta di successo conserva `ChatResult`: contratto comune, citazioni
validate, metadati evidence e `generation.provider/model`. Un errore restituisce
`{ok:false,error:{code,category,message}}`, senza output non validato.
`code` conserva compatibilità con gli step precedenti; `category` normalizza:
`invalid_credentials`, `rate_limit`, `quota_exceeded`, `timeout`,
`provider_unavailable`, `invalid_model`, `malformed_response`,
`citation_validation_failed`, `unknown`. I messaggi sono predefiniti, mai upstream.

## Capability matrix effettivamente utilizzata

Il registry è `viewer/app/chatntc/providerRegistry.ts`. La matrice descrive ciò
che gli adapter ChatNTC usano, non tutte le capacità commerciali delle API.

| Provider / modelli configurati | Protocollo / formato | Tool | Streaming | Abort | Reasoning |
| --- | --- | --- | --- | --- | --- |
| DeepSeek flash / v4-pro | Chat Completions, JSON object | No | No | Sì | Disabilitato |
| OpenAI gpt-5.6-luna | Responses, JSON Schema strict, store=false | No | No | Sì | Default provider |
| Claude sonnet-5 / haiku-4-5-20251001 | Messages, output_config JSON Schema | No | No | Sì | Default provider |
| Gemini 3.8-flash / 3.1-flash-lite | generateContent, responseFormat JSON Schema | No | No | Sì | Default provider |
| Model ID manuale non nel registry | Stesso protocollo, JSON da istruzioni | No | No | Sì | Default provider |

Minimo comune: una risposta JSON completa, controllata con lo stesso schema runtime
e lo stesso validator canonico. Gli adapter convertono soltanto la sintassi dello
schema (per OpenAI gli opzionali diventano nullable sul wire, poi vengono rimossi).
Il contratto originale viene sempre ricontrollato. Refusal, tool call inattese,
output troncato e response envelope incompatibili sono errori, non risposte valide.

DeepSeek JSON mode e i modelli manuali hanno al massimo un retry per JSON/schema
non conforme, entro lo stesso timeout. Il retry invia una direttiva fissa e la stessa
evidence, senza reinviare l'output malformato. Nessun retry per credenziali, rate limit,
errori HTTP o citazioni inventate. Senza evidence il core si astiene prima di creare
il provider, anche senza API key.

## Documentazione ufficiale verificata il 15 settembre 2026

- [OpenAI structured outputs / Responses](https://developers.openai.com/api/docs/guides/structured-outputs)
  e [gpt-5.6-luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna).
- [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs),
  [Messages](https://platform.claude.com/docs/en/api/messages/create),
  [modelli](https://platform.claude.com/docs/en/models/overview).
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output),
  [generateContent](https://ai.google.dev/api/generate-content), [modelli](https://ai.google.dev/gemini-api/docs/models).
- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)
  e [JSON mode](https://api-docs.deepseek.com/guides/json_mode/).

## Test, limiti e futuro hosted

Verifica dello STEP 5:

- `npm run check`: 440 test, registri/corpus/evidence, typecheck e lint superati.
- `npm run viewer:test`: build libreria e Vinext; 98 test viewer/core/storage,
  56 test server e 29 test UI superati.
- Typecheck e lint del viewer superati; `git diff --check` pulito.
- `npm run dev` e verifica visiva desktop/mobile (390 px), senza invii AI reali.

### File dello STEP 5

- Nuovi: `viewer/server/chatntc/{protocol,openai,anthropic,gemini}.ts`;
  `viewer/app/chatntc/{providerRegistry,LocalAIConfiguration}.ts`, `AISettings.tsx`;
  `viewer/scripts/dev-chatntc.mjs`; questo documento.
- Aggiornati: `viewer/server/chatntc/{deepseek,config,errors,routeHandler}.ts`,
  `viewer/app/api/chatntc/route.ts`, `viewer/app/chatntc/LocalChatTransport.ts`,
  `viewer/app/{ComparisonViewer,ViewerToolsDock}.tsx`, `viewer/shared/chatntc/provider.ts`,
  `viewer/shared/styles.css`, `package.json`, `viewer/package.json`, `viewer/.env.example`.
- Test aggiornati: `viewer/tests/chatntc-{server,route,ui}.test.mjs`,
  `viewer/tests/chatntc-ui-entry.ts`, `viewer/tests/package-boundary.test.mjs`.
- Documentazione aggiornata: `docs/chatntc-{server,ui,history}.md` rimanda allo STEP 5.

Il worktree contiene anche i file non ancora committati degli step precedenti:
non vanno interpretati tutti come cambi introdotti dallo STEP 5. Nessuna unità,
asset canonico o file OCFEM è stato modificato in questo step.

I test usano esclusivamente HTTP simulato. Nessuna compatibilità live con account
o modelli a pagamento è stata certificata. La disponibilità dei modelli dipende
dall'account; un ID manuale deve supportare il protocollo testuale del relativo
adapter. Non si effettua discovery remota. Il model ID registrato è quello richiesto,
non un eventuale snapshot interno risolto dal provider. Claude richiede una chiave
utilizzabile senza selezione aggiuntiva del workspace; le chiavi multi-workspace
che richiedono `anthropic-workspace-id` non sono configurabili in questa UI.
Non tutti i provider distinguono in modo strutturato rate limit da quota esaurita:
si usa `quota_exceeded` solo con codice esplicito, altrimenti `rate_limit` per HTTP 429.

Non ci sono streaming, tool calling, web search o impostazioni di reasoning.
Le direttive ChatNTC sono indipendenti dai provider; il validator prova integrità
e provenienza, non che una frase sia semanticamente dimostrata dalla citazione.

Per OCFEM serviranno un `HostedChatTransport` conforme a `ChatTransport`,
autenticazione/autorizzazione, gestione credenziali server-side, quote, policy dei
dati e un repository normativo sul backend. La composizione hosted ometterà del
tutto `AISettings` e `LocalAIConfiguration`. Non occorre cambiare ChatNTCPanel o
introdurre branch provider nel core. Nessuna integrazione OCFEM è implementata.
