# Perimetro normativo e temporale

> Stato: verifica preliminare delle fonti, aggiornata al 26 luglio 2026  
> Natura: documento editoriale del progetto, non parere legale

## Atti inclusi

Il perimetro minimo del corpus comprende tre work distinti:

1. il D.M. 17 gennaio 2018, incluso il corpo del decreto e l'allegato
   «Norme tecniche per le costruzioni»;
2. la Circolare 21 gennaio 2019, n. 7 C.S.LL.PP.;
3. il D.M. 9 marzo 2023, che modifica l'art. 2 del decreto del 2018.

La Gazzetta Ufficiale identifica gli atti rispettivamente con i codici
redazionali
[`18A00716`](https://www.gazzettaufficiale.it/eli/id/2018/02/20/18A00716/sg),
[`19A00855`](https://www.gazzettaufficiale.it/eli/id/2019/02/11/19A00855/sg)
e
[`23A01847`](https://www.gazzettaufficiale.it/eli/id/2023/03/22/23A01847/sg).

Il censimento non incorpora genericamente tutti gli atti che citano le NTC.
Un atto entra nel corpus normativo primario soltanto se approva, modifica,
rettifica o fornisce le istruzioni applicative oggetto del progetto. Atti di
settore che si limitano a richiamare le NTC possono essere registrati in futuro
come riferimenti esterni.

## Date distinte

### D.M. 17 gennaio 2018

- data dell'atto: 17 gennaio 2018;
- pubblicazione: 20 febbraio 2018;
- entrata in vigore delle norme tecniche: **22 marzo 2018**.

L'art. 3 stabilisce trenta giorni dopo la pubblicazione. La data
La data `2018-02-22` è errata e non deve comparire nei record canonici.
Il corpo del decreto e l'allegato tecnico devono restare componenti
distinguibili dello stesso work.

Fonte:
[S.O. n. 8 alla GU n. 42 del 20 febbraio 2018](https://www.gazzettaufficiale.it/eli/gu/2018/02/20/42/so/8/sg/pdf).

### Circolare 21 gennaio 2019, n. 7

- data della Circolare: 21 gennaio 2019;
- pubblicazione: 11 febbraio 2019;
- data autonoma di entrata in vigore: non dichiarata nell'atto.

La Circolare è registrata come work interpretativo separato. Non deve essere
fusa con il testo NTC e non le viene attribuita artificialmente una data di
entrata in vigore.

Fonte:
[S.O. n. 5 alla GU n. 35 dell'11 febbraio 2019](https://www.gazzettaufficiale.it/eli/gu/2019/02/11/35/so/5/sg/pdf).

### D.M. 9 marzo 2023

- data dell'atto: 9 marzo 2023;
- pubblicazione: 22 marzo 2023;
- entrata in vigore: **23 marzo 2023**.

L'atto:

- sostituisce il secondo periodo dell'art. 2, comma 1, portando da cinque a
  sette anni il termine ivi previsto;
- aggiunge il comma 1-bis relativo alla sospensione del punto 11.4.2;
- aggiunge il comma 1-ter relativo alla sospensione parziale del punto 11.5.2.

Per le due sospensioni l'atto indica un periodo «dalla data di entrata in
vigore» delle NTC e fino al 22 marzo 2025. Nel registro sono quindi distinti il
periodo dichiarato dal testo e la data operativa del decreto modificativo.
Alla data di revisione del perimetro, il termine espresso del 22 marzo 2025 è
trascorso; l'applicazione a casi concreti resta fuori dallo scopo del corpus.

Fonte:
[GU n. 69 del 22 marzo 2023, pagine 27–28 stampate](https://www.gazzettaufficiale.it/eli/gu/2023/03/22/69/sg/pdf).

## Manifestazioni verificate

| Source ID | PDF | Byte | Pagine | SHA-256 |
|---|---|---:|---:|---|
| `gu-so8-2018-ntc` | S.O. n. 8/2018 | 9.888.288 | 372 | `dda1e397d56d71aa0f5bc457c3ba9b77064a468699dfc37bd056ac6c47105a46` |
| `circ-7-2019` | S.O. n. 5/2019 | 50.658.045 | 348 | `f7c3b8d1f443aadb6b3e020b6b6c19813683492ecaadd2c15bf6bf1939aaed7c` |
| `gu-sg69-2023-dm-ntc-amendment` | GU n. 69/2023 | 2.611.197 | 56 | `03366f5c6fd47587062a8b34f8468a21701de328b0d96f3cdab04cffd4fd1238` |

Gli hash sono stati calcolati sia sui file locali sia su download in streaming
dagli URL ELI ufficiali; per tutte e tre le manifestazioni byte e hash
coincidono. Il dettaglio è in
`sources/manifests/verification-2026-07-26.json`.

## Completezza del censimento

La ricerca eseguita su Gazzetta Ufficiale, MIT e Consiglio superiore dei
lavori pubblici ha individuato il D.M. 9 marzo 2023 come modifica diretta
successiva al D.M. 17 gennaio 2018. Questo è un esito di ricerca, non una
garanzia eterna di esaustività.

Prima di ogni release occorre:

- ripetere la ricerca per codice redazionale, titolo e riferimenti al decreto;
- controllare avvisi di rettifica ed errata corrige nelle pagine degli atti;
- registrare l'esito anche quando non emergono nuovi atti;
- non modificare retroattivamente una release: creare una nuova espressione o
  una nuova release del corpus.

## Riuso e attribuzione

Per decisione del proprietario del progetto, software, schemi, indici e
apparato editoriale sono distribuiti con licenza `LGPL-2.1-or-later`. Non è
previsto un gate di verifica legale prima della pubblicazione del repository.

La documentazione di licenza distingue:

- testo degli atti ufficiali;
- scansioni e impaginazione delle manifestazioni PDF;
- dati strutturati e apparato editoriale;
- codice software;
- eventuali figure o materiali con titolarità diversa.

Non viene formulata una dichiarazione generale di “pubblico dominio”. I PDF
sorgente non sono versionati; per ciascuno sono pubblicati fonte istituzionale,
dimensione e SHA-256.
