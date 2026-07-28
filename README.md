# Structural Codes

Corpus open source, strutturato e verificabile delle norme tecniche per le
costruzioni. Il primo perimetro comprende le NTC 2018 e la Circolare 7/2019.

[Apri il visualizzatore web](https://strutture-normative-viewer.claudiopagani19.chatgpt.site/)

> [!WARNING]
> Questo progetto non è una pubblicazione ufficiale dello Stato e il corpus non
> è ancora una release normativa approvata. Per usi giuridici o professionali
> verificare sempre il testo sugli atti ufficiali vigenti.

## Stato

La passata editoriale avanzata copre i capitoli 1, 2, 3 e 4.1 delle NTC 2018
e C1, C2, C4.1 della Circolare. Il capitolo C3 è in lavorazione per step: i
primi due sono stati riletti, mentre l'ultimo deve ancora essere completato.

Le unità canoniche sono esclusivamente in `corpus/` e restano `extracted`
finché non superano le review umane previste.

## Obiettivi

- riprodurre testo, formule, tabelle e figure con fedeltà alla fonte;
- mantenere provenienza fino a pagina, regione e hash;
- collegare in modo verificabile NTC, Circolare e implementazioni software;
- offrire un viewer web di sola lettura per il controllo editoriale;
- costruire un processo aperto al contributo e alla revisione della community.

## Avvio rapido

Richiede Node.js 22.13 o successivo.

```bash
npm ci
npm --prefix viewer ci
npm run viewer:dev
```

Il comando sincronizza il corpus nel viewer e avvia il sito locale. I dati e
le figure sotto `viewer/public/` sono output rigenerabili e non vanno
modificati direttamente.

Verifiche complete:

```bash
npm run check
npm run viewer:test
```

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
