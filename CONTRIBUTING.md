# Contribuire a Structural Codes

Anche una singola correzione verificata può migliorare il corpus. La review di
codice e la review normativa restano però attività distinte: il merge di una
pull request non promuove automaticamente lo stato editoriale di un'unità.

## Segnalare un problema

Prima cerca una issue esistente. Usa:

- **Correzione normativa** per testo, capoversi, LaTeX inline, formula, tabella,
  figura, evidence o posizione di un asset;
- **Relazione NTC/Circolare** per un collegamento esplicito errato, mancante,
  ambiguo o con stato di review non coerente;
- una issue libera per bug software, packaging o viewer.

Indica sempre documento, unit ID o numerazione, pagina PDF e passaggi minimi di
verifica. Non allegare il PDF completo: collega la fonte istituzionale
registrata e descrivi regione o contenuto interessato. Se non riesci a leggere
un glifo o a determinare un confine editoriale, dichiaralo come ambiguità.

## Preparazione locale

```bash
npm ci
npm run viewer:install
npm run check
npm run viewer:test
```

I PDF ufficiali non sono versionati. Acquisisci soltanto la manifestazione
presente in `sources/registry/sources.v2.json` e verificane byte e SHA-256:

```bash
npm run acquire:source -- --source gu-so8-2018-ntc --download
npm run validate:sources
```

Leggi [AGENTS.md](AGENTS.md) prima di modificare contenuti canonici: definisce
il contratto obbligatorio per perimetro, pagine contigue, capoversi,
sillabazioni, elenchi, LaTeX, asset, evidence, test e confronto visuale.

## Verificare una unità

1. Apri `corpus/units/<documento>/<numero>.json` e identifica source ID, pagine
   e regioni in `blocks[].evidence`.
2. Renderizza tutte le pagine dello step, non soltanto il ritaglio sospetto.
3. Confronta PDF → `text.raw` selezionato → `text.normalized` → viewer.
4. Per formule, tabelle e figure controlla anche il manifest richiamato
   dall'`assetId` e il generatore di capitolo.
5. Controlla issue, trasformazioni e hash: uno schema valido non prova la
   fedeltà alla fonte.

`raw` documenta l'evidence selezionata. Non va “ripulito” per estetica; se la
selezione stessa è errata, motiva la sostituzione e aggiorna evidence, raw,
normalizzato, trasformazioni e hash insieme.

## Pull request editoriale

Una PR che cambia il corpus deve:

1. dichiarare documento, massimo 10 pagine PDF contigue, unità e asset;
2. spiegare la differenza rispetto alla fonte senza interpretare la norma;
3. modificare soltanto record e generatori nel perimetro dichiarato;
4. conservare provenienza e significato canonico;
5. aggiornare trasformazioni e hash per ogni differenza non banale;
6. aggiungere una regressione su contenuto, unicità e posizione degli asset;
7. superare `npm run check` e `npm run viewer:test`;
8. documentare il confronto visuale delle unità modificate;
9. lasciare un'issue bloccante per ogni dato non verificabile.

Le PR solo software o documentazione non devono inventare un perimetro PDF:
indicano invece i gate pertinenti e confermano che nessuna unità canonica è
cambiata.

Non modificare i derivati in `viewer/public/data/`,
`viewer/public/assets/figures/` o `viewer/public/vendor/`.

## Relazioni Circolare ↔ NTC

La source of truth è `relations` nei record canonici. La somiglianza fra
`C4.1.2` e `4.1.2` può produrre soltanto un suggerimento diagnostico.

Per proporre o correggere una relazione:

- identifica unità sorgente Circolare e unità target NTC;
- cita i blocchi evidence che motivano il collegamento;
- spiega tipo, basis e rationale;
- mantieni `review.status: proposed` finché la review prevista non è stata
  realmente eseguita;
- verifica i casi 0..n e l'ordine tramite `numbering.sortKey`.

Non promuovere un suggerimento numerico a relazione esplicita senza controllo
semantico sulla fonte.

## Accettazione e avanzamento del workflow

I maintainer controllano perimetro, fonte, diff, test e coerenza di evidence.
Una correzione può essere accettata lasciando l'unità `extracted` e issue
aperte: ciò rende esplicito il lavoro residuo.

- `extracted → source-checked` richiede il controllo umano di fonte previsto;
- `source-checked → double-reviewed` richiede una seconda review indipendente;
- `double-reviewed → published` richiede l'inclusione nel perimetro editoriale
  dichiarato;
- `superseded` conserva la tracciabilità di una versione sostituita.

Non registrare nei file pubblici nomi reali, qualifiche o contatti dei
revisori. Usa l'`actorId` pseudonimo previsto e conserva l'identità privata
fuori da Git.

## Gate di release

Prima di una release eseguire:

```bash
npm run release:verify
```

Il comando non pubblica: valida corpus/evidence/integrazioni, viewer, audit,
tarball e consumer pulito. Non usare `npm publish` per aggirare un gate rosso.

## Sicurezza e licenza

Non includere PDF, credenziali, `.env`, log, cache, evidence locale, output di
review o dati di audit privato. Contribuendo accetti la licenza in [LICENSE](LICENSE)
e mantieni la citazione della fonte ufficiale per i testi normativi.
