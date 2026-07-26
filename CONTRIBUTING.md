# Contribuire a Structural Codes

Apri una issue prima di modificare testo normativo, formule, tabelle, figure,
validità temporale o relazioni tra atti.

Ogni modifica a contenuto ufficiale deve:

1. riferirsi a una fonte registrata in `sources/registry/sources.v2.json`;
2. includere evidence riproducibile fino a pagina e regione PDF;
3. separare testo ufficiale e contenuto editoriale;
4. non ricostruire per plausibilità parti mancanti o poco leggibili;
5. superare `npm run check:v2`;
6. ricevere una review della fonte e una review tecnica o normativa.

Se il contenuto è ambiguo, non scegliere una variante: registra un'issue
bloccante e lascia l'unità in stato non pubblicabile.

Le identità reali dei revisori non devono essere inserite nei file versionati.
Usa l'`actorId` pseudonimo assegnato nel registro di audit interno.
