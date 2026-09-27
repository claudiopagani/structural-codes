# Provider e configurazione BYOK

ChatNTC supporta due modalità equivalenti di selezione del provider:

1. environment locale del server self-hosted;
2. provider, model e chiave inseriti dall'utente nella UI BYOK.

La UI prevale soltanto per la singola richiesta e non modifica l'environment.

## Provider inclusi

| Provider | Variabile chiave | Variabile modello |
| --- | --- | --- |
| DeepSeek | `CHATNTC_DEEPSEEK_API_KEY` | `CHATNTC_DEEPSEEK_MODEL` |
| OpenAI | `CHATNTC_OPENAI_API_KEY` | `CHATNTC_OPENAI_MODEL` |
| Anthropic | `CHATNTC_ANTHROPIC_API_KEY` | `CHATNTC_ANTHROPIC_MODEL` |
| Gemini | `CHATNTC_GEMINI_API_KEY` | `CHATNTC_GEMINI_MODEL` |
| OpenRouter | `CHATNTC_OPENROUTER_API_KEY` | `CHATNTC_OPENROUTER_MODEL` |

`CHATNTC_PROVIDER` seleziona il provider environment. `CHATNTC_TIMEOUT_MS`
imposta il timeout condiviso; in sua assenza è accettata anche la variabile
specifica `CHATNTC_<PROVIDER>_TIMEOUT_MS`.

Non esiste fallback di chiavi fra provider. Se è selezionato OpenAI, per
esempio, una chiave DeepSeek presente nell'environment non viene riutilizzata.

## Precedenza

Per ogni richiesta:

- se la UI invia provider e model validi, questi prevalgono sulla selezione
  environment;
- se la UI invia anche una chiave, questa prevale sulla chiave environment del
  medesimo provider;
- se la chiave UI è vuota, viene usata la chiave environment del provider
  selezionato;
- provider, model e chiave BYOK devono essere abbinati; header parziali sono
  rifiutati.

## Ciclo di vita della chiave UI

`LocalAIConfiguration` conserva la chiave in un campo privato JavaScript. La
chiave:

- resta in memoria fino a rimozione, smontaggio o reload;
- non è serializzata da `JSON.stringify`;
- non entra in `localStorage`;
- non entra in IndexedDB o nella conversation history;
- non entra nel body JSON della chat;
- non entra in Evidence Package, errori o log;
- viene inviata solo a `/api/chatntc` stessa origine nell'header
  `x-chatntc-api-key`.

Gli header `x-chatntc-provider` e `x-chatntc-model` accompagnano sempre una
chiave UI. La route richiede `Origin` uguale alla propria origine prima di
leggere la credenziale.

## Preferenze locali

La UI può salvare in `localStorage`, sotto
`chatntc.ai.preferences.v1`, soltanto:

```json
{ "provider": "deepseek", "model": "deepseek-flash" }
```

Se storage è bloccato, ChatNTC continua a funzionare in modalità session-only.
Cambiare provider cancella immediatamente la chiave precedente dalla memoria.

## Model ID

I model ID devono essere stringhe brevi senza URL, spazi o schema. OpenRouter
accetta anche il formato `vendor/model`; il catalogo esterno può cambiare e la
UI offre solo un suggerimento iniziale. Modello disponibile, costi e limiti
restano responsabilità dell'account scelto dall'utente.

## Dati inviati al provider

Il provider riceve domanda, history recente limitata, direttive ChatNTC,
schema di output ed Evidence Package. Non viene eseguita ricerca web. L'utente
deve valutare condizioni, costi e privacy del provider configurato.

## Test di regressione

I test verificano chiave assente da body, history, serializzazione, bundle,
errori e risposta; persistenza limitata a provider/model; stessa origine;
isolamento fra provider; timeout e sanitizzazione delle risposte.

```bash
npm --prefix viewer run test:chatntc-server
npm --prefix viewer run test:chatntc-ui
```
