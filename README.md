# Structural Codes

Corpus open source, strutturato e verificabile delle norme tecniche per le
costruzioni. Il primo perimetro è italiano: NTC 2018 e Circolare 7/2019.

> [!CAUTION]
> **Corpus legacy in quarantena — non usare come testo normativo verificato.**
> L'audit ha rilevato errori di fedeltà, provenienza, schema, identificazione e
> collegamento. I contenuti correnti sono conservati per migrazione e confronto,
> ma non sono canonici, completi o pubblicabili. Lo stato macchina è dichiarato
> in [`corpus-status.json`](corpus-status.json).

Progetto per la costruzione di un corpus documentale strutturato, interrogabile,
versionato e verificabile relativo a:

- **D.M. 17 gennaio 2018** — Norme Tecniche per le Costruzioni (NTC 2018);
- **Circolare 21 gennaio 2019, n. 7** — Istruzioni per l'applicazione delle NTC 2018;

con l'obiettivo di creare riferimenti tracciati tra testo, formule, tabelle,
figure, Circolare e implementazioni software di
`structural-checks-ts` (oggi ancora denominato `strutture-js`).

Il progetto non è una pubblicazione ufficiale dello Stato. Per uso giuridico o
professionale occorre verificare il contenuto sulle fonti istituzionali e sugli
atti vigenti.

## Stato del lavoro

Il repository può essere pubblico durante lo sviluppo: la visibilità del
codice non equivale alla pubblicazione di unità normative canoniche. La
rifondazione segue la
[`roadmap di rifondazione del corpus`](docs/roadmap-rifondazione-corpus.md).
La Fase 0 ha messo in sicurezza il legacy; la Fase 1 registra e verifica le
fonti ufficiali; la Fase 2 ha introdotto il contratto JSON canonico in stato
alpha. Il primo lotto canonico copre i capitoli 1, 2, 3 e 4.1 delle NTC 2018
e le corrispondenti parti della Circolare 7/2019: 333 unità e 700 blocchi
ricavati dall'evidence ufficiale. Le unità sono ancora `extracted`, con asset
e review umane bloccanti; non costituiscono quindi una release normativa
affidabile.

```bash
npm run baseline          # rigenera reports/validation/baseline.json
npm run baseline:check    # rileva modifiche non registrate al legacy
npm run release:guard     # fallisce finché il corpus non è pubblicabile
npm run validate:sources:v2
npm run validate:corpus:v2
npm run verify:sources:online
npm run verify:evidence
npm run pilot:inventory
npm run pilot:visual-audit
npm run corpus:core:build
npm run viewer:dev          # apre il visualizzatore web locale
npm run viewer:test         # sincronizza il corpus, compila e verifica il sito
npm run verify:integration:local
npm run check:v2            # gate verde della nuova architettura
```

## Principi inderogabili

1. **Fedeltà alla fonte.** Il futuro testo verificato dovrà essere riconducibile
   all'evidence della fonte. L'uso corrente di `<OfficialText>` non costituisce
   una garanzia di fedeltà.
2. **Separazione dei livelli.** Testo ufficiale NTC / testo Circolare / note
   redazionali / interpretazioni / implementazioni sono nettamente distinti.
   Nessuna nota editoriale può essere scambiata per testo normativo.
3. **Tracciabilità.** Ogni capitolo, paragrafo, formula, tabella, figura e
   funzione software dovrà avere un identificatore stabile e univoco.
4. **Riproducibilità.** Per ogni contenuto pubblicabile dovranno essere noti:
   fonte, pagina e regione PDF, hash, trasformazioni e atti di review. Le
   identità personali dei revisori restano nel registro di audit interno.
5. **Assenza di invenzioni.** Durante acquisizione e migrazione, dati mancanti
   o ambigui usano marcatori
   espliciti (`[DA_VERIFICARE]`, `[FORMULA_NON_LEGGIBILE]`,
   `[TABELLA_DA_REVISIONARE]`, `[FIGURA_MANCANTE]`, `[RIFERIMENTO_AMBIGUO]`).
   **Mai** ricostruire dati per plausibilità. I record canonici v2 rifiutano i
   placeholder e restano invece in stato non pubblicabile con issue esplicite.

## Requisiti

- Node.js **>= 22.6** (esegue TypeScript via `--experimental-strip-types`;
  nessun build step).
- Opzionale: `pdftotext` (poppler) per estrazione di qualità superiore;
  in sua assenza lo script usa il fallback pure-JS `pdfjs-dist`.

## Installazione e comandi

```bash
npm install

npm test                 # test (node:test)
npm run typecheck        # typecheck TypeScript
npm run validate:all     # fonti e corpus v2 + controlli legacy
npm run check            # baseline + validator + test; oggi fallisce sul legacy
npm run check:v2         # nuova architettura; non promuove il legacy
npm run baseline         # registra la fotografia corrente del legacy
npm run baseline:check   # verifica che la fotografia sia invariata

# Pipeline v2
npm run acquire:v2 -- --source gu-so8-2018-ntc
npm run extract:evidence -- --source gu-so8-2018-ntc --pages 58-58
npm run render:evidence -- --source gu-so8-2018-ntc --page 58 --scale 2
npm run verify:evidence
npm run review:diff -- --unit fixtures/corpus-v2/circ2019-c3.3.7-relation.valid.json

# Pipeline legacy, conservata per confronto
npm run acquire:source -- --source gu-so8-2018-ntc
npm run extract:source -- --source gu-so8-2018-ntc [-- --pages 1-50]
```

## Struttura

```
content/    corpus MDX legacy non verificato
assets/     asset legacy incompleti
mappings/   mapping legacy non confermati
sources/    registro fonti ufficiali (sources.json, append-only)
schemas/    contratto JSON Schema del corpus canonico v2
fixtures/   esempi contrattuali validi e non validi
corpus/     unità JSON canoniche estratte, non ancora pubblicabili
viewer/     visualizzatore web del corpus, evidence e piano di chiusura
raw-sources/  PDF originali (NON versionati in git)
extracted/  testo grezzo estratto (rigenerabile, non versionato)
evidence/   item, coordinate, render e manifest v2 (non versionati)
review/     code di revisione e diff (generati)
reports/    baseline e futuri report di validazione
integration/ manifest verso structural-checks-ts
src/        schema Zod, lib, code-map, API pubblica
scripts/    validate-*, acquire-source, extract-source
tests/      test node:test
docs/       roadmap, ADR e documentazione storica
```

## Documentazione

- `docs/architecture.md` — decisioni architetturali, schema dati, ID.
- `docs/conversion-workflow.md` — workflow a stati della conversione.
- `docs/deepseek-prompt.md` — prompt operativo per la conversione massiva.
- `docs/handoff-fase2.md` — istruzioni per avviare la Fase 2 (pilota vento).
- `docs/roadmap-rifondazione-corpus.md` — piano di rifondazione e gate.
- `docs/stato-attuazione-roadmap.md` — avanzamento e gate ancora aperti.
- `docs/adr/0001-quarantena-corpus-legacy.md` — decisione sulla quarantena.
- `docs/adr/0002-json-canonico-e-output-derivati.md` — fonte canonica e derivati.
- `docs/adr/0003-identificatori-e-versionamento.md` — ID, alias e versioni.
- `docs/adr/0004-evidence-relazioni-e-review.md` — provenienza e gate editoriali.
- `docs/adr/0005-identita-licenza-e-pubblicazione.md` — nome, licenza e visibilità.
- `docs/adr/0006-figure-ufficiali-e-derivati.md` — asset ufficiali e ridisegni.
- `docs/perimetro-normativo.md` — atti inclusi, date ed effetti temporali.
- `docs/evidence-pipeline.md` — acquisizione, coordinate, hash e rendering.
- `docs/normalizzazione-e-review.md` — trasformazioni, diff e gate di review.
- `schemas/corpus-v2.schema.json` — contratto canonico `2.0.0-alpha.1`.
- `reports/validation/baseline.json` — fotografia macchina del legacy.
- `reports/validation/baseline.md` — sintesi leggibile della baseline.
- `reports/pilot/section-3.3.inventory.md` — intestazioni e target degli asset.
- `reports/pilot/section-3.3.visual-audit.md` — audit dei 27 render del pilot.
- `integration/structural-checks-ts/manifest.json` — mapping software proposti.

## Licenza

Software, schemi, indici e apparati editoriali: LGPL-2.1-or-later.
I testi normativi riprodotti sono atti ufficiali dello Stato italiano,
pubblicati nella Gazzetta Ufficiale; la riproduzione avviene con citazione
della fonte. Vedi `LICENSE` e `NOTICE`.
