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
Le figure sono lazy e il package shared non importa `pdfjs-dist`, non conosce
`/api/source-pdf` e non dipende da servizi di hosting. React e ReactDOM sono
peer dependencies React 19. Nell’indice della consultazione comparata le tre
righe seguono la selezione corrente: capitolo → paragrafi → sottoparagrafi. Il
documento attivo viene caricato e reso in un unico flusso dall’inizio alla
fine; lo scroll aggiorna i tre livelli evidenziati e i click nell’indice portano
al relativo riferimento.

## Artefatti

`npm run sync:corpus` mantiene il consumer locale aggiornato sotto
`public/data/codes/`:

```text
manifest.json
relations.json
relation-diagnostics.json
search-index.json
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
