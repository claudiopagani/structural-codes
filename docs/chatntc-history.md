# ChatNTC — STEP 4: cronologia locale

Lo [STEP 5](chatntc-byok.md) permette di cambiare provider nella stessa chat:
ogni turno mantiene i propri metadati e nessuna API key entra nello storage.

## Architettura

```text
ComparisonViewer (solo feature locale/debug)
├─ LocalChatTransport → endpoint locale → provider → Citation Validator
├─ IndexedDbChatHistoryStore (apertura lazy)
└─ NormativeViewer → auxiliaryPanel → ViewerToolsDock
   ├─ ChatNTCHistoryPanel ← ChatHistoryStore
   │  ├─ elenco, apertura, rinomina, eliminazione, stato salvataggio
   │  └─ ChatNTCPanel ← ChatTransport + turni/callback
   └─ OfficialPdfPanel, quando abilitato
```

`ChatNTCHistoryPanel` importa soltanto il contratto di storage. Il consumer
fornisce un'istanza stabile di `ChatHistoryStore`; un futuro store remoto
implementerà lo stesso contratto senza cambiare la UI. Per cambiare istanza a
runtime, smontare il contenitore dopo aver completato i salvataggi pendenti.
Il pannello base continua a funzionare in memoria quando usato autonomamente.
Nessun database viene aperto e nessuna richiesta AI parte dal solo import.

Entry point aggiunto: `structural-codes-viewer/chatntc-history`.
`structural-codes-viewer/chatntc-ui` esporta anche `ChatNTCHistoryPanel`.
Nessuna nuova prop di persistenza in `NormativeViewer`.

## Schema finale

Database IndexedDB `structural-codes-chatntc`, versione **2**, per origin del
browser (schema, hostname e porta fanno parte dell'origin).

### Object store `conversations`, keyPath `id`

| Campo | Significato |
| --- | --- |
| `id` | UUID locale, indipendente dal provider |
| `schemaVersion` | `2` |
| `revision` | Intero incrementale per scritture concorrenti |
| `title` | Prima domanda normalizzata, massimo 72 caratteri Unicode; rinomina fino a 144 unità UTF-16 |
| `createdAt`, `updatedAt` | Date ISO UTC; aggiornamento monotono anche a parità di orologio |
| `messages` | Sequenza di messaggi user/assistant |

Ogni messaggio ha `id`, `role`, `content`, `timestamp`.

- **User**: `status` (`pending`, `complete`, `error`, `cancelled`), eventuale
  `context` con documentId/unitId/numbering/blockId/assetId, errore leggibile.
- **Assistant**: `turnId` collega la domanda; `answer` conserva il contratto
  strutturato senza duplicare il testo della risposta, già in `content`.
  V1/v2 conservano claim, citazioni e `usedEvidenceIds`; v3 conserva i
  `verifiedReferences` indipendenti dall'evidence e l'eventuale warning di
  degradazione. Le prime snapshot v3 che riusavano `evidenceId` vengono adattate
  in lettura senza perdere target o conversazioni.
- **Provenance** della risposta: provider, model, structuralCodesVersion,
  corpusFingerprint, artifactFingerprint, policyVersion, outcome, scope ed esito
  della validazione originale. `evidenceWarnings` ed `evidenceReduced` conservano
  gli avvisi editoriali compatti. Modello e versione mancanti nei vecchi
  transport diventano `null`, mai valori dedotti.

Non sono salvati corpus, blocchi normativi completi, Evidence Package, raw,
configurazioni provider, header o API key. Il server aggiunge modello e versione
del corpus ai metadati della risposta: non li fa dichiarare al modello.
La serializzazione proietta campi espliciti; il validatore dello storage rifiuta
campi sconosciuti. Il testo digitato dall'utente resta testo della conversazione:
non viene ispezionato o riscritto per tentare di riconoscere segreti incollati.

### Object store `state`

Chiave `activeConversationId`, valore UUID o `null`. Nessun contenuto della
cronologia viene scritto in localStorage. La preferenza tema del viewer resta
indipendente e preesistente.

## Contratto e transazioni

`ChatHistoryStore` espone list/get/create/update/delete/deleteAll e get/set
della conversazione attiva. Le liste restituiscono solo riepiloghi ordinati per
updatedAt decrescente, con ID come spareggio stabile.

Update e delete richiedono la revisione letta. DeleteAll riceve lo snapshot
ID/revisione confermato dall'utente: se un'altra scheda cambia o crea una chat
nel frattempo, l'operazione fallisce interamente. Eliminazione e azzeramento
della selezione attiva sono nella stessa transazione. Le promesse si risolvono
solo dopo il commit, mai al solo successo di una singola richiesta IndexedDB.

La UI serializza i salvataggi e disabilita le operazioni concorrenti finché
sono pendenti. Un errore mantiene messaggi e risposta in memoria, mostra
l'avviso e offre **Riprova salvataggio**. Durante un salvataggio pendente/fallito
il browser può chiedere conferma prima di chiudere la pagina. Un conflitto
offre **Salva come nuova conversazione**, preservando entrambe le versioni.
Nessun fallback silenzioso a memoria o localStorage.

## Migrazioni e dati non leggibili

- Prima apertura: creazione dei due store e indice `updatedAt`.
- Fixture legacy v1: stesso schema messaggi, senza `revision`. Upgrade v1→v2:
  validazione di ogni record, aggiunta `revision: 1`, `schemaVersion: 2`, indice
  se assente. Non modifica testo, timestamp, citazioni o selezione attiva.
- Tutte le modifiche sono nella transazione `versionchange`. Record non
  riconosciuto o errore: abort e rollback anche dei record già migrati.
- Versione futura incompatibile, upgrade bloccato, browser senza IndexedDB,
  quota/scrittura fallita e record corrotti hanno errori espliciti e sanitizzati.
  Non viene mai chiamato `deleteDatabase` come recupero automatico.
- Le connessioni si chiudono su `versionchange`; se un'altra scheda impedisce
  l'upgrade viene richiesto di chiuderla e riprovare.

## UX

In cima a ChatNTC: **Conversazioni (n)**, stato del salvataggio, titolo e
**Rinomina**. L'elenco espandibile mostra titolo e data; permette apertura,
eliminazione singola e **Elimina tutte** con conferma esplicita e annullamento.
Le chat vuote non vengono create finché non arriva la prima domanda.

**Nuova chat** conserva la precedente, interrompe un'eventuale richiesta e
svuota il contesto conversazionale. Il reload ripristina l'ultima selezione;
un turno ancora pending viene presentato come interrotto, senza rigenerazione.
Per cambiare o eliminare una chat durante una generazione occorre prima
interrompere la richiesta. Chiudere il dock o cambiare scheda PDF conserva
lo stato. La bozza non inviata non è persistita.

Le risposte hanno dettagli espandibili di versione/provenienza. Se il fingerprint
del corpus nel manifest corrente differisce da quello salvato, compare:

> Questa risposta è stata generata con una versione diversa del corpus.

Non si rigenera né si rivalida automaticamente contro il corpus corrente:
si tratta di una risposta storica validata al momento della generazione,
non di nuova evidence normativa. I link continuano a usare la navigazione
esistente del viewer. L'apertura o la rinomina non invia dati al provider.
Solo l'invio esplicito di una domanda usa il transport, con il suffisso di
storico limitato già previsto nello STEP 3.

## Test e verifica

Esito finale: 11 test storage, 24 test UI e 39 test server superati;
`npm run check` (440 test root), `npm run viewer:test`, typecheck/lint viewer
e `git diff --check` superati. Controllati anche desktop/mobile e tema scuro.

- `npm --prefix viewer run test:chatntc-history`: IndexedDB simulato con
  `fake-indexeddb` (solo devDependency), CRUD, reload, ordinamento, concorrenza,
  citazioni/provenienza, migrazione riuscita e rollback, corruzione e chiavi escluse.
- `npm --prefix viewer run test:chatntc-ui`: componenti React reali, storage
  iniettato e transport mock; conversazioni indipendenti, selezione, rinomina,
  conferma eliminazione, reload, warning corpus, retry e copia in caso di conflitto.
- Test server e route: modello/versione vengono dai metadati server; nessuna
  chiave raggiunge il client. Nessun test chiama realmente DeepSeek.
- Gate: `npm run check`, `npm run viewer:test`, typecheck e lint viewer.
- Controllo browser standalone a 1440×900 e 390×844: stato vuoto, astensione
  locale, salvataggio, rinomina e reload. Nessuna modifica editoriale: confronto
  PDF→JSON non applicabile; corpus e asset canonici fuori perimetro.

## File di questo step

Nuovi:

- `viewer/shared/chatntc-history/{types,schema,indexedDb,index}.ts`
- `viewer/shared/chatntc-ui/ChatNTCHistoryPanel.tsx`
- `viewer/shared/chatntc-ui/historyMessages.ts`
- `viewer/tests/chatntc-history.test.mjs`
- `docs/chatntc-history.md`

Aggiornati rispetto agli step precedenti:

- `viewer/shared/chatntc-ui/{ChatNTCPanel.tsx,transport.ts,index.ts}`
- `viewer/shared/chatntc/provider.ts`
- `viewer/server/chatntc/{deepseek,pipeline}.ts`
- `viewer/app/chatntc/LocalChatTransport.ts`
- `viewer/app/{ComparisonViewer,ViewerToolsDock}.tsx`
- `viewer/shared/styles.css`
- `viewer/shared/NormativeViewer.tsx`: il controllo della scorciatoia `/`
  considera anche il target dell'evento, preservando l'input dei campi di testo.
- `viewer/shared/corpusData.ts`: riallineamento delle dichiarazioni dei metadati
  canonici già richiesti dal core (asset, relazioni, review); nessuna modifica dati.
- `viewer/package.json`, `viewer/package-lock.json`
- `viewer/tests/chatntc-ui-entry.ts`, `viewer/tests/chatntc-ui.test.mjs`
- `viewer/tests/chatntc-server.test.mjs`, `viewer/tests/chatntc-route.test.mjs`
- `docs/chatntc-ui.md`, `docs/chatntc-server.md`

I file già presenti nel worktree degli step 1–3 sono stati preservati.

## Debiti intenzionali / STEP 5

- `ChatHistoryArchive` e `ChatHistoryTransfer` preparano export/import JSON
  versionato; implementazione rimandata con TODO. Servono anteprima, limiti,
  collisioni atomiche e distinzione esplicita della provenienza importata:
  un file JSON non dimostra una precedente validazione sul server.
- Nessuna sincronizzazione live fra schede: elenco aggiornato quando aperto;
  i conflitti sono rilevati al commit. Paginazione/indice separato dei riepiloghi
  potranno evitare scansioni di tutti i record in cronologie molto grandi.
- Persistenza locale del browser, soggetta a cancellazione manuale o eviction;
  non è un backup remoto. Nessuna richiesta automatica di permessi persistenti.
- Nessun remote store, account, sync, telemetria, altro provider o persistenza
  di chiavi. Lo STEP 5 potrà aggiungere adapter AI server indipendenti dallo
  storage; il record contiene già provider e modello per ciascuna risposta.
