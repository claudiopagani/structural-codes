# Schemi canonici

`corpus-v2.schema.json` è il contratto JSON Schema Draft 2020-12 per una
unità normativa canonica. La versione corrente è `2.0.0-alpha.2`: il corpus è
pubblico come lavoro editoriale, ma non è ancora una release normativa
approvata.

La validazione ha due livelli:

1. JSON Schema, eseguito con AJV in modalità stretta;
2. vincoli semantici e referenziali, eseguiti da
   `scripts/validate-corpus-v2.ts`.

Eseguire:

```bash
npm run validate:corpus
```

I record reali andranno sotto `corpus/`; le fixture contrattuali sono in
`fixtures/corpus-v2/`. MDX, Markdown e JSONL non sono fonti canoniche.
