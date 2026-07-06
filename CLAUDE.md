# nuovaconsole — VisionOttica Console Gestionale

> Fonte di verità del progetto per Claude Code.
> Aggiornare e committare ad ogni sessione significativa.
> **Ultimo aggiornamento: 06/07/2026 — video v3: privacy + card arrotondate + effetti reel**

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

## Presentazione video (03–06/07/2026)

Cartella `presentazione/` (non committata, solo locale):
- `presentazione-v3.mp4` — **versione attuale** 2:40 (06/07, `tools/build4.js`):
  PRIVACY OK (screenshot anonimizzati, vedi sotto) + look reel: ogni schermata
  è mostrata INTERA come card arrotondata con ombra su sfondo sfocato (niente
  più tagli ai lati né distorsione), Ken Burns leggero (max 1.055), transizioni
  xfade dinamiche (zoomin/slide/circleopen/hblur, 0.4s), barra di avanzamento
  azzurra in basso, didascalie animate, voce Elsa, outro "VisionOttica 2.0 —
  Un progetto di Stefano Di Bella"
- `presentazione-v3-invio.mp4` — compressa 720p (7 MB) per email/WhatsApp
- `presentazione-v2.mp4` / `presentazione-v2-invio.mp4` — v2 (04/07, `build3.js`,
  CONTIENE DATI REALI: non usare esternamente)
- `presentazione-bozza.mp4` — v1 2:26 (03/07, `tools/build2.js`, voce Giuseppe)
- `campioni-voce/` — 4 mp3 di confronto voce femminile: Elsa, Isabella,
  Ava multilingual, Seraphina multilingual (nota: it-IT-IsabellaMultilingualNeural
  NON esiste su Edge TTS; multilingual ita = solo Giuseppe maschile)
- `demo-completo.mp4` / `demo-navigazione.mp4` — girato grezzo (DATI REALI)
- `bozza-video.md` — scaletta 7 scene + outro, copione voiceover (fonte di verità)
- `screenshots/` — 21 PNG originali con DATI REALI (non usare esternamente)
- `screenshots-demo/` — screenshot ANONIMIZZATI (06/07, `tools/shots7.js`):
  nomi clienti/venditori sostituiti con nomi finti nel DOM prima dello scatto
  (harvest automatico: laboratorio a–z, contattologia, select venditori,
  classifica), UserID Firebase rimescolati, telefoni → "333 1234567".
  Mappa reale→finto in `_mappa-nomi.json` (NON diffondere: contiene i nomi reali)
- `tools/` — pipeline rigenerabile: `shots7.js` (screenshot anonimizzati),
  `build4.js` (montaggio attuale), `musica.js` (sottofondo), `campioni-voce.js`,
  vecchi: `shots2/5/6.js`, `build2/3.js`, `video2.js`. msedge-tts in
  `node_modules` del repo; playwright installato con `--no-save`; ffmpeg (winget)

**Aperto:** musica sintetica sostituibile con traccia royalty-free in CapCut.
Voce femminile da confermare dopo ascolto campioni (ora Elsa).

## TODO aperti

- [ ] Testare flusso completo su cellulare reale (`http://192.168.1.86:3000`)
- [ ] Verificare che Setup Vista AM persista al riavvio
- [ ] Valutare nome personalizzato polo durante NegozioSetup (ora: "Polo {codice}")
