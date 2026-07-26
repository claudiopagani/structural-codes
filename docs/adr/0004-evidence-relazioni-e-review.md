# ADR 0004 — Evidence, relazioni e review

- Stato: accettata per il pilota
- Data: 2026-07-26
- Ambito: Fase 2

## Evidence

Ogni blocco con `origin: official` deve indicare:

- la manifestazione `sourceId`;
- pagina PDF e, se disponibile, pagina stampata;
- regione della pagina nel sistema `pdf-points-top-left`;
- metodo, strumento e versione di estrazione;
- trasformazioni applicate;
- SHA-256 del payload raw e normalizzato.

La regione può essere `null` durante l'acquisizione, ma è bloccante dal
livello `source-checked`. L'assenza di evidence rende il record non conforme
anche nello stato `draft`.

Per il testo, gli hash sono calcolati sui byte UTF-8 esatti di `raw` e
`normalized`. Per formule, tabelle e figure la Fase 3 definirà il manifest
dell'asset e il payload preciso soggetto a hash; fino ad allora tali blocchi
non possono essere promossi a `source-checked`.

## Citazioni e relazioni

Una citazione è un fatto testuale:

- contiene lo span sul testo normalizzato;
- conserva il testo citato;
- risolve verso un'unità interna o una URI esterna;
- può essere marcata ambigua senza inventare un target.

Una relazione è un'affermazione del corpus:

- è tipizzata come `clarifies`, `amends`, `replaces`, `supersedes` o
  `related`;
- dichiara se la base è testuale o editoriale;
- indica i blocchi di evidence e una motivazione;
- nasce `proposed` e diventa `confirmed` o `rejected` solo con revisore e
  data.

Le relazioni modificative tra atti e i loro effetti temporali sono registrati
anche nel registro delle fonti, al livello work.

## Stati e review

La progressione è:

`draft → extracted → source-checked → double-reviewed → published`

`superseded` è uno stato terminale pubblicato, non una cancellazione.

Da `source-checked` ogni blocco ufficiale deve avere una regione. Da
`double-reviewed` sono richieste almeno:

- una review umana della fonte;
- una review umana tecnica o normativa;
- due atti di review distinti, entrambi firmati da una persona diversa
  dall'autore del record.

Per la prima release i due atti possono essere firmati dalla stessa persona
qualificata. Questa è una scelta di governance esplicita del proprietario,
adottata il 26 luglio 2026. Il repository conserva soltanto un `actorId`
pseudonimo; la corrispondenza con identità e qualifica è mantenuta nel registro
di audit interno, fuori da Git.

Una review automatica può integrare i controlli, ma non sostituisce le review
umane. `published` e `superseded` richiedono zero issue bloccanti e un hash
di integrità canonico.

## Canonicalizzazione

L'hash del record pubblicato userà RFC 8785 JCS e SHA-256. Il campo
`integrity` non è una firma digitale e non prova l'autenticità della fonte:
serve a rilevare modifiche al record già verificato.
