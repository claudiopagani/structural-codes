# ChatNTC: overview e contratti

ChatNTC è il componente opzionale self-hosted per interrogare il corpus di
Structural Codes. Il viewer rimane pienamente utilizzabile senza ChatNTC.
Quando è abilitato, ogni risposta passa attraverso retrieval deterministico,
Evidence Package e validazione delle citazioni; il modello non legge il corpus
direttamente e non decide quali riferimenti siano canonici.

## Architettura standard

```text
query e contesto opzionale del viewer
  → lexical retrieval
  → structural expansion
  → Evidence Package
  → provider LLM
  → canonicalizzazione dei riferimenti
  → Citation Validator
  → risposta, citazioni e provenance
```

Il semantic retrieval è un'estensione sperimentale. Il default `off` percorre
esattamente la pipeline sopra e non inizializza provider embedding o indici.

## Boundary dei package

`structural-codes` contiene il corpus canonico, gli schema, la provenance e le
API non React. `structural-codes-viewer` contiene il viewer e le API condivise
ChatNTC:

- `structural-codes-viewer/chatntc`: tipi, policy, retrieval, Evidence Package,
  canonicalizzazione e Citation Validator;
- `structural-codes-viewer/chatntc/viewer-artifacts`: adapter verso gli
  artefatti lazy del viewer;
- `structural-codes-viewer/chatntc-ui`: `ChatTransport`, pannello e componenti
  React;
- `structural-codes-viewer/chatntc-history`: contratto history e adapter
  IndexedDB.

Route applicative, provider HTTP, configurazione environment e composizione
standalone restano sotto `viewer/app/` e `viewer/server/` e non sono pubblicate
nel package.

## Retrieval lessicale e strutturale

`ChatNTCRepository` è il boundary di accesso ai dati. Espone identità del
corpus, risoluzione esatta, ricerca lessicale, caricamento di unità e relazioni.
L'adapter degli artefatti usa gli stessi manifest, indici, chunk e riferimenti
del viewer.

Il retrieval:

1. normalizza la query e riconosce eventuali riferimenti esatti;
2. usa la ricerca lessicale per ottenere i candidati;
3. valida l'eventuale contesto corrente del viewer;
4. espande gerarchia, relazioni e blocchi pertinenti;
5. applica limiti deterministici a unità e caratteri;
6. produce un Evidence Package con fingerprint e warning espliciti.

Il contesto browser contiene solo identificatori (`documentId`, `unitId`,
`numbering`, eventuali `blockId`/`assetId`). Il server ricarica i dati canonici:
non accetta testo normativo fornito dal browser.

## Evidence Package

`ChatNTCEvidencePackage` include:

- domanda e opzioni effettive di retrieval;
- identità/versione e fingerprint del corpus e degli artefatti;
- unità primarie e correlate, blocchi proiettati e gerarchia;
- relazioni esplicite usate nell'espansione;
- hit di retrieval e indicazione di eventuale riduzione;
- versione della policy e warning strutturati;
- `packageId` deterministico calcolato sul contenuto.

Formule, tabelle e figure conservano gli identificatori degli asset. Il
package inviato al provider è una proiezione limitata del corpus, non una copia
completa del repository.

## Output e Citation Validator

I provider ricevono direttive condivise, schema di output, messaggi recenti ed
Evidence Package. La risposta non viene esposta direttamente:

1. il contratto strutturale viene verificato;
2. i riferimenti testuali vengono risolti contro repository ed evidence;
3. quando serve, una sola espansione controllata può recuperare unità citate;
4. un solo repair del provider rigenera l'intero JSON se restano problemi
   referenziali o di validazione della risposta;
5. se il repair non basta, una sola rigenerazione finale conservativa chiede al
   provider una risposta completa basata sulle fonti disponibili;
6. il Citation Validator ricalcola integrità, provenance e risoluzione prima
   di restituire `valid: true`. Se anche l'ultima risposta non è verificabile,
   la richiesta termina con un errore pubblico controllato.

Il provider configurato è l'unico autore di `answerMarkdown`. Dopo l'ultima
generazione accettata ChatNTC non trasforma linguisticamente il testo: la
stringa finale coincide esattamente con quella del JSON decodificato del
provider. Il server può canonicalizzare riferimenti e metadati, compresa la
provenance `generation.aiGenerated: true`. Ogni correzione testuale richiede una
nuova generazione completa. Questa separazione preserva anche eventuali segnali
di provenance o marcatura del contenuto applicati dal provider; ChatNTC non ne
verifica la presenza.

Il validatore dimostra coerenza con il corpus disponibile; non certifica la
correttezza tecnica generale della risposta e non sostituisce la fonte
ufficiale.

## Documentazione collegata

- [server e self-hosting](chatntc-server.md)
- [provider e BYOK](chatntc-byok.md)
- [UI e ChatTransport](chatntc-ui.md)
- [history IndexedDB](chatntc-history.md)
- [semantic retrieval sperimentale](chatntc-semantic-index.md)

## Test principali

```bash
npm --prefix viewer run test:chatntc
npm --prefix viewer run test:chatntc-server
npm --prefix viewer run test:chatntc-history
npm --prefix viewer run test:chatntc-ui
npm --prefix viewer run test:consumer
```

Il gate completo resta `npm run viewer:check`.
