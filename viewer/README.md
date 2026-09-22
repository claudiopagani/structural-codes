# structural-codes-viewer

`structural-codes-viewer` è la UI React per consultare il corpus
`structural-codes`. Il progetto espone un solo viewer comparato.

- `structural-codes` contiene corpus, schema, provenance e relazioni canoniche;
- `structural-codes-viewer` contiene UI React, client lazy degli artefatti e
  generatore deterministico;
- il viewer standalone usa Vinext/Vite e può aggiungere il PDF ufficiale solo
  in locale o in debug tramite `OfficialPdfPanel`;
- il build web di produzione espone soltanto indice e testo.

## Uso React

```tsx
import { NormativeViewer } from "structural-codes-viewer";
import "structural-codes-viewer/styles.css";

export function Normativa() {
  return <NormativeViewer defaultMode="combined" dataBaseUrl="/data/codes" />;
}
```

La modalità predefinita è `combined`: la NTC resta la struttura principale e
la Circolare viene inserita soltanto tramite relazioni esplicite del corpus.
Le relazioni `proposed` restano tracciate nei dati senza aggiungere etichette
testuali alla lettura. Il client verifica `formatVersion`, schema e manifest; non usa
la uguaglianza delle versioni SemVer per interpretare i dati.

API intenzionale:

- `defaultMode`: `combined`, `ntc` o `circ`;
- `dataBaseUrl`: directory degli artefatti lazy, default `/data/codes`;
- `assetsBaseUrl`: directory delle figure, default `/assets`;
- `auxiliaryPanel`: pannello opzionale o render prop locale;
- `auxiliaryPanelDefaultVisible`: visibilità iniziale del pannello opzionale.

La ricerca è sempre visibile ma carica `search-index.json` soltanto con almeno
due caratteri. Manifest, indice documento, chunk e relazioni restano separati.
All'apertura il client carica manifest e indice, monta per primo il chunk
dell'unità iniziale e completa senza bloccare il salto una finestra massima
`precedente + target + successivo`. Il prefetch idle resta centrato sul chunk
attivo e lo scroll estende progressivamente la finestra senza scaricare il
resto del documento.
La cache JSON di sessione deduplica richieste e parsing per URL.
Le figure sono lazy e il package shared non importa `pdfjs-dist`, non conosce
`/api/source-pdf` e non dipende da servizi di hosting. React e ReactDOM sono
peer dependencies React 19. Nell’indice della consultazione comparata le tre
righe seguono la selezione corrente: capitolo → paragrafi → sottoparagrafi. Il
documento attivo conserva un unico flusso continuo, popolato progressivamente
per chunk; lo scroll aggiorna i tre livelli evidenziati e i click nell’indice
portano al relativo riferimento. In modalità combinata, i chunk della Circolare
sono caricati solo per le relazioni e i supplementi appartenenti alla finestra
NTC effettivamente resa.

## Artefatti

`npm run sync:corpus` mantiene il consumer locale aggiornato sotto
`public/data/codes/`:

```text
manifest.json
relations.json
relation-diagnostics.json
search-index.json
cross-reference-index.json
ntc2018/index.json
ntc2018/chunks/*.json
circ2019/index.json
circ2019/chunks/*.json
```

Il generatore condiviso legge soltanto i file pubblici del package
`structural-codes`, è deterministico e non richiede un checkout sibling. La
CLI inclusa nel package può materializzare gli stessi artefatti in un consumer:

```bash
npx structural-codes-viewer --source structural-codes \
  --output public/data/codes --assets public/assets
```

Il comando non copia il corpus completo nel package viewer: usa il package
`structural-codes` installato dal consumer come sorgente.

### Semantic retrieval ChatNTC

Il runtime usa la pipeline ChatNTC e il `retrievalCoordinator` esistenti. Senza
configurazione semantic il default production è `off`: la pipeline è ricerca
lessicale → espansione strutturale → Evidence Package con hierarchy → LLM →
Citation Validator. Non legge un indice, non costruisce un provider e non
richiede BGE-M3, Docker o GPU.

- `off`: percorso legacy lexical + structural, senza inizializzazione semantic;
- `shadow`: esegue anche semantic retrieval e RRF, registra i diagnostics
  server-side ma conserva l'Evidence Package lexical;
- `on`: usa lexical + semantic + RRF prima della structural expansion.

`shadow` e `on` restano capacità sperimentali abilitate soltanto tramite
configurazione esplicita. I test end-to-end non hanno mostrato un miglioramento
qualitativo sufficientemente consistente da giustificare BGE-M3/RRF come
dipendenza production predefinita.

Configurazione server-side:

```text
CHATNTC_SEMANTIC_MODE=off|shadow|on
CHATNTC_EMBEDDING_PROVIDER=flagembedding-http|ollama
CHATNTC_EMBEDDING_URL=http://127.0.0.1:8091
CHATNTC_SEMANTIC_INDEX_PATH=<path assoluto o relativo al working directory server>
CHATNTC_EMBEDDING_TIMEOUT_MS=120000
CHATNTC_EMBEDDING_BATCH_SIZE=32
```

In `shadow/on`, `flagembedding-http` è il provider predefinito. L'indice e il
servizio devono essere disponibili al server e superare il preflight di
fingerprint, provider, modello, dimensioni, normalizzazione e parametri. Per lo
sviluppo semantic locale si avvia il servizio Docker BGE-M3 e si può indicare
`CHATNTC_SEMANTIC_INDEX_PATH=.local/chatntc-semantic-flagembedding` eseguendo il
server dalla directory `viewer`. In production si usano un path e un servizio
server-side espliciti; `.local` non è un default production.

Ollama resta una scelta esplicita per sviluppo/tooling con
`CHATNTC_EMBEDDING_PROVIDER=ollama` e `CHATNTC_EMBEDDING_MODEL=<modello>`;
non è un fallback di FlagEmbedding. Sono disponibili anche gli override
Ollama `CHATNTC_EMBEDDING_DIMENSIONS` e `CHATNTC_EMBEDDING_NUM_CTX` quando
coerenti con i metadata dell'indice.

Provider, query embedding, indice vettoriale e diagnostics restano nei moduli
server: browser e bundle frontend non ricevono modello, vettori o file indice.

Il tooling può generare indici separati sotto `viewer/.local/`, directory
ignorata da Git:

```bash
npm --prefix viewer run chatntc:semantic:index -- --provider flagembedding-http --embedding-url http://127.0.0.1:8091 --output .local/chatntc-semantic-flagembedding
npm --prefix viewer run chatntc:semantic:validate -- --provider flagembedding-http --embedding-url http://127.0.0.1:8091 --output .local/chatntc-semantic-flagembedding
```

Corpus e query devono usare esattamente lo stesso modello, digest/versione,
dimensioni e normalizzazione. Ogni modifica del corpus richiede di rigenerare
l'indice. Formato, validazioni, opzioni Ollama e limiti dello step sono descritti
in [ChatNTC semantic index](../docs/chatntc-semantic-index.md).

Exact references, candidate policy, RRF e structural expansion restano nel
percorso canonico esistente.

Il packaging Docker production-like (ChatNTC lexical di default; BGE-M3
opzionale su rete privata, indice e cache modello esterni) è documentato in
[`deploy/chatntc`](../deploy/chatntc/README.md). Non è richiesto dallo sviluppo
normale e non costituisce un deployment cloud.

## Viewer standalone

```bash
npm run dev
npm run build
npm test
```

La route `/` usa il viewer comparato. In locale o debug il pannello PDF è
opzionale e sincronizzato alla prima pagina evidence
dell’unità attiva; PDF.js e il file PDF vengono caricati solo dopo l’azione
esplicita “Apri PDF ufficiale”. Nel build web di produzione il pannello non è
presente.

### Baseline prestazionale

La baseline browser ripetibile usa il build production e Chrome DevTools
Protocol senza dipendenze aggiuntive. Ogni modalità viene aperta in un contesto
isolato con cache HTTP disabilitata e rete Fast 4G simulata (150 ms, 1,6 Mbps in
download, 750 Kbps in upload):

```bash
npm run performance:baseline
```

Il risultato machine-readable viene scritto in
`reports/performance-baseline.json`. È possibile scegliere browser, URL di un
server già avviato o destinazione con `SCV_CHROMIUM_PATH`, `SCV_BASE_URL` e
`SCV_BASELINE_OUTPUT`.

La ricerca testuale usa un Web Worker dedicato e scarica il relativo indice
invertito soltanto dopo una query non numerica di almeno due caratteri. I
riferimenti esatti (`7.3.3.3`, `§7.3.3.3`, `C7.3.3.2`) usano invece le mappe
dei document index già caricati e non richiedono l’indice full-text. Il numero
massimo di risultati si configura con la prop `searchMaxResults`.

Il confronto ripetibile tra la precedente scansione lineare e il nuovo engine
si esegue con:

```bash
npm run performance:search
```

Il report viene scritto in `reports/search-phase-two.json`; il numero di
iterazioni può essere impostato con `SCV_SEARCH_BENCHMARK_RUNS`.

### Riferimenti, permalink e citazioni

I riferimenti normativi affidabili nel testo sono pulsanti accessibili. Hover
o focus caricano una sola volta il compatto `cross-reference-index.json` per
mostrare titolo e snippet, senza scaricare il chunk del target. Il click usa lo
stesso caricamento progressivo del viewer: se il target è già montato lo scroll
è immediato; altrimenti viene richiesto prima il suo chunk e subito dopo la
finestra adiacente necessaria alla continuità di lettura. L'indice dei
backlink e le relazioni editoriali sono caricati soltanto quando si apre il
pannello “Richiami” e sono presentati in sezioni distinte.

I permalink conservano `unit` e, quando presenti, `block`, `asset` e
`assetKind` (`formula`, `table` o `figure`). La navigazione fra riferimenti usa
la history del browser, quindi avanti e indietro ripristinano anche modalità e
target. La barra contestuale permette di copiare testo, link e citazione; per
una formula già caricata espone anche il LaTeX. Nessuno di questi strumenti
carica l'indice full-text della ricerca.

## Package

La prerelease non viene pubblicata da questo repository. Per una futura
pubblicazione, dopo review:

```bash
npm run build:library
npm pack
npm publish --access public
```

Il tarball contiene soltanto `package-dist/`, CSS, README e metadati del
package; non contiene app standalone, route locale, test, cache, corpus
completo o `pdfjs-dist`.
