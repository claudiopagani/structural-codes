# Handoff — Fase 2 (pilota vento, NTC §3.3 + Circ. C3.3)

Stato al **2026-07-25**: Fase 0 e Fase 1 completate. Questo documento contiene
tutto il necessario per avviare la conversione con DeepSeek.

## Cosa è già pronto

- Scaffold repo, schema Zod, lib (ids/hash/markers/parse-mdx), code-map vuoto.
- Validazione: `validate-schema`, `validate-ids` (verdi). Test: 29/29.
- Fonti registrate in `sources/sources.json` con hash SHA-256:
  - `gu-so8-2018-ntc` → `raw-sources/ntc2018/gu-42-so8-2018-02-20.pdf`
    (hash `dda1e397…05a46`, 9.9 MB, 372 pagine, testo 1.38 MB)
  - `circ-7-2019` → `raw-sources/circ2019/circolare-7-2019.pdf`
    (hash `f7c3b8d1…aed7c`, 50.7 MB, 348 pagine, testo 1.01 MB)
- Testo grezzo estratto in `extracted/<sourceId>/full-text.txt` e
  `extracted/<sourceId>/pages/page-XXXX.txt`.
- PoC `content/ntc2018/c3/s3.3/p3.3.7.mdx` (con marcatori intenzionali).
- Tabella di esempio `assets/tables/ntc2018/tab3.3.ii.json` (valori da
  completare), descrittore `assets/formulas/ntc2018/eq3.3.7.json`.
- Mapping `mappings/ntc2018-circ2019/c3.json` (pre-match `suggested`).

## Verifica di qualità già fatta (utile a DeepSeek)

- **Testo corpo NTC e Circolare: pulito e verbatim.** I rimandi `§ 3.3.7` e i
  titoli `3.3.7. COEFFICIENTE DI ESPOSIZIONE` / `C3.3.7 COEFFICIENTE DI
  ESPOSIZIONE` sono estratti correttamente.
- **Tabella 3.3.II: estratta perfettamente** (I→0,17/0,01/2; II→0,19/0,05/4;
  III→0,20/0,10/5; IV→0,22/0,30/8; V→0,23/0,70/12). Ricopiare i valori nel
  JSON e completare caption/note.
- **Formula [3.3.7] NTC: CORROTTA nell'estrazione** (pdfjs non decodifica i
  glyph matematici: appare come `2 e r t 0 t 0 min … >3.3.7@`). NON
  ricostruirla a memoria. Azione: estrarre il **crop immagine** della pagina
  (PDF pag. ~54, area §3.3.7) e trascrivere il LaTeX **dall'immagine**, oppure
  lasciare `[FORMULA_NON_LEGGIBILE]` + crop in `assets/figures/`.
- **Formula [C3.3.3] Circolare: leggibile**
  (`cpeA = cpe,1 – (cpe,1 – cpe,10) log10(A)`).
- **Fig. 3.3.2** (mappa categorie di esposizione): è un'immagine → estrarre
  raster come prova; non ridisegnare automaticamente.
- **Mapping NTC↔Circolare confermato dal testo**: la Circolare a C3.3.7
  commenta esplicitamente il §3.3.7 NTC ("Non presenta significative
  differenze rispetto alle precedenti NTC") → il link `direct` ha evidenza
  testuale, ma la conferma resta umana.

## Come avviare DeepSeek

1. Apri `docs/deepseek-prompt.md` e incolla l'intero prompt in DeepSeek.
2. Fornisci il testo grezzo del §3.3.1–3.3.9 NTC da
   `extracted/gu-so8-2018-ntc/full-text.txt` (cerca `3.3.1.` …; il corpo del
   §3.3 inizia intorno alla riga ~2820; usa anche i `pages/page-00XX.txt`
   corrispondenti alle pagine PDF ~47–56).
3. Fornisci i metadati da `sources/sources.json` (sourceId, url, hash,
   acquiredAt).
4. Fornisci il PoC `p3.3.7.mdx` come modello di formato.
5. Per ogni formula: se nell'estratto è corrotta, allega il crop immagine
   della pagina e chiedi la trascrizione LaTeX dall'immagine, oppure marca
   `[FORMULA_NON_LEGGIBILE]`.
6. Ripeti per la Circolare C3.3.1–C3.3.9 da
   `extracted/circ-7-2019/full-text.txt` (corpo C3.3.7 intorno alla riga 2313).

## Dopo la conversione DeepSeek

1. Salva gli MDX in `content/ntc2018/c3/s3.3/` e `content/circ2019/c3/s3.3/`.
2. Salva tabelle/descrittori/figure JSON in `assets/…`.
3. Aggiorna `mappings/ntc2018-circ2019/c3.json` con le proposte (`suggested`).
4. Compila `src/code-map/ntc2018-wind.ts` con le funzioni di `strutture-js`
   (`calculateNTC2018BaseWindSpeed`, `…WindReturnCoefficient`,
   `…WindPressure`, `…WindExposureCoefficient`) e aggiungilo a
   `src/code-map/index.ts`.
5. Esegui `npm run check` (validate + test). Risolvi errori; i warning su
   refsOut/asset mancanti sono attesi finché il corpus è parziale.
6. Review tecnica (ingegnere) su OfficialText, formule, tabelle → poi
   transizione di stato e registrazione misure (unità/giorno) per calibrare.

## Riferimenti incrociati al codice (da strutture-js)

Le funzioni del vento e i riferimenti puntuali già curati sono in
`strutture-js/docs/ntc2018-wind-load.md` e nei moduli
`strutture-js/src/norms/ntc2018/actions/ntc2018WindLoad.js`
(`NTC2018_WIND_REFERENCES`). Usali per il code-map; NON importare il corpus
dentro `strutture-js`.
