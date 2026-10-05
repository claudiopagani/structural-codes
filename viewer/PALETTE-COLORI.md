# Palette colori del viewer

Questa pagina raccoglie i colori di interfaccia riutilizzati nel viewer e il
loro scopo. La definizione operativa dei token è in
[`shared/styles.css`](./shared/styles.css); quando cambia un colore condiviso,
aggiornare anche questa lista.

## Colori condivisi

| Colore | Token | Uso |
| --- | --- | --- |
| `#4F74BF` | `--scv-button-emphasis-bg` | Fondo dei pulsanti selezionati, in hover, focus o pressione; linee verticali dell’indice; sfondo dei titoli/intestazioni delle tabelle normative. |
| `#4F74BF` | `--scv-primary` | Blu primario condiviso con i pulsanti selezionati; usato per indicatori di focus, collegamenti, selezioni di testo e icone principali nel tema chiaro. |
| `#293B82` | `--scv-primary-dark` | Blu più scuro per testi e controlli che richiedono maggiore enfasi. |
| `#E8ECFB` | `--scv-primary-soft` | Fondo blu tenue per superfici secondarie e azioni contestuali. |
| `#20242C` | `--scv-ink` | Testo principale nel tema chiaro. |
| `#69717E` | `--scv-ink-soft` | Etichette, date e testo secondario nel tema chiaro. |
| `#F6F7FB` | `--scv-paper` | Fondo generale della pagina nel tema chiaro. |
| `#FFFFFF` | `--scv-panel` | Pannelli, menu e superfici chiare. |
| `#D9DEEA` | `--scv-line` | Separazioni e bordi neutri nel tema chiaro. |
| `#C92F3B` | `--scv-danger` | Stato di errore o azione distruttiva. I pulsanti elimina mantengono inoltre i propri toni dedicati. |
| `#F0F3FB` | `--scv-circular` | Fondo informativo per i contenuti della Circolare. |
| `#9A671E` / `#FFF3D8` | `--scv-amber` / `--scv-amber-soft` | Accenti e superfici di avviso nel tema chiaro. |
| `#C7353F` | `--scv-bookmark` | Indicatore cromatico dei segnalibri. |
| `#D39A16` | `--scv-note` | Indicatore cromatico delle note. |

## Tema scuro

| Colore | Uso |
| --- | --- |
| `#10141E` | Fondo generale. |
| `#1B2130` | Pannelli e superfici principali. |
| `#EDF1FB` / `#AEB8CA` | Testo principale e secondario. |
| `#354057` | Separazioni neutre. |
| `#C4D0FF` / `#29365E` | Accenti primari e loro fondo tenue. |
| `#FF707A` | Stato di errore e azione distruttiva. |
| `#20283B` | Fondo informativo della Circolare. |
| `#F0C976` / `#49371F` | Accenti e superfici di avviso. |
| `#FF6973` | Indicatore dei segnalibri. |
| `#FFD15C` | Indicatore delle note. |

## Colori dedicati ai componenti

| Colore | Uso |
| --- | --- |
| `#8FBFFA` / `#2859C5` | Riempimenti base delle icone SVG fornite. |
| `#F9FBFF` / `#CCDCF5` | Variante chiara dei riempimenti SVG su fondi scuri o evidenziati. |
| `#F2B9BE` / `#BC626C` | Variante pastello delle icone elimina. Al passaggio del puntatore diventano `#FFF7F7` / `#F5D9DC`. |
| `#A84F59` / `#F0C9CD` | Testo e bordo rossi dei pulsanti elimina; il fondo neutro della card resta `#FAFAFA`. |
| `#BD6670` | Fondo del pulsante elimina al passaggio del puntatore. |
| `#3E8D68` / `#A64B43` | Conferma ed errore dell’azione Copia. |
| `#0B57B7` | Collegamenti ai riferimenti normativi quando sono attivi o in focus. |
| `#C7CCDA` / `#4B566E` | Griglia delle tabelle nel tema chiaro e scuro. |
| `#FBFCFF` / `#F1F3F9` | Celle standard e righe alternate delle tabelle nel tema chiaro. |
| `#202738` / `#293146` | Celle standard e righe alternate delle tabelle nel tema scuro. |
| `#D9D9D9` | Celle con evidenziazione grigia nelle tabelle. |
| `#2A3039` / `#E0E6F2` | Colore del testo nelle celle delle tabelle nel tema chiaro e scuro; resta indipendente dal colore di sfondo delle celle. |
| `#FFF0A8` / `#FFF4BD` | Evidenziazione della ricerca e del contenuto raggiunto nel tema chiaro. |
| `#766224` / `#514821` | Fondi delle evidenziazioni di ricerca nel tema scuro. |
| `#FAFAFA` | Fondo neutro dei pulsanti e dei controlli chiari. |

Ombre e sovrapposizioni usano anche colori neri o bianchi con opacità: sono
effetti di profondità e non colori di superficie della palette.
