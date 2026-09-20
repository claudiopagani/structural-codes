# ChatNTC — STEP 3: UI standalone e contesto corrente

Lo [STEP 5](chatntc-byok.md) aggiunge Impostazioni AI solo nello standalone locale,
senza cambiare il contratto ChatTransport del pannello condiviso.

Lo [STEP 4](chatntc-history.md) aggiunge la cronologia IndexedDB opt-in allo
standalone attraverso `ChatNTCHistoryPanel`. Le indicazioni sulla memoria
transitoria qui sotto descrivono il pannello base dello STEP 3, ancora riusabile
senza storage.

## Component tree e dipendenze

```text
Home (server, flag chatNTCEnabled)
└─ ComparisonViewer (standalone)
   ├─ LocalChatTransport → POST /api/chatntc
   └─ NormativeViewer
      ├─ indice / testo / strumenti di citazione esistenti
      └─ auxiliaryPanel → ViewerToolsDock
         ├─ ChatNTCPanel → ChatTransport
         └─ OfficialPdfPanel (locale/debug, PDF su richiesta)
```

`NormativeViewer` non importa ChatNTC, provider o trasporti. Il dock vive in
`viewer/app`; il pannello riusabile e il contratto sono in
`viewer/shared/chatntc-ui`. L'entry point opt-in
`structural-codes-viewer/chatntc-ui` esporta pannello, tipi ed errore pubblico.
Il package non contiene `LocalChatTransport`, route o adapter AI. Importare o
montare il viewer/pannello non avvia chiamate AI.

## UX

- Il pulsante **Apri ChatNTC e strumenti** apre il dock. La chiusura restituisce
  il focus al pulsante; riaprire conserva bozza e messaggi in memoria.
- Le schede **ChatNTC** e **PDF ufficiale** convivono quando il PDF è abilitato.
  Frecce sinistra/destra, Home ed End navigano le schede. Il PDF conserva il suo
  consenso esplicito al caricamento; cambiare scheda conserva la chat.
- **Nuova chat** svuota messaggi, bozza e contesto conversazionale e annulla
  l'eventuale richiesta. Il reload della pagina azzera la chat.
- Il testo multilinea si invia con **Invia** o Ctrl/⌘+Invio. Invio semplice
  resta un ritorno a capo. `/` nel textarea non attiva la ricerca normativa.
- Per default la domanda è generica. **Usa il paragrafo corrente** abilita il
  contesto visualizzato sotto il controllo. **Spiegami questo paragrafo**
  prepara la bozza e seleziona quel contesto, senza inviare nulla.
- **Interrompi** annulla via AbortSignal; risultati tardivi vengono ignorati.
  Chiudere il dock o cambiare scheda lascia proseguire la richiesta. Smontare
  il pannello la annulla. Non è implementato streaming: appare uno stato di attesa.
- Ogni risposta mostra classificazione, fonti cliccabili, eventuale necessità
  di altre evidence e dettagli sui limiti/stati editoriali. Il testo è reso
  come testo React, senza eseguire HTML o URL forniti dal modello.
- Gli errori sono leggibili e la domanda fallita ritorna nella bozza. Nessuna
  risposta scartata dal validator viene visualizzata.
- Il dock usa i colori del viewer e la modalità scura. Su desktop affianca il
  testo; sotto 1120px si dispone sotto il viewer. Con strumenti su mobile il
  testo normativo resta in un pannello a scroll delimitato.

## API pubblica: sole aggiunte

`NormativeViewerProps` conserva le props esistenti e aggiunge:

```ts
auxiliaryPanelModes?: readonly ViewerMode[];
auxiliaryPanelKeepMounted?: boolean;
```

Senza queste opzioni, l'auxiliary panel resta disponibile solo nelle modalità
NTC/Circolare separate e viene montato solo quando visibile. Lo standalone con
ChatNTC abilita anche `combined` e mantiene montato il dock nascosto per
conservarne lo stato transitorio. Non cambia il default degli altri consumer.

`AuxiliaryPanelContext` aggiunge campi opzionali:

```ts
currentUnit?: { documentId: DocumentId; unitId: string; numbering: string } | null;
selectedTarget?: ViewerTarget | null;
navigateTo?: (target: ViewerTarget) => Promise<void>;
hrefForTarget?: (target: ViewerTarget) => string;
close?: () => void;
```

L'unità viene dagli indici già caricati e segue navigazione/scroll. La selezione
di un passaggio o asset ha precedenza finché resta corrente; una nuova
navigazione/nuova unità visibile elimina la selezione precedente. In modalità
combinata può identificare anche un passaggio della Circolare.

Le citazioni usano `viewerTargetForCitation`, `urlForViewerTarget` e la stessa
`navigateViewerTarget` usata da rimandi e history del viewer, inclusi caricamento
lazy, cambio documento, blocchi e asset. Non viene introdotto un router ChatNTC.

## Contratto di trasporto

```ts
interface ChatTransport {
  readonly capabilities: { readonly cancellation: boolean; readonly streaming: false };
  send(request: ChatRequest, options?: { signal?: AbortSignal }): Promise<ChatResult>;
}
interface ChatRequest {
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  context?: {
    documentId: "ntc2018" | "circ2019";
    unitId: string;
    numbering: string;
    blockId?: string;
    assetId?: string;
  };
}
```

`ChatResult` è l'envelope validato dello STEP 2: risposta, citazioni, metadati
evidence, generazione e `validation.valid: true`. Il transport garantisce la
validazione canonica sul server; il client locale controlla anche forma,
package ID e coerenza del catalogo citazioni prima del rendering.

`LocalChatTransport` invia JSON a `/api/chatntc`, senza credenziali AI. Gli errori
upstream sono mappati a messaggi fissi, senza mostrare body/stack arbitrari.
Un futuro trasporto hosted implementerà lo stesso contratto; non è incluso qui.

Lo storico contiene solo le ultime tre coppie complete entro i limiti HTTP
(2000 caratteri per messaggio, 8000 totali). Le coppie troppo lunghe non vengono
troncate: si usa solo il suffisso recente che rientra nei limiti. Le richieste
fallite o interrotte non entrano nel contesto conversazionale. Nessun salvataggio
in localStorage, IndexedDB o server; la preferenza tema del viewer è preesistente.

## Contesto e retrieval

La route accetta `context` opzionale; rifiuta campi aggiuntivi, chunk/testo,
documenti o ID non validi. Il retrieval controlla documento, numbering e
appartenenza di blocco/asset all'unità canonica. Errori di contesto producono
`400 INVALID_CONTEXT`, senza chiamare il provider.

Il contesto aggiunge un candidato primario con motivo `viewer-context`, entro
i budget esistenti. La ricerca della domanda resta attiva e non viene filtrata
al documento corrente. Contesto, motivi e selezione entrano nel fingerprint del
pacchetto; il modello riceve solo l'evidence recuperata e ridotta dal server.
Non vengono riscritte automaticamente le domande di follow-up.

## Abilitazione

La pagina server usa lo stesso `chatNTCEnabled` della route: è necessario
`CHATNTC_ENABLED=true` e sviluppo/test oppure `CHATNTC_DEBUG=true`. Al browser
arriva solo un booleano. Non serve un secondo flag `NEXT_PUBLIC_` per ChatNTC.
Per generare risposte resta necessaria la configurazione server DeepSeek dello
[STEP 2](chatntc-server.md). La UI non offre impostazioni di chiave o provider.
Il flag rende visibile la feature anche se manca la configurazione del provider:
in tal caso l'invio restituisce l'errore previsto.

Il PDF continua a usare il gate già esistente (`NODE_ENV` / `NEXT_PUBLIC_VIEWER_DEBUG_PDF`).
Le istanze pubbliche devono lasciare ChatNTC disabilitato; resta applicato il
controllo locale/origin della route dello STEP 2.

## Test e limiti dello step

`npm --prefix viewer run test:chatntc-ui` esegue interazioni DOM sui componenti
reali con React, jsdom (solo devDependency) e trasporti simulati. Un piccolo
bundle Vite di test, ignorato da Git, evita modifiche alla risoluzione moduli
del package. La suite entra anche in `npm run viewer:test`.

Le suite server/route coprono contesto canonico, ricerca indipendente, citazioni,
flag server, segreti esclusi dal browser e nessuna chiamata al render. Le prove
visive usano il build standalone, con provider deliberatamente non configurato.
Nessuna prova chiama realmente DeepSeek.

Restano fuori da questo step persistenza, IndexedDB, BYOK, altri provider,
streaming e web search. Per lo STEP 4 il pannello conserva confini chiari
tra turni transitori, trasporto e navigazione; eventuale persistenza richiederà
un progetto esplicito di schema/versionamento e gestione della cancellazione.
La qualità semantica delle risposte richiede valutazione separata: la validazione
deterministica continua a controllare integrità, provenienza e copertura dichiarata.
