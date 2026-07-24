# @strutture-js/normativa

Corpus documentale **strutturato, interrogabile, versionato e validabile** per:

- **D.M. 17 gennaio 2018** — Norme Tecniche per le Costruzioni (NTC 2018);
- **Circolare 21 gennaio 2019, n. 7** — Istruzioni per l'applicazione delle NTC 2018;

con riferimenti espliciti e tracciati tra testo ufficiale, formule, tabelle,
figure e le implementazioni software di [`strutture-js`](https://github.com/).

> **Stato**: Fase 0–1 completate (scaffold + acquisizione fonti). La
> conversione del testo (Fase 2, pilota vento §3.3) non è ancora iniziata.
> Nessun contenuto normativo è stato trascritto a memoria: tutto il testo
> ufficiale deriva dai PDF sorgente registrati in `sources/sources.json`.

## Principi inderogabili

1. **Fedeltà alla fonte.** Il testo ufficiale dentro `<OfficialText>` è
   *verbatim*: niente parafrasi, correzioni, completamenti. Refusi e anomalie
   si conservano e si segnalano nel report anomalie.
2. **Separazione dei livelli.** Testo ufficiale NTC / testo Circolare / note
   redazionali / interpretazioni / implementazioni sono nettamente distinti.
   Nessuna nota editoriale può essere scambiata per testo normativo.
3. **Tracciabilità.** Ogni capitolo, paragrafo, formula, tabella, figura e
   funzione software ha un identificatore stabile e univoco.
4. **Riproducibilità.** Per ogni contenuto è noto: fonte, pagina PDF, hash
   SHA-256 del PDF, data di acquisizione, autore della conversione, revisore.
5. **Assenza di invenzioni.** Dati mancanti o ambigui usano marcatori
   espliciti (`[DA_VERIFICARE]`, `[FORMULA_NON_LEGGIBILE]`,
   `[TABELLA_DA_REVISIONARE]`, `[FIGURA_MANCANTE]`, `[RIFERIMENTO_AMBIGUO]`).
   **Mai** ricostruire dati per plausibilità.

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
npm run validate:all     # validate-schema + validate-ids
npm run check            # validate:all + test (CI bloccante)

# Fase 1 — fonti (gia' eseguita per NTC + Circolare)
npm run acquire:source -- --source gu-so8-2018-ntc
npm run extract:source -- --source gu-so8-2018-ntc [-- --pages 1-50]
```

## Struttura

```
content/    unita' normative MDX (fonte di verita' editoriale)
assets/     tabelle JSON, descrittori formule, figure
mappings/   mapping NTC <-> Circolare
sources/    registro fonti ufficiali (sources.json, append-only)
raw-sources/  PDF originali (NON versionati in git)
extracted/  testo grezzo estratto (rigenerabile, non versionato)
review/     code di revisione e diff (generati)
src/        schema Zod, lib, code-map, API pubblica
scripts/    validate-*, acquire-source, extract-source
tests/      test node:test
docs/       architettura, workflow, prompt DeepSeek, handoff
```

## Documentazione

- `docs/architecture.md` — decisioni architetturali, schema dati, ID.
- `docs/conversion-workflow.md` — workflow a stati della conversione.
- `docs/deepseek-prompt.md` — prompt operativo per la conversione massiva.
- `docs/handoff-fase2.md` — istruzioni per avviare la Fase 2 (pilota vento).

## Licenza

Software e apparati editoriali: LGPL-2.1-or-later (come `strutture-js`).
I testi normativi riprodotti sono atti ufficiali dello Stato italiano,
pubblicati nella Gazzetta Ufficiale; la riproduzione avviene con citazione
della fonte. Vedi `LICENSE`.
