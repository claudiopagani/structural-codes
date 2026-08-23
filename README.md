# Structural Codes

Corpus open source, strutturato e verificabile delle norme tecniche per le
costruzioni. Il primo perimetro comprende le NTC 2018 e la Circolare 7/2019.

[Apri il visualizzatore web](https://strutture-normative-viewer.claudiopagani19.chatgpt.site/)

> [!WARNING]
> Questo progetto non è una pubblicazione ufficiale dello Stato e il corpus non
> è ancora una release normativa approvata. Per usi giuridici o professionali
> verificare sempre il testo sugli atti ufficiali vigenti.

## Stato

La passata editoriale avanzata copre i capitoli 1, 2, 3 e 4.1 delle NTC 2018,
la sezione NTC 7.4.6.2.5, i capitoli NTC 10–12 e le sezioni C1, C2, C4.1 e
C7.2–C7.3.6.2 della Circolare. Gli altri record presenti nel corpus restano
`extracted` e richiedono la review umana prevista dal processo; la presenza di
un record non equivale quindi a una trascrizione approvata.

Le unità canoniche sono esclusivamente in `corpus/` e restano `extracted`
finché non superano le review umane previste.

## Obiettivi

- riprodurre testo, formule, tabelle e figure con fedeltà alla fonte;
- mantenere provenienza fino a pagina, regione e hash;
- collegare in modo verificabile NTC, Circolare e implementazioni software;
- offrire un viewer web di sola lettura per il controllo editoriale;
- costruire un processo aperto al contributo e alla revisione della community.

## Avvio locale

La repository non impone una versione specifica di Node.js o npm. È
consigliata una release Node.js LTS recente; la CI verifica le linee 22 e 24.
Gli eventuali requisiti minimi tecnici restano dichiarati dalle singole
dipendenze. È sufficiente la versione npm inclusa in Node.js oppure una
versione più recente compatibile con lockfile v3.

Dopo il clone, installare separatamente e in modo deterministico i due
progetti npm:

```bash
npm ci
npm run viewer:install
```

La root contiene gli strumenti del corpus, mentre `viewer/` è un'applicazione
npm indipendente con il proprio lockfile. Non è un workspace: i comandi
`viewer:*` eseguiti dalla root usano `npm --prefix viewer` e non modificano il
lockfile principale.

Per sincronizzare automaticamente il corpus e avviare il server di sviluppo:

```bash
npm run viewer:dev
```

Build e avvio della build di produzione:

```bash
npm run build
npm run viewer:start
```

`viewer:dev` e `build` eseguono `viewer:sync:corpus` prima di Vinext. I dati e
le figure sotto `viewer/public/` sono derivati ignorati da Git e non vanno
modificati direttamente. Non sono richieste variabili d'ambiente per l'avvio
locale.

L'installazione del viewer disabilita inizialmente tutti gli install script,
controlla nel lockfile nomi e versioni rispetto ad `allowScripts` in
`viewer/package.json`, quindi esegue `npm rebuild` soltanto per i pacchetti
approvati. La stessa lista è riconosciuta direttamente come `allowScripts`
dalle versioni di npm che supportano tale policy; lo script locale la applica
anche con versioni precedenti. Un nuovo install script o una versione diversa
fa fallire `npm run viewer:install` prima dell'autorizzazione.

Verifiche complete:

```bash
npm run check
npm run viewer:check
```

`npm run check` verifica anche hash e numero di pagine dei PDF ufficiali
locali. La CI, dove `raw-sources/` è intenzionalmente assente, usa
`npm run check:ci`: valida integralmente registro e manifest ma non finge di
verificare file non distribuiti.

Per aggiornare le dipendenze, modificare il `package.json` del solo progetto
interessato con la toolchain dichiarata, eseguire `npm install` nella root
oppure `npm --prefix viewer install`, rieseguire audit, test e build, quindi
commettere insieme manifest e relativo lockfile. Per rigenerare un lockfile
senza installare pacchetti usare `npm install --package-lock-only` nella root
oppure `npm --prefix viewer install --package-lock-only`; non rigenerare
entrambi se è cambiato un solo progetto.

## Dove lavorare

```text
corpus/units/       unità JSON canoniche NTC e Circolare
corpus/assets/      manifest di formule, tabelle e figure
scripts/            estrazione, builder e profili editoriali
tests/              regressioni strutturali ed editoriali
viewer/             visualizzatore web di sola lettura
sources/registry/   registro verificabile delle fonti
schemas/            contratti JSON del corpus
fixtures/           evidence e record minimi per i test
docs/               architettura, evidence, review e roadmap
```

I PDF ufficiali sono attesi in `raw-sources/`, ma non sono versionati. Anche
`evidence/`, `review/`, `tmp/` e `.audit-private/` restano locali.

## Contribuire

Prima di modificare testo normativo, formule, tabelle o figure, leggere:

- [AGENTS.md](AGENTS.md), contratto editoriale operativo valido anche per gli
  agenti LLM;
- [CONTRIBUTING.md](CONTRIBUTING.md), procedura per issue e pull request;
- [pipeline evidence](docs/evidence-pipeline.md);
- [normalizzazione e review](docs/normalizzazione-e-review.md).

Le correzioni devono essere circoscritte, verificabili sul PDF e coperte da un
test di regressione. Dati incerti non vanno ricostruiti per plausibilità.

## Architettura e policy

- [Perimetro normativo](docs/perimetro-normativo.md)
- [ADR: JSON canonico e output derivati](docs/adr/0002-json-canonico-e-output-derivati.md)
- [ADR: evidence, relazioni e review](docs/adr/0004-evidence-relazioni-e-review.md)
- [ADR: identità, licenza e pubblicazione](docs/adr/0005-identita-licenza-e-pubblicazione.md)
- [ADR: figure ufficiali e derivati](docs/adr/0006-figure-ufficiali-e-derivati.md)

## Licenza

Software, schemi, indici e apparati editoriali sono distribuiti con licenza
LGPL-2.1-or-later. I testi normativi riprodotti sono atti ufficiali dello
Stato italiano e mantengono l'indicazione della fonte. Vedere [LICENSE](LICENSE)
e [NOTICE](NOTICE).
