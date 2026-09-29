# structural-codes-viewer

`structural-codes-viewer` è il package React per consultare il corpus
`structural-codes`. La stessa directory contiene l'applicazione standalone.

## Boundary

- `structural-codes`: corpus, schema, provenance e helper non React;
- `structural-codes-viewer`: viewer React, ricerca, navigazione, annotazioni,
  client lazy e generatore di artefatti;
- `viewer/app/`: composizione standalone non pubblicata nel package.

React e ReactDOM sono peer dependency. Il package non dipende a runtime da
Next/Vinext o `pdfjs-dist`.

## Viewer React

```tsx
import { NormativeViewer, type AuxiliaryPanelContext } from "structural-codes-viewer";
import "structural-codes-viewer/styles.css";

function Panel({ context }: { context: AuxiliaryPanelContext }) {
  return <aside><button onClick={context.close}>Chiudi</button></aside>;
}

export function Normativa() {
  return <NormativeViewer
    defaultMode="combined"
    dataBaseUrl="/data/codes"
    auxiliaryPanel={(context) => <Panel context={context} />}
    auxiliaryPanelModes={["ntc", "circ", "combined"]}
  />;
}
```

`NormativeViewer` espone `dataBaseUrl`, `assetsBaseUrl`, `auxiliaryPanel`,
`AuxiliaryPanelContext`, controlli di visibilità del pannello e `annotationStore`.
Il pannello generico consente ai consumer di montare i propri componenti.
Navigazione, ricerca, annotazioni, note e segnalibri sono indipendenti dalla
composizione standalone. Sono pubblici anche `./annotations`, `./corpus-data`,
`./generate-artifacts` e `./styles.css`.

## Artefatti

```bash
npm run sync:corpus
```

Il comando genera sotto `viewer/public/data/codes/` manifest, indici documento,
chunk, relazioni, riferimenti e indice di ricerca. `viewer/public/` è ignorato
da Git e rigenerabile dal corpus canonico.

Un consumer può usare la CLI inclusa:

```bash
npx structural-codes-viewer --source structural-codes \
  --output public/data/codes --assets public/assets
```

Il package viewer non include il corpus completo: il generatore legge il
package `structural-codes` installato nel consumer.

## Standalone

```bash
npm ci
npm run dev
```

Il PDF ufficiale è un ausilio locale di debug e non entra nel build pubblico o
nel package.

## Sviluppo e verifica

```bash
npm run typecheck
npm run lint
npm test
npm run check
npm run pack:verify
npm run test:consumer
```

`check` costruisce app e libreria ed esegue i test del viewer e del boundary.
`pack:verify` mostra il contenuto del tarball. `test:consumer` crea tarball
reali dei due package, li installa in una nuova app Next e verifica l'API
pubblica del viewer, inclusa l'integrazione tramite `auxiliaryPanel`.

Il tarball contiene soltanto `package-dist/`, README, licenza, notice e
manifest. Restano fuori `app/`, test, PDF, corpus completo, `.env` e output
standalone.
