# Roadmap di rifondazione del corpus normativo

> Stato di esecuzione: vedi
> [`stato-attuazione-roadmap.md`](stato-attuazione-roadmap.md). Il corpus
> legacy resta in quarantena; il repository di sviluppo può essere pubblico.

> Stato: proposta operativa successiva all'audit iniziale  
> Ambito: NTC 2018, Circolare applicativa, atti modificativi e integrazione con `structural-checks-ts`  
> Obiettivo: costruire un corpus verificabile, versionato, cross-linkato e adatto sia alla consultazione umana sia all'uso da parte di software e modelli linguistici

## 1. Premessa e criterio generale

L'impostazione concettuale del progetto è valida, ma il contenuto attuale non deve essere corretto manualmente fino a farlo “sembrare completo”. Le verifiche iniziali mostrano errori sistemici di estrazione, provenienza, identificazione, collegamento e validazione. La strategia proposta è quindi:

1. preservare il lavoro esistente come materiale di migrazione e confronto;
2. definire prima il modello canonico e le regole di verificabilità;
3. ricostruire un piccolo campione end-to-end;
4. automatizzare i controlli sul campione;
5. estendere il processo al corpus completo;
6. pubblicare soltanto contenuti che superano gate espliciti.

Il repository si chiama **Structural Codes** ed è collegato a
`structural-checks-ts` (attuale `strutture-js`). Non è una pubblicazione
ufficiale dello Stato. Il testo giuridicamente rilevante resta quello
pubblicato dalle fonti istituzionali.

## 2. Baseline emersa dall'audit

Questi dati costituiscono il punto di partenza da conservare in un report riproducibile:

- 333 file MDX: 196 riferiti alle NTC e 137 alla Circolare;
- tutti i nodi risultano `unverified`;
- gli hash dichiarati nei contenuti sono placeholder;
- `npm run check`: 125 errori di schema e 18 warning;
- validazione ID: 2 errori e 301 warning sui 220 file analizzabili;
- 332 ID univoci su 333 file, con almeno un ID duplicato;
- 245 riferimenti interni, di cui 72 pendenti;
- 112 relazioni, di cui 11 pendenti;
- 31 mapping, pari a 62 endpoint, di cui 23 pendenti e nessuno confermato;
- 117 formule dichiarate e un solo asset disponibile;
- 34 tabelle dichiarate e un solo asset disponibile;
- 30 figure dichiarate e nessun asset disponibile;
- code-map sostanzialmente vuota;
- i PDF locali corrispondono agli hash registrati, ma il registro della Circolare è incompleto;
- sono presenti errori concreti di fedeltà, numerazione di pagina e classificazione del contenuto;
- la data di efficacia usata per le NTC risulta anticipata di un mese;
- manca la gestione del decreto modificativo del 9 marzo 2023;
- non sono presenti CI, governance di revisione, policy di contribuzione e artefatti di rilascio sufficienti;
- i test esistenti coprono prevalentemente utility e non attestano la fedeltà del corpus.

La baseline non va usata come misura di avanzamento basata sul numero di file. Un file generato non equivale a un'unità verificata.

## 3. Principi non negoziabili

### 3.1 Fonte canonica unica

Il dato strutturato, preferibilmente JSON validato da JSON Schema, è la fonte canonica. MDX, Markdown, JSONL, indici e pagine web sono output generati e non devono contenere modifiche manuali non rappresentate nel dato canonico.

### 3.2 Provenienza a livello di blocco

Ogni blocco testuale, formula, tabella o figura deve poter rispondere almeno a:

- da quale atto e quale manifestazione proviene;
- da quale pagina PDF e pagina stampata proviene;
- quale porzione della pagina lo dimostra;
- con quale metodo e versione dello strumento è stato estratto;
- quali trasformazioni di normalizzazione ha subito;
- chi lo ha revisionato e quando;
- quali hash permettono di verificare origine e trasformazioni.

### 3.3 Separazione tra testo, interpretazione e integrazione

Devono essere distinti:

- testo normativo o parafrasi dichiarata;
- struttura documentale;
- note redazionali;
- relazioni giuridiche;
- collegamenti semantici;
- mapping verso il codice;
- contenuto generato per LLM.

Nessuna interpretazione deve apparire come citazione ufficiale.

### 3.4 Pubblicazione per gate

Gli stati minimi proposti sono:

`draft` → `extracted` → `source-checked` → `double-reviewed` → `published` → `superseded`

Lo stato `published` è ammesso solo quando tutti i controlli richiesti per il tipo di contenuto sono verdi.

### 3.5 Ricostruibilità

Partendo da fonti bloccate tramite hash, ambiente dichiarato e strumenti versionati deve essere possibile rigenerare gli artefatti derivati e ottenere risultati equivalenti.

### 3.6 Identificatori stabili

Gli ID non devono dipendere dal percorso del file o da scelte editoriali transitorie. Correzioni, rinumerazioni e nuove manifestazioni devono preservare la tracciabilità.

## 4. Architettura obiettivo

La struttura esatta va ratificata con un ADR, ma il modello di destinazione consigliato è:

```text
sources/
  registry/
  originals/
schemas/
corpus/
  works/
  expressions/
  manifestations/
  units/
evidence/
  page-text/
  regions/
assets/
  formulas/
  tables/
  figures/
relations/
mappings/
integration/
  structural-checks-ts/
generated/
  mdx/
  markdown/
  jsonl/
  indexes/
reports/
  validation/
  coverage/
  releases/
legacy/
```

I concetti `work`, `expression` e `manifestation` permettono di distinguere l'atto astratto, una sua versione linguistico-giuridica e il concreto PDF di origine. Non è necessario adottare integralmente uno standard complesso, ma il modello deve restare compatibile con concetti ELI/Akoma Ntoso dove utili.

Ogni unità atomica dovrebbe includere almeno:

- ID stabile e tipo;
- gerarchia e ordinamento;
- titolo e testo strutturato;
- stato normativo e temporale;
- riferimenti interni ed esterni tipizzati;
- provenienza per blocco;
- stato di revisione;
- hash dei dati canonici;
- eventuali asset collegati;
- eventuali mapping verso il codice, mantenuti separati dal testo.

## 5. Priorità

- **P0 — affidabilità:** impedire la pubblicazione di contenuti non verificati e definire il nuovo fondamento tecnico.
- **P1 — completezza verificata:** ricostruire NTC, Circolare, modifiche e asset con controlli riproducibili.
- **P2 — integrazione:** aggiungere mapping controllati verso `structural-checks-ts` e formati ottimizzati per LLM.
- **P3 — fruizione:** sito, ricerca avanzata, API e strumenti editoriali.

Le attività P2 e P3 non devono rallentare i gate P0/P1 né creare dipendenze circolari con il corpus.

## 6. Roadmap per fasi

### Fase 0 — Messa in sicurezza e baseline

**Risultato atteso:** nessuno può confondere il corpus attuale con un corpus verificato.

#### Attività

- aggiungere un avviso evidente nel README e negli output correnti;
- congelare il contenuto MDX esistente come `legacy`, senza cancellarlo;
- salvare un report macchina della baseline: errori, warning, copertura, link pendenti, asset mancanti;
- registrare versioni degli strumenti e comandi usati per l'audit;
- verificare e documentare gli hash dei PDF locali;
- definire un criterio temporaneo che impedisca release o tag “stabili” del corpus legacy;
- aprire un registro delle decisioni architetturali.

#### Deliverable

- `reports/validation/baseline.json`;
- report leggibile della baseline;
- disclaimer di affidabilità;
- ADR iniziale sullo stato del corpus legacy.

#### Gate di uscita

- baseline riproducibile con un solo comando;
- nessun artefatto legacy presentato come `verified` o `published`;
- fonti locali identificate da hash e non modificabili accidentalmente.

### Fase 1 — Perimetro giuridico e registro ufficiale delle fonti

**Risultato atteso:** elenco completo e versionato degli atti che compongono il corpus.

#### Attività

- censire il D.M. 17 gennaio 2018, il corpo del decreto e l'allegato tecnico;
- censire la Circolare 21 gennaio 2019, n. 7 C.S.LL.PP.;
- censire il D.M. 9 marzo 2023 e ogni altro atto che modifichi, corregga o incida sul testo;
- distinguere data dell'atto, pubblicazione, entrata in vigore, efficacia e intervallo di validità;
- registrare URL istituzionali, metadata HTTP, data di acquisizione, dimensione e hash;
- conservare le fonti originali senza riscrittura;
- definire la policy per fonti sostituite, URL scomparsi e mirror;
- verificare licenze, diritto di riuso e formula di attribuzione;
- definire il disclaimer legale del repository.

#### Deliverable

- schema `SourceRecord`;
- registro fonti completo;
- manifest delle acquisizioni;
- nota sul perimetro normativo e temporale;
- matrice atto → funzione → stato.

#### Gate di uscita

- ogni documento incluso ha almeno una fonte istituzionale verificata o un'eccezione motivata;
- hash, date e relazioni tra gli atti sono validati;
- la data di efficacia delle NTC e gli effetti del D.M. 2023 sono rappresentati correttamente.

### Fase 2 — Contratto dei dati e policy degli identificatori

**Risultato atteso:** schema canonico v2 stabile abbastanza da sostenere la migrazione.

#### Attività

- redigere ADR per formato canonico, unità atomiche e output derivati;
- modellare `work`, `expression`, `manifestation`, unità, blocchi ed evidence;
- definire tassonomia dei nodi: decreto, allegato, capitolo, paragrafo, capoverso, elenco, formula, tabella, figura, nota;
- definire policy di ID, alias, deprecazione e risoluzione;
- distinguere riferimenti citazionali, gerarchici, applicativi, modificativi e semantici;
- modellare validità temporale, modifica, abrogazione, sostituzione e rettifica;
- separare testo diplomatico, testo normalizzato e annotazioni;
- definire stati e ruoli di revisione;
- definire hash dei blocchi e algoritmo di canonicalizzazione;
- predisporre esempi validi e non validi;
- stabilire una procedura di evoluzione e versionamento dello schema.

#### Deliverable

- JSON Schema v2;
- specifica degli ID;
- vocabolario delle relazioni;
- specifica di provenienza;
- fixture contrattuali;
- ADR approvati.

#### Gate di uscita

- schema validabile con strumenti standard;
- nessun ID duplicato nelle fixture;
- ogni tipo di contenuto ha requisiti di provenienza espliciti;
- sono dimostrabili almeno una modifica temporale e un rinvio normativo;
- il modello può rappresentare senza perdita un campione reale delle NTC e della Circolare.

### Fase 3 — Toolchain deterministica di acquisizione ed estrazione

**Risultato atteso:** pipeline ripetibile dalla fonte originale all'evidence grezza.

#### Attività

- implementare download/acquisizione con verifica hash e modalità offline;
- estrarre testo pagina per pagina preservando coordinate e ordine;
- registrare strumento, versione, parametri, sistema e timestamp;
- generare immagini pagina e ritagli indirizzabili;
- distinguere numerazione PDF e numerazione stampata;
- rilevare intestazioni, piè di pagina, colonne, sillabazioni e caratteri anomali;
- conservare testo raw ed eventuale testo normalizzato;
- calcolare hash prima e dopo ogni trasformazione;
- aggiungere fixture per pagine semplici, formule, tabelle, figure e layout ambigui;
- sostituire il parser YAML/regex fragile con parser standard e AST dove applicabile.

#### Deliverable

- comandi `acquire`, `extract`, `render-evidence`;
- manifest di pipeline;
- dataset evidence per pagina e regione;
- suite di regression test su pagine campione.

#### Gate di uscita

- esecuzioni ripetute sulle stesse fonti producono output equivalenti;
- ogni estratto è riconducibile a una pagina e, quando necessario, a una regione;
- errori di estrazione non vengono trasformati silenziosamente in testo canonico;
- l'assenza di una fonte o un hash diverso provoca un errore bloccante.

### Fase 4 — Editor, normalizzazione e processo di revisione

**Risultato atteso:** percorso tracciato dall'evidence al dato canonico.

#### Attività

- creare strumenti di importazione assistita, senza generazione opaca;
- definire regole documentate per spaziatura, sillabazione, Unicode, simboli, apici e numeri;
- richiedere motivazione per ogni correzione sostanziale;
- implementare diff raw → normalizzato → canonico;
- aggiungere revisione a due persone per formule, valori numerici e passaggi critici;
- impedire che autore ed unico revisore coincidano nei contenuti destinati alla pubblicazione;
- registrare commenti, esito, data e identità del revisore;
- definire campionamento aggiuntivo per sezioni ad alto rischio;
- generare viste affiancate tra fonte, testo e struttura.

#### Deliverable

- specifica di normalizzazione;
- formato dei record di review;
- comando o interfaccia di confronto;
- checklist del revisore;
- audit log append-only o equivalente.

#### Gate di uscita

- ogni modifica rispetto all'estrazione è visibile e motivata;
- un nodo non può avanzare di stato senza i review record necessari;
- formule, tabelle e numeri hanno controlli dedicati.

### Fase 5 — Pilota verticale su §3.3 NTC e C3.3

**Risultato atteso:** dimostrazione completa del nuovo metodo su un ambito difficile e rappresentativo.

Il pilota deve includere il §3.3 delle NTC e il corrispondente C3.3 della Circolare perché contiene testo, formule, rimandi, valori, asset e problemi già osservati nell'audit.

#### Attività

- modellare l'intera gerarchia del campione;
- verificare manualmente testo e pagine;
- ricostruire formule come dati strutturati e come resa visuale;
- estrarre e collegare tabelle e figure;
- creare rinvii interni e NTC ↔ Circolare;
- rappresentare l'evidence fino alla regione di pagina;
- produrre MDX, Markdown e JSONL esclusivamente tramite generatori;
- eseguire doppia revisione;
- testare ricerca, risoluzione ID e link;
- sottoporre il campione a revisione indipendente.

#### Deliverable

- campione canonico pubblicabile;
- asset completi del campione;
- report di copertura e fedeltà;
- output derivati;
- elenco dei cambiamenti necessari allo schema.

#### Gate di uscita

- zero errori di schema, ID, link e provenienza;
- zero placeholder;
- ogni formula, tabella e figura è verificabile dalla fonte;
- ogni collegamento NTC ↔ Circolare ha endpoint esistenti e motivazione;
- un revisore esterno al lavoro di estrazione approva il campione;
- le modifiche allo schema emerse dal pilota sono risolte prima della scala.

### Fase 6 — Migrazione controllata e pensionamento del modello legacy

**Risultato atteso:** il contenuto precedente viene utilizzato come indizio, non come autorità.

#### Attività

- creare un importatore legacy che segnali dati non dimostrabili;
- produrre una tabella old ID → new ID → esito;
- classificare ogni elemento come recuperabile, da riestrarre o da scartare;
- vietare il trasferimento automatico dello stato di affidabilità;
- ricostruire gli output MDX dal canonico;
- mantenere redirect o alias per gli ID pubblici recuperabili;
- generare un report delle differenze semantiche;
- spostare definitivamente il vecchio albero in area legacy solo dopo aver verificato i riferimenti esterni.

#### Deliverable

- importatore e report di migrazione;
- alias map;
- registro delle eccezioni;
- piano di deprecazione dei percorsi legacy.

#### Gate di uscita

- nessun contenuto canonico dipende dal parser legacy in produzione;
- ogni vecchio ID ha esito esplicito;
- nessun testo viene promosso senza evidence e revisione.

### Fase 7 — Ricostruzione completa delle NTC

**Risultato atteso:** corpus integrale e verificato delle NTC 2018, inclusi decreto e modifiche.

#### Sequenza consigliata

1. corpo del D.M. e disposizioni transitorie;
2. capitoli 1–2;
3. capitoli 3–4;
4. capitoli 5–7;
5. capitoli 8–9;
6. capitoli 10–12;
7. allegati, tabelle, figure, formule e note;
8. modifiche e stato temporale.

#### Attività per ogni lotto

- acquisizione ed evidence;
- strutturazione atomica;
- normalizzazione;
- risoluzione dei riferimenti;
- trattamento degli asset;
- revisione;
- generazione degli output;
- report di copertura;
- audit a campione tra lotti.

#### Gate per lotto

- 100% delle unità previste censite;
- zero errori bloccanti;
- zero link interni pendenti non esplicitamente classificati come esterni;
- 100% degli asset dichiarati presenti o motivatamente esclusi;
- revisione completa dei numeri e delle formule;
- soglia di campionamento indipendente superata.

#### Gate di uscita

- intero atto rappresentato, compreso ciò che non appartiene all'allegato tecnico;
- validità temporale e modifiche navigabili;
- output rigenerabili senza editing manuale.

### Fase 8 — Ricostruzione completa della Circolare

**Risultato atteso:** corpus integrale della Circolare, collegato alle NTC ma autonomamente citabile.

#### Attività

- applicare lo stesso processo delle NTC;
- verificare l'allineamento tra numerazione della Circolare e NTC;
- distinguere chiarimenti, istruzioni, esempi e richiami;
- evitare mapping automatici basati soltanto sulla somiglianza del numero;
- registrare mapping uno-a-uno, uno-a-molti, molti-a-uno e assenza di corrispondenza;
- revisionare in modo specifico le interpretazioni redazionali.

#### Deliverable

- corpus completo della Circolare;
- matrice di copertura Circolare ↔ NTC;
- report dei paragrafi senza corrispondenza o con corrispondenza ambigua.

#### Gate di uscita

- ogni mapping è tipizzato, motivato e revisionato;
- nessun endpoint pendente;
- la Circolare resta consultabile anche senza attraversare il mapping.

### Fase 9 — Formule, tabelle e figure come sottosistemi verificabili

**Risultato atteso:** asset tecnici completi, accessibili e comparabili alla fonte.

#### Formule

- conservare stringa originale, rappresentazione strutturata, LaTeX normalizzato e immagine evidence;
- verificare simboli, indici, unità e numerazione;
- associare definizioni delle variabili senza incorporare interpretazioni non presenti;
- testare la resa;
- richiedere doppia revisione.

#### Tabelle

- conservare ritaglio fonte e dati strutturati;
- rappresentare celle unite, note, unità e intestazioni multilivello;
- verificare ogni valore numerico;
- produrre CSV/JSON accessibile quando possibile.

#### Figure

- conservare ritaglio, didascalia, riferimento e testo alternativo redazionale marcato come tale;
- non ridisegnare una figura senza mantenere l'originale come evidence;
- collegare eventuali callout o simboli al glossario.

#### Gate di uscita

- conteggio dichiarato = conteggio presente = conteggio verificato;
- nessun asset orfano;
- resa e dato strutturato sono collegati alla stessa evidence;
- differenze rispetto alla fonte sono esplicitamente documentate.

### Fase 10 — Grafo dei riferimenti e cross-verifica

**Risultato atteso:** ogni collegamento è risolvibile, tipizzato e spiegabile.

#### Attività

- costruire resolver unico degli ID;
- distinguere riferimenti testuali espliciti da relazioni inferite;
- aggiungere evidence span al riferimento esplicito;
- richiedere motivazione e reviewer per relazioni inferite;
- rilevare cicli anomali, orfani e componenti isolate;
- produrre backlink;
- verificare coerenza tra gerarchia, ordine documentale e navigazione;
- esportare il grafo in formato macchina;
- creare report di link coverage e dangling links;
- introdurre test di proprietà sul grafo.

#### Gate di uscita

- zero riferimenti interni pendenti nelle release;
- ogni relazione inferita porta autore, motivazione e stato;
- il grafo può essere ricostruito integralmente dai dati canonici;
- ogni pagina derivata espone citazione e percorso di verifica.

### Fase 11 — Integrazione con `structural-checks-ts`

**Risultato atteso:** mapping preciso e testato tra norma e implementazione.

#### Prerequisiti

- corpus normativo stabile per le unità interessate;
- versione o commit esatto di `structural-checks-ts`;
- API pubbliche del pacchetto identificabili;
- accordo sulla direzione della dipendenza.

#### Attività

- definire schema `CodeMapping`;
- distinguere `implements`, `supports`, `validates`, `uses-parameter-from`, `example-of` e `related`;
- collegare package, versione/commit, modulo, export e quando utile line span;
- evitare riferimenti a linee come identità primaria, perché instabili;
- associare evidence normativa e test software;
- generare test che falliscono se export o firma spariscono;
- prevedere mapping a più versioni del codice;
- separare mapping normativo da documentazione/tutorial;
- decidere se il mapping vive in questa repo, in `structural-checks-ts` o in un package di integrazione; la soluzione consigliata è un manifest versionato con verifica bilaterale.

#### Deliverable

- schema e registry dei mapping;
- suite di contract test contro `structural-checks-ts`;
- matrice norma → codice → test;
- report di copertura per capitolo e modulo.

#### Gate di uscita

- ogni mapping risolve una versione esatta del pacchetto;
- ogni endpoint di codice esiste;
- ogni relazione è revisionata da almeno una persona competente sul dominio;
- i mapping non implicano conformità normativa globale quando dimostrano solo una relazione locale.

### Fase 12 — Output per umani, macchine e LLM

**Risultato atteso:** più viste coerenti generate dalla stessa fonte.

#### Output minimi

- JSON canonico;
- Markdown/MDX leggibile;
- JSONL per retrieval;
- indici di ID, titoli, termini, relazioni e asset;
- manifest di release con hash;
- pacchetto o API di risoluzione.

#### Requisiti LLM

- chunk basati sulla struttura normativa, non su lunghezze arbitrarie;
- breadcrumb completo;
- ID e versione della fonte;
- stato di revisione;
- citazione verificabile;
- contesto precedente/successivo dichiarato;
- distinzione tra testo normativo, Circolare, nota redazionale e mapping di codice;
- nessuna fusione silenziosa di atti diversi;
- dataset di domande che richiedono citazione, confronto e rifiuto in caso di assenza;
- test contro retrieval di unità omonime o temporalmente superate.

#### Gate di uscita

- tutti gli output derivano dal canonico;
- lo stesso ID produce contenuto coerente in tutti i formati;
- una risposta costruita sul corpus può risalire alla fonte e allo stato di review;
- i benchmark includono casi negativi e ambigui, non solo domande facili.

### Fase 13 — CI, governance e processo di rilascio

**Risultato atteso:** la qualità non dipende dalla memoria dei manutentori.

#### CI obbligatoria

- schema e typecheck;
- unicità e policy ID;
- risoluzione di riferimenti e mapping;
- hash delle fonti;
- presenza e coerenza degli asset;
- test della pipeline;
- test dei generatori e snapshot mirati;
- test di riproducibilità;
- lint e formato;
- scansione di segreti e dipendenze;
- report di copertura corpus;
- blocco di placeholder e stati incompatibili con la release.

#### Governance

- `CONTRIBUTING.md`;
- `CODEOWNERS`;
- `SECURITY.md`;
- `CHANGELOG.md`;
- `CITATION.cff`;
- licenza completa e `NOTICE`;
- ruoli di autore, revisore tecnico e revisore normativo;
- template per issue e pull request;
- policy per conflitti, correzioni urgenti e disclosure;
- calendario di controllo delle fonti;
- versionamento semantico del formato e calendario/versione del corpus.

#### Release

- release candidate immutabile;
- manifest con hash di fonti, dati e generatori;
- report di validazione firmato o attestato;
- revisione indipendente;
- tag e artefatti riproducibili;
- procedura di rollback e supersessione.

#### Gate di uscita

- branch protetta e controlli bloccanti;
- nessun rilascio manuale non riproducibile;
- responsabilità di review formalizzate;
- correzioni successive non cancellano la storia precedente.

### Fase 14 — Audit finale e release 1.0

**Risultato atteso:** prima release dichiarabile affidabile entro i limiti documentati.

#### Attività

- rieseguire l'audit iniziale con i nuovi strumenti;
- confrontare automaticamente corpus, fonti e inventari;
- audit indipendente a campione stratificato;
- test di citazione e cross-verifica con utenti umani;
- test d'integrazione contro la versione dichiarata di `structural-checks-ts`;
- verifica automatica della presenza di `LICENSE`, `NOTICE`, disclaimer e fonti;
- pubblicare limiti noti e aree non coperte;
- predisporre processo di manutenzione e monitoraggio delle fonti.

#### Criteri minimi della release 1.0

- zero errori bloccanti;
- zero ID duplicati;
- zero link interni pendenti;
- zero placeholder;
- fonti e asset coperti al 100%;
- tutte le unità `published` dotate della review richiesta;
- manifest e build riproducibili;
- modifiche normative rappresentate temporalmente;
- mapping di codice limitati alle relazioni effettivamente dimostrate;
- audit indipendente superato con esiti e campione pubblicati.

## 7. Dipendenze e parallelizzazione

```text
F0 Baseline
 ├─> F1 Fonti ───────┐
 └─> F2 Schema ──────┼─> F3 Pipeline ─> F4 Review ─> F5 Pilota
                     │                              ├─> F6 Migrazione
                     │                              ├─> F7 NTC ──────┐
                     │                              └─> F8 Circolare ┤
                     │                                  F9 Asset ────┤
                     └───────────────────────────────────────────────> F10 Grafo
                                                                     ├─> F11 structural-checks-ts
                                                                     └─> F12 Output/LLM
F13 CI e governance accompagna tutte le fasi ────────────────────────> F14 Release
```

Una volta stabilizzati schema e pipeline, i lotti documentali possono procedere in parallelo. La revisione non deve però essere svolta dalla stessa persona che ha eseguito l'estrazione. CI e governance iniziano in P0 e maturano progressivamente: non vanno rinviate alla fine.

## 8. Backlog iniziale convertibile in issue

### Epic A — Sicurezza del corpus attuale

- `A01` Aggiungere disclaimer e stato sperimentale.
- `A02` Automatizzare il report di baseline.
- `A03` Congelare e inventariare il contenuto legacy.
- `A04` Correggere il registro fonti senza modificare ancora il corpus.

### Epic B — Fondazioni

- `B01` ADR: fonte canonica e output derivati.
- `B02` ADR: modello temporale e atti modificativi.
- `B03` ADR: policy degli ID.
- `B04` JSON Schema v2.
- `B05` Schema di provenienza ed evidence.
- `B06` Vocabolario delle relazioni.

### Epic C — Pipeline

- `C01` Acquisizione e verifica hash.
- `C02` Estrazione con coordinate.
- `C03` Rendering pagine e ritagli.
- `C04` Normalizzazione tracciata.
- `C05` Generatore MDX/Markdown.
- `C06` Generatore JSONL.
- `C07` Report di riproducibilità.

### Epic D — Qualità editoriale

- `D01` Workflow di review.
- `D02` Diff visuale fonte/testo.
- `D03` Validatore formule.
- `D04` Validatore tabelle.
- `D05` Validatore figure.
- `D06` Audit log.

### Epic E — Pilota

- `E01` NTC §3.3.
- `E02` Circolare C3.3.
- `E03` Asset del campione.
- `E04` Mapping NTC ↔ Circolare.
- `E05` Audit indipendente del campione.
- `E06` Consolidamento schema post-pilota.

### Epic F — Copertura

- `F01` Corpo del D.M.
- `F02` NTC capitoli 1–4.
- `F03` NTC capitoli 5–8.
- `F04` NTC capitoli 9–12.
- `F05` Circolare completa.
- `F06` D.M. 9 marzo 2023 e validità temporale.
- `F07` Inventario e chiusura degli asset.

### Epic G — Collegamenti e integrazione

- `G01` Resolver e backlink.
- `G02` Report grafo.
- `G03` Schema CodeMapping.
- `G04` Manifest `structural-checks-ts`.
- `G05` Contract test con il codice.
- `G06` Matrice di copertura.

### Epic H — Release

- `H01` CI bloccante.
- `H02` Governance e policy.
- `H03` Manifest di release.
- `H04` Benchmark LLM.
- `H05` Audit finale.
- `H06` Release candidate e 1.0.

## 9. Ordine consigliato dei primi interventi

Il primo ciclo di lavoro dovrebbe limitarsi a:

1. Fase 0 completa;
2. decisioni di Fase 1 su fonti, date e atti;
3. ADR e prototipo dello schema di Fase 2;
4. estrazione deterministica delle sole pagine necessarie al pilota;
5. pilota §3.3/C3.3;
6. revisione dell'architettura in base alle difficoltà reali;
7. solo dopo, migrazione e produzione in scala.

Non è consigliato iniziare correggendo in massa gli attuali 333 MDX: si rischierebbe di investire nel formato e nelle assunzioni che devono essere sostituiti.

## 10. Definition of Done

### Per singola unità normativa

Un'unità è completata solo se:

- ID, gerarchia e tipo sono validi;
- testo e titolo sono stati verificati sulla fonte;
- provenienza e coordinate sono presenti;
- raw, normalizzato e canonico sono tracciabili;
- date e stato normativo sono coerenti;
- riferimenti e asset risolvono;
- hash sono reali;
- review richiesta è conclusa;
- output derivati sono stati rigenerati;
- tutti i test applicabili sono verdi.

### Per mapping NTC ↔ Circolare

Un mapping è completato solo se:

- entrambi gli endpoint esistono e sono versionati;
- il tipo di relazione è esplicito;
- esiste evidence testuale o una motivazione redazionale;
- ambiguità e cardinalità sono dichiarate;
- il mapping è revisionato;
- i backlink vengono generati.

### Per mapping norma ↔ codice

Un mapping è completato solo se:

- indica una versione o commit esatto;
- risolve modulo ed export;
- descrive il tipo e il limite della relazione;
- punta alle unità normative effettivamente rilevanti;
- possiede almeno un contract test o un'eccezione motivata;
- è revisionato sul piano software e di dominio.

### Per release

Una release è completata solo se:

- build e generatori partono da fonti bloccate;
- manifest, hash e report sono inclusi;
- tutti i gate obbligatori sono verdi;
- copertura e limiti noti sono pubblicati;
- audit indipendente concluso;
- procedura di supersessione e rollback verificata.

## 11. Metriche da pubblicare

Le metriche devono distinguere quantità, qualità e affidabilità:

- unità attese, estratte, source-checked, double-reviewed e published;
- copertura per atto, capitolo e tipo di nodo;
- riferimenti totali, risolti, esterni e pendenti;
- asset attesi, presenti e verificati;
- percentuale di blocchi con evidence di regione;
- modifiche di normalizzazione per categoria;
- errori trovati per lotto e per revisore;
- mapping proposti, confermati, respinti e obsoleti;
- riproducibilità della build;
- copertura dei contract test con `structural-checks-ts`;
- accuratezza di retrieval e citazione nei benchmark LLM.

Il numero di file o di righe non deve essere utilizzato come indicatore primario di completamento.

## 12. Rischi principali e contromisure

| Rischio | Effetto | Contromisura |
|---|---|---|
| Correggere il legacy anziché rifondare il modello | Debito permanente e falsa affidabilità | Legacy in sola migrazione, pilota sul canonico v2 |
| OCR o parsing silenziosamente errato | Numeri e formule falsi | Evidence visuale, diff, doppia revisione |
| Schema troppo ambizioso | Blocco progettuale | Set minimo testato sul pilota, evoluzione versionata |
| Schema troppo povero | Perdita di provenienza e temporalità | Gate contrattuali e casi reali complessi |
| Mapping automatici per numerazione | Collegamenti plausibili ma falsi | Relazioni tipizzate, evidence e review |
| Dipendenza instabile da `structural-checks-ts` | Link rotti a ogni refactor | Mapping a export/versione e contract test |
| Output LLM non distinguono le fonti | Risposte autorevoli ma scorrette | Metadata obbligatori e benchmark negativi |
| Revisione concentrata in una sola persona | Bias e mancata rilevazione degli errori | Separazione dei ruoli e audit indipendente |
| Fonte istituzionale rimossa o sostituita | Impossibilità di ricostruire la release | Originali hashati, manifest e mirror documentati |
| Pressione a dichiarare completezza | Pubblicazione prematura | Gate automatici e stati pubblici di copertura |

## 13. Decisioni ratificate

1. JSON come fonte canonica e MDX come derivato: ADR 0002.
2. Modello `work`/`expression`/`manifestation`: registro fonti v2.
3. ID e alias: ADR 0003; namespace pubblico `urn:structural-codes:it`.
4. Perimetro e D.M. 9 marzo 2023: `docs/perimetro-normativo.md`.
5. Evidence a livello di regione per ogni blocco da `source-checked`: ADR 0004.
6. Due atti di review umana, fonte e tecnica/normativa; una persona qualificata
   può firmarli entrambi, con identità conservata solo nell'audit interno.
7. Il mapping con `structural-checks-ts` sarà un manifest versionato con
   contract test bilaterali.
8. Licenza `LGPL-2.1-or-later`; nessun gate legale richiesto dal proprietario.
9. Il pilot iniziale comprende integralmente NTC §3.3 e Circolare C3.3,
   incluse formule, tabelle e figure.
10. Il repository è pubblico anche durante lo sviluppo; quarantena e stato
    canonico restano distinti.

Le decisioni sono registrate negli ADR 0001–0006 e possono essere modificate
tramite normale revisione del repository.
