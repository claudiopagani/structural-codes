# ADR 0006 — Figure ufficiali e derivati migliorati

- Stato: accettata
- Data: 2026-07-26
- Ambito: asset del corpus

## Contesto

Alcune figure delle manifestazioni pubblicate in Gazzetta Ufficiale sono poco
leggibili e possono derivare da altri documenti tecnici, per esempio documenti
CNR. Sostituirle direttamente renderebbe però impossibile distinguere la fonte
ufficiale dal materiale editoriale.

## Decisione

- Il crop della manifestazione ufficiale resta sempre l'asset primario, anche
  quando è poco leggibile.
- Un ridisegno, un miglioramento grafico o un'immagine proveniente da un'altra
  fonte è un asset derivato distinto e non sovrascrive mai l'originale.
- L'asset derivato deve dichiarare `origin: editorial`, provenienza, versione,
  pagina, trasformazioni, licenza o condizioni di riuso e relazione con
  l'asset ufficiale.
- Un documento CNR o altra fonte tecnica deve essere registrato come fonte
  separata prima dell'uso. La sola somiglianza visiva non prova identità o
  equivalenza.
- Se provenienza o contenuto non sono univoci, l'asset derivato resta bloccato
  e il corpus espone soltanto il crop ufficiale con una nota di leggibilità.

## Conseguenze

Il corpus usa come asset primari esclusivamente le manifestazioni ufficiali.
Eventuali alternative future saranno esplicite e cross-verificabili, non
correzioni silenziose.
