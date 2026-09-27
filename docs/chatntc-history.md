# History locale ChatNTC

`ChatHistoryStore` è il contratto generico della cronologia.
`IndexedDbChatHistoryStore` è l'implementazione browser inclusa per il viewer
self-hosted. Importare o costruire l'adapter non apre il database: l'apertura è
lazy alla prima operazione.

## Database e schema

- database: `structural-codes-chatntc`;
- versione IndexedDB: `2`;
- object store `conversations`, chiave `id`, indice `updatedAt`;
- object store `state`, con `activeConversationId`;
- schema conversazione: `CHAT_HISTORY_SCHEMA_VERSION = 2`.

Una conversazione contiene:

- ID, titolo, date ISO, `revision` e messaggi;
- messaggio utente, contesto canonico opzionale e stato del turno;
- risposta assistente validata, contenuto e riferimenti;
- provider/model usati, versione e fingerprint del corpus/artefatti;
- versione policy, outcome e stato del Citation Validator;
- warning e indicazione di Evidence Package ridotto.

Lo schema è chiuso a ogni livello. Dati con campi inattesi o contratti non
validi vengono rifiutati invece di essere conservati silenziosamente.

## Cosa non viene salvato

La history non contiene:

- API key, header o configurazione provider;
- variabili environment;
- Evidence Package completo o chunk del corpus;
- oggetti transport, richieste HTTP o risposte grezze del provider;
- cause/errori upstream;
- prompt di sistema.

Provider e model sono provenance del singolo turno, non credenziali. Le sole
preferenze AI eventualmente in `localStorage` sono provider e model; messaggi
e risposte restano in IndexedDB.

## Revision e multi-tab

Ogni creazione parte da `revision: 1`. Update e delete richiedono la revision
attesa; la transazione confronta il valore corrente e produce `CONFLICT` se
un'altra scheda ha modificato la conversazione. `deleteAllConversations`
richiede lo snapshot completo `{ id, revision }`, così non elimina chat create
o cambiate durante una conferma aperta altrove.

Le Promise di scrittura si risolvono solo dopo il commit IndexedDB. Un errore
non causa fallback silenzioso a memoria o `localStorage`.

## Migrazioni e failure mode

L'upgrade da schema legacy v1 aggiunge la revision iniziale in una transazione.
Una versione futura incompatibile, un upgrade bloccato o dati corrotti non
causano cancellazione automatica. `ChatHistoryError` espone codici controllati:

- `UNAVAILABLE`, `BLOCKED`, `UPGRADE_FAILED`;
- `CORRUPT`, `WRITE_FAILED`, `CONFLICT`, `INVALID_DATA`.

Il database si chiude su `versionchange` e viene riaperto lazy quando serve.

## Limiti fra history e richiesta

La conversazione locale può contenere più turni del contesto inviato al
provider. `ChatNTCPanel` proietta soltanto la finestra recente prevista dal
contratto HTTP; la history completa resta locale. Una risposta salvata è una
fotografia storica e conserva i fingerprint usati per segnalarne l'eventuale
divergenza dal corpus corrente.

## API

```ts
interface ChatHistoryStore {
  listConversations(): Promise<ChatConversationSummary[]>;
  getConversation(id: string): Promise<ChatConversation | null>;
  createConversation(input: { title: string; messages?: ChatHistoryMessage[] }): Promise<ChatConversation>;
  updateConversation(id: string, patch: { title?: string; messages?: ChatHistoryMessage[] }, expectedRevision: number): Promise<ChatConversation>;
  deleteConversation(id: string, expectedRevision: number): Promise<void>;
  deleteAllConversations(expected: Array<{ id: string; revision: number }>): Promise<void>;
  getActiveConversationId(): Promise<string | null>;
  setActiveConversationId(id: string | null): Promise<void>;
}
```

Non è inclusa un'implementazione remota né un protocollo di export/import.

## Test

```bash
npm --prefix viewer run test:chatntc-history
npm --prefix viewer run test:chatntc-ui
```

I test usano `fake-indexeddb` soltanto come devDependency e coprono CRUD,
reload, migrazione, ordinamento, CAS, multi-tab e assenza di chiavi.
