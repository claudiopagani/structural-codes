# ADR 0004 — Evidence, relazioni e review

- Stato: accettata
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

La regione è opzionale: quando presente migliora la localizzazione visiva, ma
la sua assenza non degrada la verifica umana del contenuto. L'assenza
dell'intero blocco evidence rende invece il record non conforme.

Per il testo, gli hash sono calcolati sui byte UTF-8 esatti di `raw` e
`normalized`. Formule, tabelle e figure sono descritte dai manifest conformi a
`schemas/corpus-assets-v2.schema.json`; i ritagli ufficiali registrano anche
lo SHA-256 del file.

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

La verifica del contenuto usa soltanto:

`review.status: draft | verified`

`published` appartiene alla release del package e non alle unità. `superseded`
appartiene a `validity.status` quando serve rappresentare la validità
normativa. Non esiste un requisito strutturale di seconda review indipendente.

Per la prima release i due atti possono essere firmati dalla stessa persona
qualificata. Questa è una scelta di governance esplicita del proprietario,
adottata il 26 luglio 2026. Il repository conserva soltanto un `actorId`
pseudonimo; la corrispondenza con identità e qualifica è mantenuta nel registro
di audit interno, fuori da Git.

Una review automatica può integrare i controlli, ma non sostituisce la verifica
umana. `openIssues`, quando presente, è riservato a difetti reali ancora
presenti nel contenuto canonico; non rappresenta relazioni proposte, regioni
mancanti o attività storiche già concluse.

## Canonicalizzazione

L'hash del record pubblicato userà RFC 8785 JCS e SHA-256. Il campo
`integrity` non è una firma digitale e non prova l'autenticità della fonte:
serve a rilevare modifiche al record già verificato.
