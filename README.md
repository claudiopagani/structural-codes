# Structural Codes

Corpus open source, machine-readable e verificabile della normativa strutturale
italiana, con package JavaScript e viewer React.
Il perimetro iniziale comprende NTC 2018 e Circolare 7/2019: unità canoniche,
formule, tabelle, figure, relazioni, provenance, stato di verifica e tooling
editoriale.

> [!WARNING]
> Structural Codes non è una fonte normativa ufficiale e il corpus non è una
> pubblicazione normativa. Per usi professionali o giuridicamente rilevanti
> verificare sempre gli atti indicati nel
> [source registry](sources/registry/sources.v2.json).

## Stato della prerelease

La versione corrente è `0.1.0-alpha.3`. La review umana integrale del testo
delle NTC 2018 e della Circolare 7/2019 contro le fonti ufficiali è registrata
al 2026-09-20. Il corpus contiene 1.055 unità NTC e 690 unità della Circolare,
tutte con `review.status: "verified"`. Questa verifica non costituisce una
seconda review indipendente né un'approvazione ufficiale.

I 302 collegamenti Circolare → NTC sono relazioni esplicite ancora `proposed`.
Le corrispondenze ricavate dalla sola numerazione restano diagnostiche e non
sono usate come fonte canonica.

`alpha` indica che schema e API pubbliche possono ancora cambiare. I criteri
per la promozione a `beta` sono descritti in [docs/release.md](docs/release.md)
e riguardano esclusivamente la stabilità di questo progetto pubblico.

## Cosa contiene

- `structural-codes`: corpus, schema, provenance, helper e API non React;
- `structural-codes-viewer`: viewer React e client degli artefatti;
- viewer standalone con ricerca, navigazione, annotazioni, note e segnalibri;
- tooling editoriale, test e verifiche di release.

Il corpus canonico resta la source of truth. `viewer/public/` contiene solo
derivati rigenerabili e non va modificato direttamente.

## Package `structural-codes`

```bash
npm install structural-codes@alpha
```

Il runtime richiede Node.js `^22.13.0 || >=24.0.0`. L'entry point è ESM e non
ha effetti collaterali. Gli helper puri funzionano anche nel browser; le
utility basate su `node:crypto` sono isolate in `structural-codes/lib`.

```ts
import {
  CANONICAL_UNIT_SCHEMA_VERSION,
  createUnitIndex,
  documentIdFromUnitId,
  findIncomingRelations,
  sourceRegistryV2Schema,
} from "structural-codes";

import { sha256OfText } from "structural-codes/lib";
import corpusManifest from "structural-codes/corpus/manifest.json" with {
  type: "json",
};
```

Export intenzionali:

- `structural-codes`, `/corpus`, `/schema`, `/lib`;
- `structural-codes/corpus/**` e `structural-codes/schemas/**`;
- `structural-codes/sources/registry`.

Viewer, script editoriali, test, PDF ed evidence locale non entrano nel
package runtime.

## Viewer e package `structural-codes-viewer`

Il viewer offre modalità NTC, Circolare e combinata, ricerca lazy, navigazione
per riferimenti e resa di formule, tabelle e figure. Può funzionare come
applicazione standalone oppure come componente React installabile.

```tsx
import { NormativeViewer } from "structural-codes-viewer";
import "structural-codes-viewer/styles.css";

export function Normativa() {
  return <NormativeViewer defaultMode="combined" dataBaseUrl="/data/codes" />;
}
```

Il pannello destro accetta componenti esterni tramite `auxiliaryPanel` e
`AuxiliaryPanelContext`. Gli export pubblici includono inoltre stili,
generatore di artefatti, dati del corpus e API per le annotazioni. Dettagli e
comandi sono in [viewer/README.md](viewer/README.md).

Per avviare il viewer standalone:

```bash
npm ci
npm run viewer:install
npm run dev
```

Comandi principali dalla radice:

| Comando | Scopo |
| --- | --- |
| `npm run dev` | Viewer standalone in sviluppo |
| `npm run build` | Build del package `structural-codes` |
| `npm run test` | Test del package principale |
| `npm run check` | Verifica completa del repository |

Per verificare separatamente il viewer: `npm run viewer:build`,
`npm run viewer:test` e `npm run viewer:check`.

## Struttura e provenance del corpus

```text
corpus/manifest.json       perimetro e stato complessivo
corpus/units/              record JSON canonici NTC e Circolare
corpus/assets/             formule, tabelle, figure e relativi manifest
schemas/                   JSON Schema di unità e asset
sources/registry/          fonti istituzionali, byte, pagine e SHA-256
scripts/                   acquisizione, evidence, validazione e release
viewer/                    consumer web e package React separato
```

L'ordine di `blocks` riproduce la fonte. Il source registry identifica il PDF
autorevole; i PDF originali non sono redistribuiti. `raw-sources/` ed
`evidence/` sono materiali locali ignorati da Git e verificati tramite hash.

```bash
npm run validate:sources
npm run validate:corpus
npm run review:diff -- --unit corpus/units/ntc2018/4.1.json
```

Le regole editoriali sono in [AGENTS.md](AGENTS.md), nella
[pipeline evidence](docs/evidence-pipeline.md) e nella guida di
[normalizzazione e review](docs/normalizzazione-e-review.md).

## Verifica e release

```bash
npm ci
npm run check
npm run release:verify
npm --prefix viewer run pack:verify
npm --prefix viewer run test:consumer
```

`release:verify` valida corpus ed evidence locale, esegue typecheck, lint,
test e audit, costruisce il package core, ispeziona dry-run e tarball reale e
prova runtime e tipi in un consumer temporaneo. I comandi viewer verificano il
secondo tarball e un'applicazione consumer pulita con l'API generica del viewer.
Nessun comando pubblica automaticamente.

## Contribuire

Le correzioni normative richiedono confronto con il PDF registrato,
provenance, hash, test di regressione e perimetro editoriale ristretto. Le PR
software o documentali devono confermare che nessuna unità canonica è cambiata.
Vedere [CONTRIBUTING.md](CONTRIBUTING.md).

## Licenza

Software, schemi, indici e apparati editoriali sono distribuiti con licenza
LGPL-2.1-or-later. I testi normativi riprodotti sono atti ufficiali dello Stato
italiano e mantengono l'indicazione della fonte. Vedere [LICENSE](LICENSE),
[NOTICE](NOTICE) e il [perimetro normativo](docs/perimetro-normativo.md).
