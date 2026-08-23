# Structural Codes

Corpus open source, machine-readable e verificabile della normativa strutturale
italiana. Il perimetro iniziale comprende NTC 2018, Circolare 7/2019, unità
canoniche, formule, tabelle, figure, relazioni, provenance, workflow editoriale
e strumenti di validazione.

> [!WARNING]
> Structural Codes non è una fonte normativa ufficiale e il corpus non è
> completamente validato. La pubblicazione del package su npm significa che un
> artefatto versionato è disponibile alla community; non significa che ogni
> trascrizione o relazione sia stata approvata. Per usi professionali o
> giuridicamente rilevanti verificare sempre gli atti indicati nel
> [source registry](sources/registry/sources.v2.json).

## Stato della prerelease

La prima versione pubblica è `0.1.0-alpha.1`. Tutte le 1.745 unità canoniche
sono attualmente nello stato `extracted`; nessuna viene promossa dalla release.
I 302 collegamenti Circolare → NTC presenti nel corpus sono relazioni esplicite
ma ancora `proposed`. Le possibili corrispondenze ricavate dalla sola
numerazione restano diagnostica separata e non sono usate come fonte canonica.

Una prerelease alpha consente di ispezionare, integrare e correggere il corpus
mentre schema e API possono ancora cambiare. Non va interpretata come
dichiarazione di conformità normativa.

## Installazione

```bash
npm install structural-codes@alpha
```

Il runtime richiede Node.js `^22.13.0 || >=24.0.0`. L'entry point principale è
ESM e non ha effetti collaterali. Gli helper puri funzionano anche nel browser;
le utility che usano `node:crypto` sono isolate in `structural-codes/lib`.

## API pubblica minima

```ts
import {
  CANONICAL_UNIT_SCHEMA_VERSION,
  createUnitIndex,
  documentIdFromUnitId,
  findIncomingRelations,
  sourceRegistryV2Schema,
} from "structural-codes";

import { sha256OfFile, sha256OfText } from "structural-codes/lib";
import { sourceRegistryV2Schema as registrySchema } from "structural-codes/schema";
```

Il corpus JSON resta importabile senza attraversare `src/` o altri percorsi
interni:

```ts
import corpusManifest from "structural-codes/corpus/manifest.json" with {
  type: "json",
};
import ntc41 from "structural-codes/corpus/units/ntc2018/4.1.json" with {
  type: "json",
};
import registry from "structural-codes/sources/registry" with { type: "json" };
```

Sono export pubblici intenzionali:

- `structural-codes` — tipi, schema registry e helper puri per unità/relazioni;
- `structural-codes/corpus` — helper e tipi del corpus;
- `structural-codes/schema` — contratti Zod riusabili;
- `structural-codes/lib` — canonicalizzazione e hash Node-only;
- `structural-codes/corpus/**`, `schemas/**`, `sources/registry` e
  `integration/structural-checks-ts` — dati machine-readable documentati.

Il viewer, gli script editoriali, i test, i PDF e l'evidence locale non fanno
parte del package runtime.

## Struttura del corpus

```text
corpus/manifest.json       perimetro e stato complessivo
corpus/units/              record JSON canonici NTC e Circolare
corpus/assets/             manifest di formule, tabelle e figure
corpus/assets/figures/     crop raster verificabili delle fonti
schemas/                   JSON Schema di unità, asset e integrazioni
sources/registry/          fonti istituzionali, byte, pagine e SHA-256
integration/               metadati verso implementazioni software
scripts/                   acquisizione, evidence, builder e validazione
viewer/                    consumer web separato e in sola lettura
```

L'ordine di `blocks` riproduce il flusso della fonte. Ogni blocco testuale
conserva testo raw selezionato, testo normalizzato, pagina/regione, hash e
trasformazioni. Formule, tabelle e figure sono asset canonici richiamati da ID.
Il source registry identifica il PDF editoriale autorevole; i PDF originali
non sono redistribuiti.

## Workflow machine-readable

Lo stato è registrato per unità in `workflow.status`:

- `draft`: record di lavoro non ancora acquisito come estrazione canonica;
- `extracted`: struttura ed evidence presenti, ma confronto umano integrale non
  completato;
- `source-checked`: confronto richiesto con la fonte ufficiale completato e
  registrato; non implica la seconda review;
- `double-reviewed`: secondo controllo indipendente previsto dal workflow
  completato;
- `published`: unità inclusa nel perimetro editoriale dichiarato del corpus;
- `superseded`: unità conservata per tracciabilità ma sostituita da una versione
  successiva.

`extracted` non significa validato. `source-checked` non significa
`double-reviewed`. Il package npm può essere pubblicato mentre le unità restano
in review.

## Provenance ed evidence

Il registro contiene URL istituzionale, dimensione, numero di pagine e hash del
PDF. I record canonici collegano ogni contenuto a source ID, pagina, regione,
metodo di estrazione, trasformazioni e hash raw/normalized. `raw-sources/` ed
`evidence/` sono materiali locali ignorati da Git: devono essere acquisiti e
verificati prima della review, non allegati a issue o pull request.

```bash
npm run acquire:source -- --source gu-so8-2018-ntc --download
npm run extract:evidence -- --source gu-so8-2018-ntc --pages 74-75
npm run render:evidence -- --source gu-so8-2018-ntc --page 74 --scale 2
npm run review:diff -- --unit corpus/units/ntc2018/4.1.json
```

## Viewer per la community review

Il viewer offre tre modalità: NTC 2018, Circolare 7/2019 e NTC 2018 +
Circolare. La vista combinata usa soltanto le relazioni esplicite del corpus,
supporta 0..n unità della Circolare e marca i collegamenti non revisionati.

Gli artefatti web sono statici e rigenerabili: un manifest iniziale piccolo,
indici per documento, 153 chunk per sezione significativa, relazioni esplicite
e un indice di ricerca caricato soltanto quando serve. PDF.js e il PDF ufficiale
vengono caricati solo su richiesta nella lettura comparata. Un'app OCFEM che non
entra nel viewer non deve scaricare alcun corpus normativo.

```bash
npm ci
npm run viewer:install
npm run viewer:dev
```

Le correzioni si fanno nel corpus o nei generatori, mai sotto
`viewer/public/`, che contiene esclusivamente derivati ignorati da Git.

## Structural Codes, Structural Checks e OCFEM

- `structural-codes` contiene normativa strutturata, riferimenti, provenance,
  relazioni e workflow di review;
- `structural-checks-ts` contiene algoritmi, calcoli e verifiche strutturali;
- OCFEM può consumare versioni pubblicate dei due progetti, ma non è la source
  of truth e nessuno dei due package dipende dal prodotto OCFEM.

Il manifest d'integrazione registra nome e versione del provider, commit,
export e hash. Una futura build OCFEM può quindi registrare versione del
package, versione schema, fingerprint del corpus e fingerprint degli artefatti
generati senza copiare manualmente i dati.

## Contribuire

Per segnalare una differenza normativa usa il template dedicato indicando
documento, unità, pagina e passaggi di verifica. Per una relazione Circolare ↔
NTC errata o mancante usa il template relazione. Una pull request editoriale
deve essere circoscritta, confrontata con il PDF registrato, mantenere
provenance e hash, aggiungere una regressione e lasciare esplicite le
ambiguità.

Leggi [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), la
[pipeline evidence](docs/evidence-pipeline.md) e le regole di
[normalizzazione e review](docs/normalizzazione-e-review.md).

## Verifica e release

```bash
npm run check
npm run viewer:check
npm run release:verify
```

`release:verify` esegue validazioni di fonti, schema, corpus, evidence e
integrazione, typecheck, lint, test, audit runtime, test viewer, dry-run del
pack, ispezione del tarball reale, installazione in un consumer temporaneo e
import runtime/TypeScript delle API pubbliche. Nessun comando pubblica
automaticamente.

La procedura completa è documentata in [docs/release.md](docs/release.md).

La strategia SemVer è:

- `alpha`: corpus incompleto o non interamente revisionato; schema/API mobili;
- `beta`: struttura e API sufficientemente stabili, review ancora in corso;
- stable: perimetro dichiarato e adeguatamente revisionato.

Una stable npm resta una dichiarazione di stabilità del package, non una
certificazione legale automatica.

## Licenza e fonti ufficiali

Software, schemi, indici e apparati editoriali sono distribuiti con licenza
LGPL-2.1-or-later. I testi normativi riprodotti sono atti ufficiali dello Stato
italiano e mantengono l'indicazione della fonte. Vedere [LICENSE](LICENSE),
[NOTICE](NOTICE), [source registry](sources/registry/sources.v2.json) e il
[perimetro normativo](docs/perimetro-normativo.md).
