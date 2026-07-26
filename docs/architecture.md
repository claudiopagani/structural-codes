# Architettura del sistema documentale

> **Documento storico del modello legacy.** Non descrive l'architettura
> canonica futura e non autorizza la pubblicazione dei contenuti correnti.
> Vedere `docs/roadmap-rifondazione-corpus.md` e ADR 0001.

Sintesi operativa delle decisioni (registro completo nella progettazione del
2026-07-24, conservata nella conversazione di origine e in `strutture-js/docs/
normativa/piano-sistema-documentale.md`).

## Decisioni chiave (ADR sintetico)

| # | Tema | Decisione | Motivazione |
|---|------|-----------|-------------|
| D1 | Collocazione | Repo autonoma `@strutture-js/normativa` | Bundle web di `strutture-js` resta a 0 byte; governance separata. |
| D2 | Formato | MDX + JSON strutturato per tabelle/manifest | MDX separa i livelli editoriali; JSON validabile per le tabelle. |
| D3 | Verita' dati | Frontmatter MDX = fonte; indici JSON = artefatti derivati | Zero duplicazione. |
| D4 | ID | Gerarchici, lower-case, senza anno nel segmento posizionale | Stabili, leggibili, URL-safe, indipendenti dai path. |
| D5 | Formule | LaTeX nel MDX + descrittore JSON solo se implementate/in verifica | Portabilita' + audit via `rawExtract`. |
| D6 | Tabelle | JSON a celle + colSpan/rowSpan | Markdown non rappresenta celle unite; HTML non validabile. |
| D7 | Figure | Raster fonte (prova) + SVG manuale opzionale | Fedelta'; mai ridisegno automatico. |
| D8 | Codice<->norma | Code-map centralizzato + test esistenza export | Niente dipendenze circolari, niente impatto bundle. |
| D9 | Versionamento | `documentId`/`editionId`/`versionId` | Distingue originale/errata/coordinati. |
| D10 | Validazione | Zod + `node:test` | Single source schema -> tipi TS. |

## Identificatori

```
ntc2018:c3/s3.3/p3.3.7        paragrafo NTC
ntc2018:c3/s3.3/tab3.3.ii     tabella (romani minuscoli)
ntc2018:c3/s3.3/eq3.3.7       equazione numerata
ntc2018:c3/s3.3/eq3.3.7-a     equazione non numerata (suffisso)
ntc2018:c3/s3.3/fig3.3.2      figura
circ2019:c3/s3.3/p-c3.3.7     paragrafo Circolare
```

- `docId`: `ntc2018` | `circ2019`.
- slug = id con `:` e `/` -> `-`, `.` -> `-`.
- URL pubblico: `/normativa/<id con ":" -> "/">`.
- ID deprecati mai riusati; rinumerazioni con relazione `supersedes` + redirect.

## Modello dati

Un file MDX = una unita' normativa (paragrafo/sottoparagrafo). Il frontmatter
conforme a `src/schema/unit.schema.ts` contiene: identita', versionamento,
provenienza (fonte, pagina PDF, hash SHA-256), contenuti (formule/tabelle/
figure per ID), `refsOut`, workflow, hash, reliability, `openIssues`.
Il body usa gli 8 componenti ammessi; **nessun testo libero fuori dai
componenti** (verificato da `validate-schema`).

## Confronto testo ufficiale

`normalizeForComparison` (in `src/lib/hash.ts`) applica SOLO: NFC, apostrofi/
virgolette tipografiche -> ASCII, rimozione sillabazione a fine riga, collasso
spazi e righe vuote multiple. Tre livelli: originale (grezzo archiviato in
`extracted/`), normalizzato (per hash/diff), rendering (MDX). Modifiche
editoriali vietate nel testo ufficiale: parafrasi, correzioni, aggiunte.

## Bundle e consumo

Il corpus NON entra nel bundle di `strutture-js`. Le app consumer importano
`@strutture-js/normativa` come dipendenza separata e opzionale; il loader
(Fase 3) carica indice (~300 KB) + capitolo on-demand. Pesi reali misurati in
Fase 1: NTC 372 pagine / 1.38 MB testo; Circolare 348 pagine / 1.01 MB testo.
