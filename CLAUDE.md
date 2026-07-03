# nuovaconsole — VisionOttica Console Gestionale

> Fonte di verità del progetto per Claude Code.
> Aggiornare e committare ad ogni sessione significativa.
> **Ultimo aggiornamento: 03/07/2026 — sessione presentazione video**

---

## Cos'è

Console gestionale per ottici VisionOttica. Obiettivo: gestire vendite, riparazioni, contatti lenti, statistiche per singolo negozio (polo) e area manager.

**Dev server:** `npm start` → `http://localhost:3000` (o `http://192.168.1.86:3000` da mobile)

---

## Stack

- React 19, Firebase (Firestore + Auth anonima), Tailwind CSS
- Chart.js, lucide-react, react-hot-toast

---

## Struttura moduli

| File | Contenuto |
|---|---|
| `App.js` | Shell principale: auth Firebase, routing sezioni, sidebar, obiettivi giornalieri |
| `Contattologia.js` | Utilities, hooks Firebase (`useFirestoreCollection`), UI base, sezione Contattologia |
| `DashboardLaboratorio.js` | Sezioni Dashboard e Laboratorio |
| `Amministrazione.js` | Sezioni Statistiche e Amministrazione |

---

## Firebase

- Progetto: `console-visionottica`
- Auth: anonima
- UserID salvato in `localStorage` → chiave `visionottica_userid`

### Collezioni Firestore

| Collection | Contenuto |
|---|---|
| `vendite` | Vendite per polo |
| `venditori` | Anagrafica venditori |
| `emailAmministrazioni` | Email amministrative |
| `datiMensili` | Target mensili (TGT Fatturato, TGT WO) |
| `riparazioni` | Pratiche riparazione |
| `contatti_lenti` | Contatti lenti a contatto |
| `artifacts/default-app-id/polos/{codice}` | Registro console: `{ codice, nome, userId, ruolo, createdAt }` |
| `artifacts/default-app-id/config/areaManager` | `{ password: 'admin' }` |

---

## Sistema di accesso multi-polo

### Flusso Negozio (PC)
- Prima apertura → `StartupScreen` → "Accedi come Negozio" → `NegozioSetup`
  1. Inserisci codice polo (es. 6061)
  2. Collega UserID esistente OPPURE crea nuovo database (Firebase UID anonimo)
- Sessione in localStorage: `{ type: 'negozio', polo: { codice, nome, userId, ruolo } }`
- Riaperture successive: accesso diretto alla console

### Flusso Area Manager (Mobile)
- `StartupScreen` → "Area Manager" → `AreaManagerLogin` (password default: "admin")
- Password su Firestore: `artifacts/default-app-id/config/areaManager`
- Dopo login → `AreaManagerHome`: lista di tutti i poli, può aggiungere/eliminare console
- Click su polo → apre console con pulsante "Torna alla lista"
- Sessione: `{ type: 'area_manager' }` — polo attivo NON persistito

---

## Funzionalità principali

- **Dashboard** — riepilogo vendite/riparazioni, obiettivi giornalieri (TGT Fatturato, TGT WO) da `datiMensili`
- **Laboratorio** — ricerca e gestione vendite, riparazioni, contatti
- **Amministrazione** — statistiche venditori, gestione email, dati mensili
- **Contattologia** — gestione contatti lenti a contatto

---

## Presentazione video (03/07/2026)

Cartella `presentazione/` (non committata, solo locale):
- `presentazione-bozza.mp4` — bozza montata 2:26: 21 screenshot con Ken Burns,
  didascalie, voce neurale Edge (it-IT-GiuseppeMultilingualNeural), musica
  sintetizzata stile Viva la Vida, outro "contattami per una demo" (senza URL)
- `demo-completo.mp4` / `demo-navigazione.mp4` — girato grezzo navigazione live
- `bozza-video.md` — scaletta 7 scene + copione voiceover (fonte di verità testi)
- `screenshots/` — 21 PNG @2x/@3x catturati dal sito live (polo 6061 Belpasso)
- `tools/` — pipeline rigenerabile: `shots*.js` (screenshot Playwright),
  `video2.js` (girato), `musica.js` (sottofondo), `build2.js` (montaggio
  completo TTS+ffmpeg; richiede `npm i playwright msedge-tts` + ffmpeg winget)

**Aperto:** schermate/video contengono nomi reali clienti/venditori e UserID →
prima di uso esterno creare polo demo con dati finti e rigenerare, o sfocare.
Musica sintetica sostituibile con traccia royalty-free in CapCut.

## TODO aperti

- [ ] Testare flusso completo su cellulare reale (`http://192.168.1.86:3000`)
- [ ] Verificare che Setup Vista AM persista al riavvio
- [ ] Valutare nome personalizzato polo durante NegozioSetup (ora: "Polo {codice}")
