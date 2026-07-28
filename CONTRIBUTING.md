# Contribuire a Structural Codes

Grazie per l'aiuto. Anche una singola correzione verificata può migliorare il
corpus, ma una trascrizione normativa richiede più evidenza di una normale
modifica editoriale.

## Prima di iniziare

Leggi [AGENTS.md](AGENTS.md): è il contratto operativo per capoversi,
sillabazioni, elenchi, LaTeX, formule, tabelle, figure, evidence e viewer.

Cerca prima una issue esistente. Se la modifica riguarda una scelta dubbia o
un intero capitolo, apri un'issue indicando documento, paragrafo e pagina PDF.
Per un refuso evidente e circoscritto puoi aprire direttamente una pull
request.

## Preparazione

```bash
npm ci
npm --prefix viewer ci
npm run check
npm run viewer:test
```

I PDF ufficiali non sono nel repository. Scarica soltanto la fonte registrata
in `sources/registry/sources.v2.json` e verifica byte e SHA-256 con la pipeline
evidence.

## Pull request editoriale

Mantieni la modifica limitata a un capitolo o a uno step contiguo. La pull
request deve:

1. indicare fonte, pagine PDF e unità interessate;
2. spiegare il difetto e la correzione senza interpretare la norma;
3. conservare `raw`, documentare le trasformazioni di `normalized` e
   aggiornare gli hash;
4. collocare formule, tabelle e figure nel punto esatto della fonte;
5. aggiungere o aggiornare test di regressione;
6. superare `npm run check` e `npm run viewer:test`;
7. includere un controllo visivo nel viewer;
8. lasciare aperta un'issue bloccante per qualunque glifo o dato ambiguo.

Non modificare `viewer/public/data/corpus.json` o
`viewer/public/assets/figures/`: vengono rigenerati dal corpus.

## Review

Una review del codice non equivale alla review normativa. Prima di promuovere
un contenuto servono i controlli umani di fonte e tecnici descritti in
`docs/normalizzazione-e-review.md`.

Non inserire nei file versionati nomi reali, qualifiche o contatti dei
revisori. Usa solo l'`actorId` pseudonimo previsto dal progetto e conserva il
registro privato fuori da Git.

## Sicurezza e licenze

Non allegare PDF, credenziali, `.env`, log, output locali di evidence o dati di
audit. Contribuendo accetti che software e apparati editoriali siano
distribuiti secondo `LICENSE`; mantieni sempre la citazione della fonte
ufficiale per i testi normativi.
