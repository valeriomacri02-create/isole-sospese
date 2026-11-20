# Isole Sospese: server del gioco

Questo server fa due cose:
1. **ospita il gioco**: chi apre l'indirizzo del server gioca nel browser, senza account;
2. **gestisce le partite online**: lista delle partite aperte, codici a 4 caratteri e sincronizzazione tra i due giocatori.

Non dipende da claude.ai. Non salva nulla: inoltra solo i dati di gioco tra i giocatori della stessa partita.

## Contenuto
| File | A cosa serve |
|---|---|
| `server.js` | Il server (Node.js + WebSocket) |
| `public/index.html` | Il gioco |
| `package.json` | Dipendenze (solo `ws`) |
| `render.yaml` | Configurazione pronta per Render |
| `build.js` | Aggiorna `public/index.html` da una nuova versione del gioco |

## Metterlo online gratis con Render

1. **GitHub**: crea un account su github.com, poi **New repository** con nome `isole-sospese`, pubblico o privato. Nella pagina del repository scegli **uploading an existing file** e trascina tutti i file di questa cartella, compresa la cartella `public`. Poi **Commit changes**.
2. **Render**: vai su render.com e registrati con l'account GitHub.
3. Scegli **New → Web Service** e collega il repository `isole-sospese`.
4. Controlla le impostazioni:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Premi **Create Web Service** e aspetta qualche minuto. Quando compare **Live**, il gioco è all'indirizzo mostrato in alto, ad esempio `https://isole-sospese.onrender.com`.

Quel link è quello da mandare su WhatsApp: chiunque lo apre gioca, e per giocare online basta che due persone aprano lo stesso link.

**Piano gratuito di Render**: dopo 15 minuti senza visite il server si sospende. Il primo che apre il link aspetta circa un minuto, poi tutto va veloce. Per tenerlo sempre acceso c'è il piano a pagamento (circa 7 $ al mese).

## Provarlo sul computer
Serve Node.js 18 o più recente.
```bash
npm install
npm start
```
Poi apri `http://localhost:8080` in due finestre e crea una partita online.

## Aggiornare il gioco
Sostituisci `public/index.html` con la nuova versione (oppure, se hai il file del gioco, `node build.js percorso/isole-sospese.html`) e carica il file su GitHub. Render si aggiorna da solo.

## Gioco su itch.io e server su Render
Se vuoi la pagina del gioco su itch.io e le partite online sul tuo server:
1. Apri `public/index.html` e cerca la riga `const GAME_SERVER = '';`
2. Scrivi l'indirizzo del server, con `wss://` all'inizio e `/ws` alla fine: `const GAME_SERVER = 'wss://isole-sospese.onrender.com/ws';`
3. Carica quel file su itch.io dentro uno .zip, come `index.html`.

## Impostazioni facoltative (variabili d'ambiente su Render)
| Variabile | Effetto |
|---|---|
| `PORT` | Porta del server (Render la imposta da solo) |
| `ALLOWED_ORIGINS` | Siti da cui ci si può collegare, separati da virgola, ad esempio `https://tuonome.itch.io,https://html-classic.itch.zone`. Vuota = tutti |

## Indirizzi utili
- `/healthz` risponde `ok` se il server è acceso
- `/stats` mostra quanti giocatori sono collegati e quante partite sono aperte
