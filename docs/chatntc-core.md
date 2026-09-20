# ChatNTC Core — STEP 1

Questo documento descrive il perimetro originario dello STEP 1. Il contratto
provider, le direttive centralizzate e la pipeline locale aggiunti nello STEP 2
sono documentati in [ChatNTC server](chatntc-server.md).

Core normativo provider-agnostic, senza React, trasporto HTTP, cronologia o
chiamate AI. `structural-codes` rimane la source of truth; il PDF ufficiale
registrato rimane l'autorità editoriale. Questo step non modifica contenuti
canonici, stati di review, generatori editoriali o OCFEM.

## Architettura e file

```text
Consumer futuro (standalone viewer / OCFEM / test)
  ├─ retrieveChatNTCEvidence(repository, question, options)
  │    └─ ChatNTCRepository
  ├─ ChatNTCEvidencePackage → futuro produttore di ChatNTCResponse
  └─ validateChatNTCResponse(unknown, evidence, repository)
       └─ integrità, provenienza e copertura dichiarata claim → citation

Adapter degli artefatti → ChatNTCRepository
  ├─ corpusData: loader/cache JSON, parseNormativeReference, document lookup
  ├─ searchEngine: stesso indice full-text e stesso ranking del viewer
  └─ crossReferences: stesso indice, riconoscimento e risoluzione dei rimandi
```

La collocazione `viewer/shared/chatntc/` consente di usare i moduli già
distribuiti nel package viewer. Gli entry point sono separati dalla UI:

- `structural-codes-viewer/chatntc`: contratti, policy, retrieval, validator e
  helper delle citazioni; il grafo degli import runtime non contiene React,
  DOM, `fetch` o provider.
- `structural-codes-viewer/chatntc/viewer-artifacts`: adapter opzionale,
  con loader iniettabili oppure i loader/cache già presenti in `corpusData`.

Non serve un nuovo workspace. Il package viewer mantiene le sue peer
dependencies React; il core esportato non le importa. Un backend OCFEM potrà
implementare `ChatNTCRepository` senza importare l'adapter degli artefatti.

| File | Responsabilità |
| --- | --- |
| `types.ts` | Interfaccia repository e contratti Evidence Package/risposta v1 |
| `policy.ts` | Principi epistemici e limiti predefiniti |
| `viewerArtifacts.ts` | Adapter degli indici e del caricamento esistenti |
| `retrieval.ts` | Ranking, espansione a un livello e selezione entro budget |
| `evidence.ts` | Proiezione dei dati, identificazione SHA-256 e target citazioni |
| `validation.ts` | Controllo runtime della risposta e validazione deterministica |
| `index.ts` | API pubblica del core |

`viewer/shared/corpusData.ts` descrive anche i metadati già presenti negli
artefatti: proprietario asset, numero di colonne, hash figura, review e blocchi
di evidence delle relazioni. I nuovi campi sono opzionali per compatibilità con
i precedenti consumer. Nessun cambiamento al formato degli artefatti.

## Uso senza provider

```ts
import {
  retrieveChatNTCEvidence,
  validateChatNTCResponse,
  citationForEvidence,
  type ChatNTCResponse,
} from "structural-codes-viewer/chatntc";
import {
  createViewerArtifactRepository,
} from "structural-codes-viewer/chatntc/viewer-artifacts";

const repository = createViewerArtifactRepository("/data/codes");
const evidence = await retrieveChatNTCEvidence(repository, "§7.3.6.1");

// Costruzione deterministica di una citazione. Qui non si genera una risposta.
const first = evidence.primaryUnits[0];
const citation = first ? citationForEvidence(evidence, first.evidenceId) : null;

// Il futuro adapter provider restituisce unknown; non deve fornire il pacchetto.
async function acceptCandidate(candidate: unknown) {
  const validation = await validateChatNTCResponse(candidate, evidence, repository);
  if (!validation.valid) return validation;
  return candidate as ChatNTCResponse;
}
```

In Node, fornire una base URL assoluta all'adapter viewer oppure usare
`createArtifactRepository(loader)` con un loader da file. Il core usa Web Crypto
per SHA-256 (disponibile nei browser moderni e nella versione Node del progetto).
I permalink riusano `viewerTargetForCitation` e il contratto `ViewerTarget` di
`permalinks.ts`; la base URL e la modalità di navigazione spettano al consumer.

## Retrieval

1. Riferimento esatto: `7.3.6.1` e `§7.3.6.1` risolvono NTC per default;
   `C7.3.6.1` risolve la Circolare. `document` può limitare la ricerca a un
   documento. Un riferimento esatto assente non viene sostituito con risultati
   simili. `resolveExact` distingue `null` (sintassi non esatta) da `[]`
   (riferimento riconosciuto ma non disponibile).
2. Tabelle, formule e figure usano il riconoscitore e i target già presenti
   nell'indice dei rimandi: ad esempio `Tab. 7.3.III`, `formula [7.3.4]`,
   `Fig. 7.3.1`. Questo indice contiene solo gli asset numerati richiamati nel
   testo. Gli altri asset restano raggiungibili tramite la loro unità.
3. Una domanda testuale può fornire fino a 12 riferimenti riconosciuti; questi
   precedono i risultati full-text del motore esistente. Nessun embedding o
   indice persistente aggiuntivo. A parità di score si usa l'ID canonico.
4. Le unità primarie selezionate vengono espanse una sola volta: relazioni
   esplicite confermate, proposte, rimandi uscenti, rimandi entranti, parent e
   children. I children sono utili per lookup esatti o unità contenenti solo
   intestazioni. Il budget li limita separatamente.
5. Le relazioni `rejected` sono escluse. Le `proposed` sono incluse per default
   con stato originale e warning, disattivabili con
   `includeProposedRelations: false`. La loro presenza non dimostra equivalenza
   semantica. I suggerimenti diagnostici per numerazione coincidente non vengono
   caricati. Le relazioni esplicite sono percorse in entrambe le direzioni.
6. Unità ripetute si fondono conservando le ragioni del recupero. Blocchi e asset
   selezionati restano nell'ordine del corpus. Target mancanti o incoerenti negli
   indici generano un errore: non si produce evidence inventata.

Limiti predefiniti: 3 unità primarie, 5 correlate, 2 children per unità;
48.000 caratteri totali e 16.000 per unità. Il conteggio è la lunghezza UTF-16
delle unità evidence serializzate, inclusi metadati, LaTeX e tabelle. Non è un
conteggio di token e non include domanda, manifest sintetico o envelope.
I limiti sono configurabili e validati; `maxRelatedUnits: 0` disabilita
l'espansione. I filtri non promuovono lo stato editoriale.

Se un'unità supera il budget, i blocchi richiesti esplicitamente hanno priorità;
gli altri sono ordinati per termini della domanda, poi posizione. Nessun testo,
formula o tabella viene troncato. Il pacchetto dichiara blocchi omessi,
`selection.complete`, `retrieval.reduced` e warning. Una tabella troppo grande
viene omessa integralmente. L'ordine finale dei blocchi segue sempre la fonte.
La selezione può omettere contesto necessario: il consumer deve considerare i
warning e può richiedere più evidence o astenersi.

## Evidence Package v1

- Domanda originale, policy versionata e `packageId` SHA-256 dell'intero
  contenuto, con chiavi oggetto ordinate e array nell'ordine selezionato.
- Versione e fingerprint del corpus e degli artefatti; disclaimer, stato,
  fonte ufficiale, URL di pubblicazione e hash PDF per ciascun documento.
- Unità primarie/correlate: ID, documento, numbering ufficiale, titolo,
  validità, stato di verifica e provenance disponibile.
- Blocchi: ID, tipo e origine; testo normalizzato con segmenti inline;
  asset strutturati; pagina PDF, regione e hash normalized quando disponibili.
- Formule complete in LaTeX; tabelle con celle unite, matematica e note;
  figure con caption, percorso e hash disponibili, marcate `metadata-only`.
  Non viene verificato o descritto automaticamente il contenuto dei pixel.

Le identità di evidence sono gli ID canonici di unità/blocco. La citazione di
unità copre esclusivamente i blocchi selezionati. Per un asset, la citazione
include evidence ID del blocco, blockId, assetId e numero ufficiale dell'asset
(anche `null` per formule non numerate). Il numbering dell'unità resta separato.
Non vengono copiati raw, identità degli autori/revisori, tutti i chunk o indici.
Il pacchetto restituito è separato dagli oggetti nella cache del corpus.

Ogni repository rappresenta uno snapshot immutabile. L'adapter verifica la
coerenza dei fingerprint dichiarati fra manifest e chunk, e l'identità delle
unità rispetto all'indice. Riusa la cache JSON per URL del viewer: quando cambia
lo snapshot, il consumer deve usare URL versionati o una nuova sessione. Questo
step non aggiunge autenticazione del trasporto né ricalcolo dell'hash dei byte
di ogni download. Il fingerprint identifica uno snapshot; non è una firma.

## Contratto della risposta e policy

Il provider produce il wire format v2 minimale (`answerMarkdown` e riferimenti
testuali). Il server pubblica `ChatNTCResponse` v3: la risposta tecnica è
separata dai `verifiedReferences`, che vengono risolti dopo la generazione
contro l'intero repository. Le risposte v1/v2 restano leggibili solo per la
history.

`ChatNTCVerifiedReference` contiene `unitId`, documento, numbering, `kind` e gli
eventuali `blockId`, `assetId` e `assetNumber`. Non contiene `evidenceId`: un
target canonico verificato non deve essere stato selezionato dall'Evidence
Package iniziale. Forme testuali equivalenti sono deduplicate sul target
canonico.

| Classificazione | Regola dichiarativa |
| --- | --- |
| `direct-reference` | Claim con citazioni a evidence selezionata |
| `combined-reference` | Almeno due evidence distinte utilizzate |
| `interpretation` | Interpretazione esplicita con evidence; non prescrizione |
| `no-direct-reference` | La conclusione non è formulata direttamente dalla norma; può comunque essere risposta con evidence correlata |
| `external-source` | Tipo riservato; validazione rifiutata nello STEP 1 |

Lo `status` ortogonale vale `answered`, `partial` o `abstained`. Solo
`abstained` impone claim/citazioni vuoti e `needsMoreEvidence: true`; una
risposta `no-direct-reference` può quindi essere utile e citata. Le risposte v1
salvate nella history restano leggibili. Le stesse classificazioni sono
disponibili per i claim. Un claim interpretativo
richiede che la risposta dichiari `interpretation`. La policy immutabile
`CHATNTC_EPISTEMIC_POLICY` stabilisce: fonte normativa nel corpus, memoria del
modello esclusa dalle fonti, distinzione NTC/Circolare, distinzione fra
interpretazione e prescrizione, possibilità di astensione e divieto di citazioni
inventate. Non è un prompt legato a un provider.

`externalResearchSuggested: true` è solo un'indicazione; non avvia ricerche e
non abilita fonti esterne.

## Validatore deterministico

Accetta la risposta come `unknown`, rifiuta forme malformate, campi extra e
classificazioni sconosciute. Il pacchetto viene fornito dall'applicazione.
Controlla:

- ID del pacchetto, policy e corrispondenza dello snapshot al repository;
- metadati, contenuti selezionati, provenienza e copertura dei blocchi rispetto
  al repository canonico;
- unità, blocchi e asset esistenti e appartenenti al target dichiarato;
- per v3, documento/numbering canonici, tipo e numero ufficiale dell'asset,
  indipendentemente dall'evidence iniziale;
- duplicati di evidence, asset, claim e citazioni nello stesso claim;
- uguaglianza tra `usedEvidenceIds` e insieme delle citazioni dei claim;
- presenza di citazioni per i claim che le richiedono;
- rimandi riconosciuti nella prosa di answer/claim associati a citazioni valide;
- risoluzione dei riferimenti v3 contro tutto il repository e corrispondenza
  fra menzioni residue e target verificati.

Un riferimento canonico reale fuori evidence viene verificato direttamente.
Un riferimento inesistente o ambiguo attiva al massimo un repair del provider;
se resta non verificabile viene rimossa soltanto la frase che contiene la falsa
attribuzione. La risposta tecnica residua resta visibile con un warning neutro.
Solo errori di lettura/integrità del repository fanno fallire la richiesta.

Una validazione positiva **non dimostra** che le fonti sostengano semanticamente
le frasi o che tutti i contenuti di `answer` siano stati dichiarati come claim.
Non certifica la fedeltà al PDF, non approva il corpus e non chiude issue.

## Verifiche

```sh
npm --prefix viewer run test:chatntc
npm run check
npm run viewer:test
npm --prefix viewer run typecheck
npm --prefix viewer run lint
```

I test mirati includono fixture esplicitamente sintetiche, artefatti reali e
import dei due entry point compilati. Gli indici delle fixture vengono costruiti
con i builder esistenti; non diventano dati canonici. Il comando mirato rigenera
gli artefatti con la pipeline ordinaria e non li modifica manualmente.

## Debiti intenzionali e preparazione dello STEP 2

- Nessun provider, SDK, chiamata LLM, API key, UI, cronologia o ricerca esterna.
- Nessuna modifica a OCFEM: è pronta l'interfaccia repository da implementare.
- Nessun embedding, reranker semantico o conteggio token specifico di un modello.
- Retrieval a un solo livello, selezione lessicale entro budget e warning
  espliciti; nessuna garanzia automatica di sufficienza semantica.
- Figure solo come metadati e nessun nuovo inventario degli asset oltre gli
  indici già disponibili.
- Nessun nuovo worker: il futuro host può spostare il core su worker/backend.
- I contratti v1 sono TypeScript con validazione runtime della risposta;
  eventuali schemi di output richiesti da un provider saranno adapter separati.

Per lo STEP 2 sono pronti gli input evidence deterministici, il contratto di
output indipendente dal provider, gli helper per citazioni e il gate di
validazione. L'integrazione futura dovrà mantenere il pacchetto originale
dell'applicazione e validare ogni risposta contro lo stesso repository/snapshot.
Lo STEP 2 non è implementato qui.
