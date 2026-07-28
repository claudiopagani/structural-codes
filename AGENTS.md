# Istruzioni per gli agenti

Queste istruzioni si applicano all'intero repository. Lo scopo del progetto è
trascrivere NTC 2018 e Circolare 7/2019 in un corpus strutturato, verificabile e
fedele alla fonte ufficiale. Un agente non interpreta la norma e non completa
mai dati mancanti per plausibilità.

## Gerarchia delle fonti e dei file

1. Il PDF ufficiale registrato in `sources/registry/sources.v2.json` è
   l'autorità editoriale.
2. `evidence/` e `raw-sources/` contengono materiale locale ignorato da Git.
   Devono essere verificati tramite hash prima dell'uso.
3. `corpus/units/<documento>/` è la fonte canonica delle unità JSON.
4. `corpus/assets/<documento>/` contiene manifest, tabelle, formule e figure
   canoniche; i PNG ufficiali sono sotto `corpus/assets/figures/`.
5. `corpus/manifest.json` descrive perimetro e stato editoriale del corpus.
6. `viewer/public/data/corpus.json` e `viewer/public/assets/figures/` sono
   derivati rigenerabili. Non modificarli né versionarli.

Il viewer è uno strumento di lettura e controllo visivo. Le correzioni si fanno
direttamente nel codice o negli script di generazione, non attraverso
un'interfaccia editoriale nel browser.

## Regole inderogabili di trascrizione

### 1. Capoversi e ritorni a capo

- Il ritorno a capo tipografico del PDF non è un separatore semantico. Se il
  periodo prosegue nella riga successiva, unire il testo con un solo spazio.
- Il cambio pagina non crea mai da solo un nuovo paragrafo. Unire il testo che
  continua oltre intestazioni, piè di pagina e numeri di pagina.
- Conservare invece i veri capoversi della fonte. Nel JSON, rappresentarli come
  blocchi `paragraph` distinti, non come `\n` inseriti dentro una stringa.
- Un punto finale non basta da solo a dimostrare un nuovo capoverso: verificare
  anche lo stacco tipografico nel PDF. Viceversa, non fondere due capoversi
  distinti solo perché il primo non termina con un punto.
- Rimuovere caratteri di controllo, intestazioni e piè di pagina soltanto dal
  testo normalizzato e registrare la trasformazione.

### 2. Parole sillabate

- Ricomporre le parole spezzate a fine riga: `com-\nportamento` diventa
  `comportamento`.
- Eliminare solo il trattino introdotto dalla sillabazione tipografica.
  Conservare trattini semantici, segni meno, intervalli, codici e parole
  realmente composte.
- Verificare sul PDF ogni caso dubbio. Non de-sillabare in massa sulla sola
  base di una espressione regolare.

### 3. Elenchi

- Quando una frase introduttiva termina con `:`, mantenerla in un blocco
  separato.
- Creare un blocco `list-item` per ciascuna voce, nell'ordine della fonte.
- Conservare lettere, numeri, punteggiatura finale e livelli di annidamento
  ufficiali.
- Non trasformare in elenco una sequenza che nel PDF è prosa continua.

### 4. Sottotitoli non numerati

- Rilevare le intestazioni interne in grassetto anche quando non hanno
  numerazione.
- Rappresentarle con un blocco `heading` distinto, nella posizione esatta,
  affinché il viewer le renda in grassetto con la corretta separazione
  verticale.
- Non simulare il grassetto inserendo Markdown dentro un paragrafo.

### 5. Simboli e matematica inline

- Ogni grandezza matematica, lettera greca, pedice, apice, operatore o formula
  presente nella prosa deve avere un segmento `text.inline` di `kind: "math"`
  con LaTeX esplicito.
- Usare, per esempio, `f_{cd}`, `\varepsilon_{cu}`, `\gamma_F`, `\le`,
  `\ge`, `\pm`, `\sum`. Non affidarsi a caratteri Unicode corrotti o a lettere
  piane per imitare pedici e apici.
- Il testo `value` deve restare leggibile; il campo `latex` è la resa
  matematica autorevole per il viewer.
- Includere nel segmento matematico l'intera espressione inline, non una
  successione incoerente di frammenti.
- Non convertire in matematica abbreviazioni o lettere discorsive che non sono
  grandezze.

### 6. Formule in display

- Trascrivere ogni formula in LaTeX confrontando direttamente il render della
  pagina, non il solo testo estratto.
- Conservare esattamente simboli, parentesi, frazioni, indici, esponenti,
  accenti, operatori, allineamenti e numero ufficiale.
- Una formula o un gruppo di formule in display è un asset nel manifest e un
  blocco nella sequenza dell'unità.
- Gruppi distinti nella fonte restano asset distinti. Non fondere, per esempio,
  due serie di formule applicabili a classi di resistenza diverse.
- Le formule non numerate hanno `officialNumber: null` e identificatori stabili
  distinti.
- Se un glifo è ambiguo, non indovinarlo: registrare un'issue bloccante e
  lasciare il contenuto non pubblicabile.

### 7. Tabelle

- Le tabelle devono essere dati strutturati, non immagini e non testo
  allineato con spazi.
- Usare i generatori `scripts/build-*-tables.ts` o aggiungerne uno specifico
  per il capitolo. Rappresentare intestazioni, righe, celle, note,
  `rowSpan`/`colSpan` e matematica nelle celle.
- Confrontare ogni valore, simbolo e cella unita con il PDF. L'estrazione
  geometrica è solo una base di lavoro, mai una validazione.
- Inserire il blocco tabella nel punto esatto del flusso editoriale.
- Una tabella multipagina resta una sola tabella e conserva tutte le pagine
  evidence.

### 8. Figure

- Preferire sempre il ritaglio raster del PDF ufficiale, con regione, pagina e
  SHA-256 registrati nel manifest.
- Il crop deve contenere la figura completa e la sua didascalia solo quando
  questa appartiene visivamente alla figura; non includere testo circostante,
  intestazioni o piè di pagina.
- Non ridisegnare una figura ufficiale senza dichiararla come derivato
  editoriale separato.
- Se gli strumenti di rendering o crop non sono disponibili, creare un
  segnaposto esplicito e un'issue `[FIGURA_MANCANTE]`. Non presentare mai un
  segnaposto come figura verificata.
- Inserire il blocco figura nel punto esatto in cui compare nella norma.

### 9. Ordine e posizione degli asset

- L'array `blocks` riproduce l'ordine della fonte.
- Tabelle, formule e figure devono comparire tra gli stessi capoversi fra i
  quali sono stampate nel PDF.
- Ogni asset deve comparire una sola volta, tramite il proprio `assetId`.
- Il cambio pagina non giustifica lo spostamento dell'asset né la duplicazione
  del testo adiacente.

### 10. Fedeltà, ambiguità e correzioni

- Non parafrasare, modernizzare, correggere refusi o uniformare la notazione
  ufficiale. Segnalare il possibile refuso separatamente.
- Non produrre testo, valori di tabella, formule o relazioni a memoria.
- Conservare `text.raw` come estrazione/evidence selezionata.
  `text.normalized` contiene la ricostruzione editoriale.
- Ogni differenza non banale tra `raw` e `normalized` deve avere una voce in
  `evidence.transformations`, con operazione, versione della regola e nota.
- Aggiornare `rawSha256` e `normalizedSha256` quando cambia il testo relativo.
- In caso di dubbio usare l'issue o il marcatore previsto dallo schema e
  mantenere lo stato `transcribed-unreviewed`; l'incertezza non si risolve con
  il consenso fra modelli.

## Procedura di lavoro per un capitolo

1. Limitare la passata a un capitolo o a uno step con pagine contigue e
   dichiarare il perimetro.
2. Controllare registro, hash e pagine della fonte.
3. Renderizzare le pagine interessate e ispezionarle visivamente; per formule,
   tabelle e figure usare una scala sufficiente a leggere ogni glifo.
4. Inventariare unità, capoversi, elenchi, sottotitoli e asset nell'ordine della
   fonte.
5. Correggere i record canonici e, per asset rigenerabili, gli script specifici
   del capitolo. Una correzione ripetibile di formule, tabelle o figure va nel
   relativo generatore, non soltanto nell'output.
6. Controllare il diff: nessuna unità fuori perimetro deve cambiare.
7. Eseguire test editoriali mirati e poi i gate generali.
8. Avviare il viewer, aprire tutte le unità modificate e confrontare
   PDF→JSON→render. Il fatto che KaTeX compili non prova che la formula sia
   corretta.
9. Lasciare la revisione come non approvata finché non sono state completate le
   review umane previste.

## Protocollo operativo obbligatorio

Le regole precedenti descrivono il risultato editoriale atteso. Questo
protocollo stabilisce come un agente deve organizzare ogni passata. Non è
facoltativo, anche quando la richiesta sembra semplice o ripetitiva.

### 1. Contratto dello step

Prima di modificare file, dichiarare:

- documento e capitolo o sottocapitolo;
- intervallo di pagine PDF contigue;
- unità JSON coinvolte;
- formule, tabelle e figure attese;
- file canonici e generatori che potranno cambiare.

Una passata deve coprire al massimo 10 pagine PDF contigue. Se contiene molte
formule, tabelle, figure o anomalie di estrazione, ridurla ulteriormente. Una
richiesta più ampia deve essere divisa in step autonomi e verificabili.

Prima della modifica eseguire `git status --short` e
`git diff --name-only`. Annotare i cambi già presenti e non includerli
automaticamente nel proprio perimetro.

### 2. Inventario prima della trascrizione

Ispezionare tutte le pagine dello step e produrre un inventario ordinato di:

- numerazione, titolo e gerarchia delle unità;
- capoversi reali e continuazioni fra pagine;
- elenchi e relativi livelli;
- sottotitoli non numerati;
- formule inline e in display;
- tabelle, comprese continuazioni multipagina;
- figure e didascalie;
- glifi dubbi, testo illeggibile e possibili refusi della fonte.

Non iniziare una correzione massiva basandosi soltanto sul testo estratto.
L'inventario deve derivare anche dal render delle pagine.

### 3. Esempi strutturali di riferimento

Prima di creare nuovi blocchi, consultare:

- `schemas/corpus-v2.schema.json` per la struttura delle unità;
- `schemas/corpus-assets-v2.schema.json` per la struttura degli asset;
- `corpus/units/ntc2018/4.1.2.1.2.1.json` come esempio di ordine fra prosa,
  figura e due gruppi distinti di formule;
- `corpus/units/circ2019/c4.1.2.2.4.5.json` come esempio di compresenza di
  heading, formule, tabelle e figure;
- i manifest sotto `corpus/assets/` richiamati dagli `assetId`.

Questi file sono esempi del formato e dell'ordinamento, non autorità sul
contenuto. Possono essere ancora `extracted`, avere issue aperte o attendere
review umana. Non copiarne testo, LaTeX, coordinate o decisioni editoriali in
un'altra unità: verificare sempre il PDF dello step.

### 4. Sequenza eseguibile

Per ogni step:

1. verificare il registro con `npm run validate:sources`;
2. se l'evidence manca, eseguire
   `npm run extract:evidence -- --source <sourceId> --pages <inizio-fine>`;
3. renderizzare ogni pagina con
   `npm run render:evidence -- --source <sourceId> --page <n> --scale 2`;
4. per glifi, formule, tabelle e figure ambigui produrre anche un ritaglio a
   scala maggiore con `--region x,y,w,h --scale 3`;
5. modificare soltanto i record e i generatori dichiarati nel contratto;
6. aggiornare evidence, trasformazioni e hash insieme al contenuto;
7. generare, quando utile, il diff editoriale con
   `npm run review:diff -- --unit <record.json>`;
8. eseguire il test mirato, quindi `npm run check` e
   `npm run viewer:test`;
9. avviare `npm run viewer:dev` e confrontare tutte le unità modificate con
   tutte le pagine del relativo step;
10. controllare nuovamente `git diff --name-only` e
    `git diff --check`.

Il controllo visuale deve coprire l'intera pagina e non soltanto gli asset:
serve a verificare capoversi, ordine, omissioni e continuità fra cambi pagina.

### 5. Limiti alle modifiche automatiche

- Non eseguire sostituzioni globali sull'intero corpus per correggere newline,
  trattini, simboli o matematica.
- Non rigenerare capitoli estranei allo step.
- Non modificare unità fuori dall'elenco dichiarato senza interrompere il
  lavoro e ampliare esplicitamente il perimetro.
- Una regex può individuare candidati, ma non può decidere da sola una
  correzione editoriale.
- Non promuovere lo stato di workflow e non chiudere issue bloccanti in base
  alla sola revisione del modello.
- Non usare il superamento dello schema, di KaTeX o dei test come prova di
  fedeltà normativa.

### 6. Condizioni di arresto

Interrompere la trascrizione e registrare un'issue bloccante quando:

- il PDF ufficiale non è disponibile o il suo hash non coincide;
- un simbolo, valore, indice, esponente o limite non è leggibile;
- non è possibile determinare con sicurezza il confine di un capoverso,
  elenco, formula, tabella o figura;
- la struttura richiesta non è rappresentabile dallo schema corrente;
- una tabella o figura non può essere verificata integralmente;
- i test falliscono per una causa che può alterare il contenuto;
- il diff coinvolge file fuori perimetro senza una ragione dimostrata.

Un agente può completare lo step lasciando elementi esplicitamente bloccati,
ma non può sostituire l'incertezza con una ricostruzione plausibile.

### 7. Resoconto obbligatorio

Alla fine di ogni step comunicare:

- pagine e unità effettivamente lavorate;
- file modificati e asset creati o aggiornati;
- anomalie corrette;
- ambiguità e issue rimaste aperte;
- test eseguiti e relativo esito;
- conferma del confronto PDF→JSON→viewer;
- unità fuori perimetro eventualmente cambiate, che normalmente devono essere
  zero.

## Comandi di verifica

```bash
npm run validate:corpus
npm run typecheck
npm run lint
npm test
npm run check
npm run viewer:test
npm run viewer:dev
```

Durante lo sviluppo è ammesso eseguire prima il test mirato. Prima della
consegna devono passare `npm run check` e `npm run viewer:test`.
`viewer:dev` rigenera automaticamente il payload pubblico dal corpus.

Quando si aggiunge una regola editoriale o si corregge una classe di errori,
aggiungere un test di regressione che controlli il contenuto e, per gli asset,
anche unicità, posizione e hash quando appropriato.

## Checklist di accettazione

- [ ] Numerazione e titolo coincidono con il PDF.
- [ ] Nessun ritorno a capo tipografico o cambio pagina ha creato un falso
      capoverso.
- [ ] I capoversi reali e tutti gli elenchi sono conservati.
- [ ] Le sillabazioni di riga sono ricomposte senza perdere trattini semantici.
- [ ] I sottotitoli non numerati sono blocchi `heading`.
- [ ] Grandezze e formule inline usano LaTeX.
- [ ] Le formule in display sono complete, separate e numerate correttamente.
- [ ] Le tabelle sono strutturate e verificate cella per cella.
- [ ] Le figure sono crop ufficiali oppure segnaposto dichiarati.
- [ ] Ogni asset è nel punto esatto e compare una sola volta.
- [ ] Evidence, trasformazioni, hash e stato di workflow sono coerenti.
- [ ] Test generali e viewer sono verdi.

## Igiene del repository pubblico

- Non versionare PDF originali, evidence locali, output di review, credenziali,
  `.env`, log, cache, build o identità reali dei revisori.
- Non includere nei messaggi di commit dati personali contenuti
  nell'`.audit-private/`.
- Non modificare o eliminare cambi non correlati già presenti nel worktree.
- Un commit editoriale deve essere piccolo, indicare documento e perimetro e
  separare la rigenerazione meccanica dalle decisioni normative.
- La licenza del software non trasforma questa repository in una pubblicazione
  ufficiale: mantenere sempre il disclaimer e il riferimento alla fonte.
