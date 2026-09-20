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
2. Scegliere uno dei cinque provider: DeepSeek, OpenAI, Anthropic / Claude,
   Google Gemini oppure OpenRouter.
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

## OpenRouter: catalogo, ID manuali e costi

OpenRouter è il quinto provider e usa esclusivamente l'endpoint server fisso
`https://openrouter.ai/api/v1/chat/completions`. Il registry include soltanto
`openrouter/auto` come suggerimento e default, non una copia del catalogo remoto.
Il selettore non è un'allowlist: si può digitare manualmente un ID `vendor/model`, anche
con underscore, trattini o suffissi come `:free`. Il controllo è sintattico:
URL, spazi e segmenti slash vuoti o `.`/`..` non sono model ID validi.
Non viene verificata in anticipo la disponibilità del modello sull'account.

Copiare il **model ID esatto** dal [catalogo OpenRouter](https://openrouter.ai/models),
non l'URL della pagina. La [pagina ufficiale Union Alpha](https://openrouter.ai/stealth/union-alpha)
usa `stealth/union-alpha`, con trattino. Se si digita `stealth/union_alpha`,
ChatNTC conserva l'underscore invariato nella richiesta e nelle preferenze:
non lo converte in un trattino e non garantisce che OpenRouter riconosca quell'ID.
Accettazione sintattica e disponibilità reale sono due controlli diversi.

I suggerimenti non garantiscono disponibilità, compatibilità o gratuità; il
catalogo, i limiti e le tariffe possono cambiare. **Il default `openrouter/auto`
può selezionare modelli a pagamento e comportare addebiti.** Verificare ID,
prezzi, limiti e condizioni nel catalogo e nel proprio account prima dell'invio;
un suggerimento o un suffisso `:free` non è una garanzia di gratuità fornita da ChatNTC.

Tutti i modelli OpenRouter, suggeriti o manuali, usano `prompt-json`: schema e
istruzioni nel prompt, validazione runtime condivisa e Citation Validator comune.
Non vengono forzati `thinking`, `reasoning` o `response_format`, né vengono
abilitati tool o streaming. Un JSON/schema non conforme consente al massimo
un retry di formato entro lo stesso timeout; non è una promessa di output nativo
vincolato allo schema o di compatibilità live.

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
| OpenRouter | `CHATNTC_OPENROUTER_API_KEY` | `openrouter/auto` (può comportare costi) |

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
                                                   ├ GeminiAdapter
                                                   └ OpenRouterAdapter
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
| OpenRouter, tutti gli ID suggeriti e manuali | Chat Completions, prompt-json | No | No | Sì | Default provider |
| Model ID manuale non nel registry | Stesso protocollo, JSON da istruzioni | No | No | Sì | Default provider |

Minimo comune: una risposta JSON completa, controllata con lo stesso schema runtime
e lo stesso validator canonico. Gli adapter convertono soltanto la sintassi dello
schema (per OpenAI gli opzionali diventano nullable sul wire, poi vengono rimossi).
Il contratto originale viene sempre ricontrollato. Refusal, tool call inattese,
output troncato e response envelope incompatibili sono errori, non risposte valide.

DeepSeek JSON mode, OpenRouter e i modelli manuali hanno al massimo un retry di
formato per JSON/schema non conforme, entro lo stesso timeout della generazione.
Il retry invia una direttiva fissa e la stessa evidence, senza reinviare l'output
malformato. Nessun retry HTTP per credenziali, rate limit o altri errori HTTP.
Questo retry dell'adapter è distinto dal singolo repair mirato dei riferimenti
nella pipeline condivisa: le citazioni non verificabili sono poi omesse senza
nascondere l'eventuale parte tecnica generale. Anche senza fonti iniziali il
provider può produrre una risposta generale, sempre sottoposta alla validazione
comune; questo percorso richiede comunque la configurazione del provider.

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

Le regressioni OpenRouter in `viewer/tests/chatntc-{server,route,ui}.test.mjs`
coprono ID esatti, selezione delle credenziali, endpoint fisso, retry limitato,
validazione condivisa e ripristino delle preferenze senza chiave.

Verifica dell'aggiunta OpenRouter:
- `npm run check`: superato, 459 test.
- Suite server ChatNTC: 85 test superati, solo HTTP simulato.
- Typecheck e lint viewer: superati; build libreria e Vinext: riuscita.
- `npm run viewer:test`: 110/111 test del primo gruppo superati; arresto sul
  conteggio LaTeX NTC in `ntc-latex-corpus.test.mjs:36` (5839 contro 5833).
  Il corpus e quel test non sono stati modificati da questa integrazione.
- `npm run test:chatntc-ui`: 37/37 test superati, inclusa configurazione OpenRouter,
  ID manuale e ripristino senza chiave. Il blocco sandbox `spawn EPERM` è stato
  risolto eseguendo lo stesso comando con autorizzazione estesa.
  Non è stato eseguito un confronto visivo nel browser.
- Nessuna chiamata AI live né certificazione di disponibilità/gratuità dei modelli.

Verifica storica dello STEP 5 (prima dell'aggiunta OpenRouter):

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
asset canonico è stato modificato in questo step.

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

Per un deployment hosted serviranno un `HostedChatTransport` conforme a `ChatTransport`,
autenticazione/autorizzazione, gestione credenziali server-side, quote, policy dei
dati e un repository normativo sul backend. La composizione hosted ometterà del
tutto `AISettings` e `LocalAIConfiguration`. Non occorre cambiare ChatNTCPanel o
introdurre branch provider nel core. Nessuna integrazione hosted è implementata.
