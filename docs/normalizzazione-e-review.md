# Normalizzazione e review

Stato: policy editoriale corrente.

## Regola fondamentale

`raw` conserva l'estrazione o trascrizione selezionata dall'evidence.
`normalized` può differire soltanto per trasformazioni dichiarate. Il testo
canonico non può essere corretto direttamente senza lasciare raw, hash,
operazione, versione della regola e motivazione.

## Operazioni automatiche ammesse

- `unicode-nfc`: composizione Unicode NFC;
- `normalize-line-endings`: CRLF/CR → LF;
- `normalize-whitespace`: solo NBSP e narrow NBSP → spazio ordinario;
- `remove-control-character`: rimozione dei controlli C0, esclusi tab e LF;
- `remove-discretionary-hyphen`: rimozione esclusiva di U+00AD.

Il profilo automatico non cambia mai cifre, punteggiatura, unità di misura,
apici/pedici, simboli matematici, maiuscole o trattini visibili.

`join-line-wrap`, la rimozione di un trattino visibile e
`manual-correction` richiedono selezione puntuale, nota e review umana. Non
sono eseguite dal comando automatico.

```bash
npm run normalize:text -- --input evidence/circ-7-2019/pages/page-0055.raw.txt \
  --operations unicode-nfc,normalize-line-endings,remove-control-character \
  --note "Rimozione dei controlli PDF rilevati nella pagina"
```

L'output va in `review/normalized/`; non modifica `corpus/`.

## Diff

```bash
npm run review:diff -- --unit fixtures/corpus-v2/circ2019-c3.3.7-relation.valid.json
```

Il report mostra evidence, hash, trasformazioni e diff raw → normalized. I
caratteri di controllo sono resi come `\uNNNN`.

## Gate di stato

```bash
npm run workflow:check -- --unit <record.json> --to source-checked
```

Il comando è di sola lettura. Verifica la transizione immediatamente
successiva e i vincoli del record candidato. Non crea review e non attribuisce
identità umane.

## Checklist del revisore

Il revisore della fonte deve:

1. aprire il PDF ufficiale verificato e il ritaglio della regione;
2. confrontare ogni carattere, numero, simbolo, richiamo e segno;
3. controllare pagina PDF e pagina stampata;
4. verificare gli hash e tutte le trasformazioni;
5. rifiutare ricostruzioni per plausibilità;
6. registrare issue per ogni dubbio, senza colmarlo implicitamente.

Il revisore tecnico o normativo deve inoltre:

1. verificare formule, indici, unità e valori contro l'immagine;
2. controllare target e motivazione di citazioni e relazioni;
3. verificare validità temporale e natura ufficiale/editoriale del legame;
4. essere persona diversa dall'autore e dal revisore della fonte.

Una review automatica è ammessa come controllo aggiuntivo, mai come una delle
due approvazioni umane richieste.

## Audit log

Quando verrà implementata la scrittura delle review, ogni evento dovrà essere
append-only, includere hash del record prima e dopo, identità dichiarata,
ruolo, timestamp, esito e nota. La scrittura è intenzionalmente rinviata
finché non è definito come autenticare i revisori: un semplice nome passato a
CLI non costituisce prova d'identità.
