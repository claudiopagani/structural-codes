# Pipeline evidence v2

Stato: implementazione iniziale della Fase 3, non ancora autorizzata a
promuovere record canonici.

## Acquisizione

Il registro `sources/registry/sources.v2.json` contiene URL, byte attesi,
SHA-256 e numero di pagine. La modalità predefinita è offline:

```bash
npm run acquire:v2 -- --source gu-so8-2018-ntc
npm run acquire:v2 -- --source gu-so8-2018-ntc --download
```

Se il file locale esiste, viene sempre verificato e non viene sovrascritto.
`--download` opera soltanto quando manca, usa un file temporaneo e lo rende
visibile al percorso definitivo solo dopo verifica di byte e hash.

## Estrazione con coordinate

```bash
npm run extract:evidence -- --source gu-so8-2018-ntc --pages 58-58
```

Per ogni pagina vengono conservati ordine degli item PDF, testo, font,
trasformazione e bounding box in punti PDF con origine in alto a sinistra.
Sono calcolati hash JCS/SHA-256 del record, degli item e del testo raw.

L'estrattore segnala, senza correggerli:

- caratteri di controllo o di sostituzione;
- soft hyphen e sillabazioni a fine riga;
- testo ruotato;
- candidati intestazione e piè di pagina;
- eventuale numero di pagina stampato.

`manifest.json` è deterministico e ha un `contentFingerprint`.
`last-run.json` registra separatamente timestamp, Node, sistema e
architettura, così due esecuzioni possono essere confrontate sul contenuto
senza mascherare il contesto di esecuzione.

## Rendering

```bash
npm run render:evidence -- --source gu-so8-2018-ntc --page 58 --scale 2
npm run render:evidence -- --source gu-so8-2018-ntc --page 58 \
  --region 60,120,470,40 --scale 3
```

Il comando produce PNG e sidecar JSON con fonte, pagina, regione, scala e
SHA-256. Le coordinate sono le stesse dell'evidence estratta.

## Output

`raw-sources/`, `extracted/` ed `evidence/` sono ignorate da Git. I loro hash
e le fixture minime necessarie alla regressione sono versionati. Nessun testo
estratto entra automaticamente in `corpus/`.

Il frontmatter del corpus legacy è ora letto da un parser YAML standard in
modalità stretta. Le righe separate da `;` prodotte nella conversione
precedente non sono YAML valido e vengono segnalate, non reinterpretate per
euristica. Il body MDX legacy resta in quarantena e non appartiene alla
pipeline canonica JSON.
