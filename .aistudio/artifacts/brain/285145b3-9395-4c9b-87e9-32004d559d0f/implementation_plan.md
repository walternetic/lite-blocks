# Lite Blocks: Stima e Diagnostica Memoria in Tempo Reale

Valutazione tecnica dettagliata dell'impronta di memoria nel browser per siti di piccole dimensioni e integrazione nell'app di un sistema di diagnostica combinato (peso dati workspace in RAM + JS Heap di Chromium) con modal analitico apribile con un clic.

> [!IMPORTANT]
> **Decisioni confermate nella fase di chiarimento**:
> - **Metrica combinata**: Visualizzazione integrata che combina l'impronta dati del workspace attivo in RAM (calcolata con precisione in byte tramite serializzazione) e l'impronta complessiva del runtime/heap del browser (tramite le API `performance.memory` dove disponibili).
> - **Accesso alla diagnostica**: Indicatore discreto e minimale nella barra inferiore o nell'area di stato, con apertura su richiesta di un pannello/modal di diagnostica dettagliato (*Memory & Performance Inspector*).

---

## 1. Stima Tecnica dell'Occupazione di Memoria nel Browser

### Scenario di Riferimento:
- **20 pagine**
- **30 blocchi misti** per pagina (totale 600 blocchi: testo, titoli, to-do, codice, callout, citazioni)
- **1 immagine** per pagina (20 immagini totali nel sito)

### A. Livello Dati Piani (JSON / Storage / Payload)
1. **Metadati pagina**: ~250 byte per pagina (ID, titolo, timestamp, icona, stato preferiti).
   - $20 \times 250\text{ B} = 5\text{ KB}$.
2. **Contenuto dei 29 blocchi testuali/strutturati**: media di 150 byte per blocco (tra testo, ID, proprietà).
   - $20 \times 29 \times 150\text{ B} \approx 87\text{ KB}$.
3. **Contenuto blocco immagine**:
   - *Caso A (URL remoti Unsplash/Firebase/CDN)*: ~200 byte per URL $\rightarrow 20 \times 200\text{ B} = 4\text{ KB}$.
     - **Totale JSON dati con URL remoti**: **~96 KB** (estremamente compatto).
   - *Caso B (Data URL Base64 incorporate localmente)*: ~250 KB per immagine compressa $\rightarrow 20 \times 250\text{ KB} = 5\text{ MB}$.
     - **Totale JSON dati con Base64**: **~5.1 MB**.

### B. Livello Runtime JavaScript (V8 Engine Heap)
- **Oggetti JS in RAM**: 20 istanze `Note` + 600 istanze `NoteBlock`.
  - In V8 ogni oggetto ha una forma/classe nascosta (hidden class), prototipo e puntatori alle proprietà (~48–64 byte di overhead base per oggetto oltre al contenuto stringa).
  - L'albero dati puro in memoria heap occupa circa **350 KB – 500 KB** (con URL) oppure **~5.5 MB** (con stringhe Base64 in memoria).
- **Albero React Virtual DOM e Fiber Nodes**:
  - Viene renderizzata nel DOM soltanto la pagina *attualmente aperta* (30 blocchi attivi).
  - I Fiber Nodes di React, gli hook `useState`, i listener sintetici per i 30 blocchi attivi impegnano circa **150 KB – 300 KB** di memoria heap.
  - Le restanti 19 pagine rimangono allo stato di plain JavaScript object array, senza nodi DOM né Fiber associati.

### C. Livello Grafico / Raster del Browser (Decoded Bitmaps)
- **Decodifica immagini in VRAM/Blink**:
  - Un'immagine compressa JPEG/WebP da 200 KB su disco, una volta renderizzata a video (es. risoluzione $1200 \times 800$ pixel a 4 canali RGBA: 32 bit per pixel), occupa in memoria bitmap non compressa:
    $$1200 \times 800 \times 4\text{ byte} = 3.84\text{ MB per immagine renderizzata}$$
  - **Grazie all'architettura a pagina singola attiva**, solo l'immagine della nota visualizzata viene decodificata nel compositor grafico (~3.8 MB). Le immagini delle altre 19 pagine *non* sono montate nel DOM, quindi la GPU e il compositor *non* allocano bitmap per esse.

### D. Impronta Globale della Tab del Browser
| Componente | Memoria Stimata (URL remoti) | Memoria Stimata (Base64 inline) |
| :--- | :--- | :--- |
| **Dati Note & Blocchi in RAM** | ~0.4 MB | ~5.2 MB |
| **React Runtime & Fiber (pagina attiva)** | ~0.3 MB | ~0.3 MB |
| **Immagine decodificata a schermo** | ~3.8 MB | ~3.8 MB |
| **Overhead baseline scheda Chromium** (V8 base, layout engine, CSS) | ~25 – 35 MB | ~25 – 35 MB |
| **Totale JavaScript Heap (`usedJSHeapSize`)** | **~28 – 38 MB** | **~33 – 45 MB** |
| **Processo complessivo scheda OS (RSS Chromium)** | **~75 – 110 MB** | **~85 – 125 MB** |

> **Conclusione**: In presenza di isolamento a partizioni, l'impatto incrementale dei dati del sito è irrisorio (**sotto 1 MB** per testo/URL remoti, oppure **~5 MB** se ci sono immagini base64). La quasi totalità della memoria della tab (~30-80 MB) è costituita dall'infrastruttura del browser (motore Blink, runtime V8, parser Tailwind e canvas grafico).

---

## 2. Fattibilità e Strategia per Riportare la Memoria sull'App

È pienamente possibile riportare la memoria impegnata combinando due sorgenti complementari:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FONTI METRICHE MEMORIA                          │
├───────────────────────────────────┬────────────────────────────────────┤
│   1. DATI APPLICATIVI (Precisa)   │   2. HEAP DEL BROWSER (Sistemica)  │
│  - Calcolo esatto byte in RAM     │  - window.performance.memory       │
│  - Blob(JSON.stringify(notes))    │  - usedJSHeapSize (heap in uso)    │
│  - Conteggio nodi DOM attivi      │  - totalJSHeapSize (heap allocato) │
│  - Quota LocalStorage occupata    │  - jsHeapSizeLimit (limite V8)     │
└───────────────────────────────────┴────────────────────────────────────┘
```

1. **`performance.memory` (Chromium / Edge / Chrome)**:
   - Fornisce in tempo reale `usedJSHeapSize`, `totalJSHeapSize` e `jsHeapSizeLimit`.
   - Se il browser non è Chromium (es. Firefox/Safari, che limitano l'API per policy anti-fingerprinting), l'app mostra un badge di fallback chiaro ("Browser Heap: protetto da policy browser") valorizzando comunque al 100% l'impronta dati e DOM.
2. **Metrica Dati in RAM del Workspace Attivo**:
   - Calcolo esatto tramite `new Blob([JSON.stringify(notes)]).size`: restituisce al byte la dimensione serializzata in UTF-8 del workspace attivo.
   - Scomposizione analitica: dimensione testo, peso allegati/immagini e metadati.
3. **Verifica Isolamento Architetturale**:
   - Confronto istantaneo tra il workspace attivo (in RAM) e gli altri workspace sospesi (0 byte in RAM, residenti solo sul disco/partizione).

---

## 3. Esperienza Utente & Visual Design

### Indicatore Compatto (Bottom Bar della Sidebar)
- Sostituzione/arricchimento discreto nell'area di stato in basso:
  - Chip compatto: `⚡ 142 KB (RAM) · 34 MB (Heap)` o icona tachimetro/chip cliccabile con tooltip esaustivo.
  - Hover con micro-interazione e cursore `pointer` con label *"Apri diagnostica memoria e prestazioni"*.

### Modal Diagnostica Dettagliata ("Diagnostica Memoria & Performance")
- Struttura a sezioni con card analitiche:
  1. **Stato Workspace Attivo in RAM**:
     - Dimensioni totali in byte/KB formattati.
     - Note caricate in memoria e conteggio blocchi.
     - Scomposizione per categoria (Testo vs File/Immagini vs Struttura).
  2. **Heap del Browser (V8 Engine)**:
     - Barra di progresso grafica: Memoria Heap Usata vs Totale Allocato vs Limite Browser.
     - Frequenza di campionamento e indicatore live.
  3. **Verifica Isolamento Multi-Workspace**:
     - Tabella o lista di tutti i workspace con il relativo stato:
       - Workspace attivo: `Caricato in RAM (X KB)`.
       - Workspace inattivi: `A riposo (0 KB in RAM - isolato)`.
  4. **Azioni Rapide**:
     - Pulsante *"Sospendi e libera RAM"* (scarica il workspace attivo come richiesto in precedenza).
     - Pulsante *"Ricalcola metriche"* per refresh immediato.

---

## 4. Architettura Tecnica dei Componenti

```
┌────────────────────────────────────────────────────────┐
│                        App.tsx                         │
│  - Gestione stato workspace attivo e note in RAM       │
│  - Apertura stato isMemoryModalOpen                   │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────────────────┐
│        Sidebar.tsx        │ │      MemoryDiagnosticsModal.tsx       │
│ - Chip compatto metriche  │ │ - Calcolo Blob workspace RAM        │
│ - Click -> apre il modal  │ │ - Lettura window.performance.memory   │
│                           │ │ - Analisi nodi DOM                    │
│                           │ │ - Monitor partizioni e isolamento     │
└───────────────────────────┘ └───────────────────────────────────────┘
```

### Funzione Helper di Diagnostica (`src/lib/memoryDiagnostics.ts`):
- `getWorkspaceMemoryFootprint(notes: Note[])`: calcola byte esatti, suddivisione per blocchi (testo, immagini, codice, to-do).
- `getBrowserMemoryInfo()`: rileva in sicurezza `performance.memory` gestendo l'assenza in ambienti non-Chromium.
- `getAllPartitionsStorageSize()`: misura la dimensione in byte di ogni partizione salvata su `localStorage`.

---

## 5. Piano di Esecuzione Dettagliato

1. **Creazione Modulo Utilità `memoryDiagnostics.ts`**:
   - Implementare il calcolo accurato delle dimensioni dati in memoria RAM e partizioni disco.
   - Creare wrapper resiliente per `window.performance.memory`.
2. **Creazione Componente `MemoryDiagnosticsModal.tsx`**:
   - Interfaccia con tab/card dettagliate: Memoria Dati Workspace, Heap Browser V8, Nodi DOM, e Matrice di Isolamento dei Workspace.
   - Azione diretta per liberare la RAM/scaricare il workspace.
3. **Integrazione nella Sidebar (`Sidebar.tsx`)**:
   - Inserire l'indicatore compatto cliccabile nel footer della sidebar accanto all'indicatore di sincronizzazione.
4. **Verifica & Compilazione**:
   - Verificare assenza di regressioni con `compile_applet` e validare il comportamento reattivo del modal.
