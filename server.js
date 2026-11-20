// Isole Sospese: game + online multiplayer server.
// Serves the game from ./public and relays player state between players over WebSocket (/ws).
// The server keeps no game logic and stores nothing: it only forwards each player's "presence"
// (position, attacks, hits) to the other players in the same room.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
// Optional: comma-separated list of sites allowed to connect (e.g. "https://tuonome.itch.io,https://html-classic.itch.zone").
// Empty = any site may connect.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const LIMITS = {
  presenceBytes: 4096,     // max size of one player's state
  roomsPerClient: 4,       // lobby + a few match rooms
  lobbySize: 1000,
  matchSize: 8,
  msgsPerSecond: 90        // the game sends ~30 per second
};
const ROOM_RE = /^[a-z0-9][a-z0-9_.-]{0,47}$/;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/healthz'){ res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  if (url === '/stats'){ res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(stats())); return; }
  let rel;
  try { rel = decodeURIComponent(url); } catch (e){ res.writeHead(400); res.end(); return; }
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)){ res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err){ res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Pagina non trovata'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

/* ---------- rooms ---------- */
const rooms = new Map();        // name -> Map(clientId -> client)
const clients = new Map();      // clientId -> client

function roomOf(name){ let r = rooms.get(name); if (!r){ r = new Map(); rooms.set(name, r); } return r; }
function send(c, msg){ if (c.ws.readyState === 1) c.ws.send(msg); }
function broadcast(name, payload, exceptId){
  const r = rooms.get(name); if (!r) return;
  const msg = JSON.stringify(payload);
  for (const [id, c] of r) if (id !== exceptId) send(c, msg);
}
function join(c, name){
  if (c.rooms.has(name)) return true;
  if (c.rooms.size >= LIMITS.roomsPerClient) return false;
  const r = roomOf(name);
  if (r.size >= (name === 'lobby' ? LIMITS.lobbySize : LIMITS.matchSize)) return false;
  r.set(c.id, c); c.rooms.add(name); c.presence.set(name, {});
  const peers = [...r.values()].map(o => ({ peer: o.id, p: o.presence.get(name) || {} }));
  send(c, JSON.stringify({ t: 'snap', room: name, peers }));
  broadcast(name, { t: 'pres', room: name, peer: c.id, p: {} }, c.id);
  return true;
}
function leave(c, name){
  const r = rooms.get(name); if (!r || !r.has(c.id)) return;
  r.delete(c.id); c.rooms.delete(name); c.presence.delete(name);
  if (r.size === 0) rooms.delete(name);
  else broadcast(name, { t: 'left', room: name, peer: c.id });
}
function stats(){ let matches = 0; for (const n of rooms.keys()) if (n !== 'lobby') matches++; return { players: clients.size, matchRooms: matches }; }

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });
wss.on('connection', (ws, req) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)){ ws.close(1008, 'origin'); return; }
  const c = { id: crypto.randomBytes(6).toString('hex'), ws, rooms: new Set(), presence: new Map(), alive: true, budget: LIMITS.msgsPerSecond, budgetAt: Date.now() };
  clients.set(c.id, c);
  send(c, JSON.stringify({ t: 'hello', id: c.id }));
  join(c, 'lobby');

  ws.on('pong', () => { c.alive = true; });
  ws.on('message', raw => {
    const now = Date.now();
    if (now - c.budgetAt >= 1000){ c.budget = LIMITS.msgsPerSecond; c.budgetAt = now; }
    if (--c.budget < 0) return;                       // too many messages: drop
    let m; try { m = JSON.parse(raw); } catch (e){ return; }
    if (!m || typeof m !== 'object' || typeof m.room !== 'string' || !ROOM_RE.test(m.room)) return;
    if (m.t === 'join'){ if (!join(c, m.room)) send(c, JSON.stringify({ t: 'full', room: m.room })); }
    else if (m.t === 'leave'){ if (m.room !== 'lobby') leave(c, m.room); }
    else if (m.t === 'pres'){
      if (!c.rooms.has(m.room) || !m.p || typeof m.p !== 'object' || Array.isArray(m.p)) return;
      if (Buffer.byteLength(JSON.stringify(m.p)) > LIMITS.presenceBytes) return;
      c.presence.set(m.room, m.p);
      broadcast(m.room, { t: 'pres', room: m.room, peer: c.id, p: m.p }, c.id);
    }
  });
  ws.on('close', () => { for (const name of [...c.rooms]) leave(c, name); clients.delete(c.id); });
  ws.on('error', () => {});
});

// drop connections that stopped answering (closed laptop, lost signal)
setInterval(() => {
  for (const c of clients.values()){
    if (!c.alive){ c.ws.terminate(); continue; }
    c.alive = false; try { c.ws.ping(); } catch (e){}
  }
}, 15000);

server.listen(PORT, () => console.log(`Isole Sospese in ascolto sulla porta ${PORT}`));
