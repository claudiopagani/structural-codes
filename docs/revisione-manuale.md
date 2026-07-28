# Revisione diretta del corpus canonico

Il visualizzatore è esclusivamente in sola lettura. La redazione normativa si
fa direttamente nei file JSON di `corpus/units/`, confrontandoli con il PDF
ufficiale aperto separatamente.

## Primo perimetro: § 4.1

- NTC 2018: `corpus/units/ntc2018/4.1*.json`;
- Circolare 7/2019: `corpus/units/circ2019/c4.1*.json`.

Le fonti PDF locali sono:

- `raw-sources/ntc2018/gu-42-so8-2018-02-20.pdf`;
- `raw-sources/circ2019/circolare-7-2019.pdf`.

L'evidence estratta è in:

- `evidence/gu-so8-2018-ntc/`;
- `evidence/circ-7-2019/`.

Il payload `viewer/public/data/corpus.json` è un derivato rigenerabile. La fonte
editoriale resta sempre il record in `corpus/units/`.

## Procedura per ogni blocco

1. Aprire nel visualizzatore l'unità da controllare.
2. Aprire il file JSON corrispondente in `corpus/units/<documento>/`.
3. Usare `blocks[].evidence.pdfPage` per raggiungere la pagina del PDF.
4. Confrontare `blocks[].text.normalized` con la fonte ufficiale; consultare
   `blocks[].text.raw` per capire l'origine di glyph o spaziature sospette.
5. Correggere soltanto il testo normalizzato. Il testo raw documenta
   l'estrazione e non va riscritto.
6. Tracciare la correzione in `blocks[].evidence.transformations` e rigenerare
   `normalizedSha256` con gli strumenti del repository.
7. Aggiornare lo stato e le issue di workflow solo quando il controllo richiesto
   è realmente concluso.

## Verifica

Dalla radice del repository:

```bash
npm run validate:corpus
npm run check
npm run viewer:test
```

Per aggiornare il visualizzatore durante la redazione:

```bash
npm --prefix viewer run sync:corpus
npm run viewer:dev
```

Se si modifica un record mentre il server è già aperto, rieseguire
`npm --prefix viewer run sync:corpus` e ricaricare la pagina. Sul sito
pubblicato occorre invece una nuova build e un nuovo deploy.

I record in `corpus/units/` sono la fonte editoriale: non esiste un secondo
albero da sincronizzare o promuovere.
