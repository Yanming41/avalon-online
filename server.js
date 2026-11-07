// 阿瓦隆在线助手：服务端权威，身份只发给本人，防止抓包看别人身份
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const GOD_PASSWORD = process.env.GOD_PASSWORD || ''; // 为空则关闭上帝模式
const PUB = path.join(__dirname, 'public');

const TEAM_SIZES = {
  5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5],
};
const EVIL_COUNT = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
const EVIL_ROLES = new Set(['assassin', 'morgana', 'mordred', 'oberon', 'minion']);
const ROLE_NAME = {
  merlin: '梅林', percival: '派西维尔', servant: '亚瑟的忠臣',
  assassin: '刺客', morgana: '莫甘娜', mordred: '莫德雷德', oberon: '奥伯伦', minion: '莫德雷德的爪牙',
};
const AVATARS = ['🦁', '🐺', '🦊', '🐻', '🐼', '🐯', '🦉', '🦅', '🐉', '🦄', '🐸', '🐙', '🦈', '🐢', '🦌', '🐗', '🐰', '🐱', '🐶', '🐧'];

const rooms = new Map();

// ---------- 静态文件 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || !path.extname(p)) p = '/index.html';
  const file = path.join(PUB, path.normalize(p));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- 工具 ----------
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function newCode() { let c; do { c = String(crypto.randomInt(1000, 10000)); } while (rooms.has(c)); return c; }
const isEvil = (r) => EVIL_ROLES.has(r);
const pinOk = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function buildRoles(n, s) {
  const evil = ['assassin'];
  if (s.morgana) evil.push('morgana');
  if (s.mordred) evil.push('mordred');
  if (s.oberon) evil.push('oberon');
  if (evil.length > EVIL_COUNT[n]) return { error: `${n} 人局只有 ${EVIL_COUNT[n]} 个坏人，特殊坏人选太多了` };
  while (evil.length < EVIL_COUNT[n]) evil.push('minion');
  const good = ['merlin'];
  if (s.percival) good.push('percival');
  while (good.length < n - EVIL_COUNT[n]) good.push('servant');
  return { roles: shuffle([...good, ...evil]) };
}

// 每个人开局能看到的信息
function knowledge(room, pid) {
  const me = room.roles[pid];
  const out = [];
  for (const p of room.players) {
    if (p.id === pid) continue;
    const r = room.roles[p.id];
    if (me === 'merlin' && isEvil(r) && r !== 'mordred') out.push({ id: p.id, tag: '坏人' });
    else if (me === 'percival' && (r === 'merlin' || r === 'morgana')) out.push({ id: p.id, tag: '梅林？' });
    else if (isEvil(me) && me !== 'oberon' && isEvil(r) && r !== 'oberon') out.push({ id: p.id, tag: '同伙' });
  }
  return out;
}

// ---------- 状态下发 ----------
function viewFor(room, pid, god) {
  const g = room.game;
  const v = {
    code: room.code, hostId: room.hostId, me: pid, god: !!god, now: Date.now(), settings: room.settings,
    players: room.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, online: !!p.ws })),
    phase: g ? g.phase : 'lobby', godEnabled: !!GOD_PASSWORD,
  };
  const me = room.players.find((p) => p.id === pid);
  if (me) v.myPin = me.pin;
  if (god) v.pins = Object.fromEntries(room.players.map((p) => [p.id, p.pin]));
  if (!g) return v;
  const n = room.players.length;
  Object.assign(v, {
    teamSizes: TEAM_SIZES[n], twoFailQuest4: n >= 7,
    leader: room.players[g.leaderIdx].id, quest: g.quest, results: g.results,
    gameId: g.id, rejects: g.rejects, team: g.team, history: g.history, speech: g.speech, lastEvent: g.lastEvent,
    voted: Object.keys(g.votes), questDone: Object.keys(g.questCards),
  });
  const role = room.roles[pid];
  if (role) v.myRole = { role, name: ROLE_NAME[role], evil: isEvil(role), sees: knowledge(room, pid) };
  if (g.phase === 'vote' && g.votes[pid] !== undefined) v.myVote = g.votes[pid];
  if (g.phase === 'quest' && g.questCards[pid] !== undefined) v.myCard = true;
  if (g.phase === 'assassin') {
    v.assassin = room.players.find((p) => room.roles[p.id] === 'assassin').id;
    // 刺杀环节：坏人互相亮明身份（奥伯伦也加入），一起商量刺谁
    if (isEvil(role) || god) {
      v.evilTeam = room.players.filter((p) => isEvil(room.roles[p.id])).map((p) => p.id);
      v.evilSuggest = g.evilSuggest;
    }
  }
  const reveal = g.phase === 'end' || god;
  if (reveal) v.allRoles = room.players.map((p) => ({ id: p.id, role: room.roles[p.id], name: ROLE_NAME[room.roles[p.id]], evil: isEvil(room.roles[p.id]) }));
  if (g.phase === 'end') Object.assign(v, { winner: g.winner, reason: g.reason, assassinTarget: g.assassinTarget });
  if (god) { v.liveVotes = g.votes; v.liveCards = g.questCards; v.leaderIdx = g.leaderIdx; }
  return v;
}

function broadcast(room) {
  for (const p of room.players) if (p.ws && !p.ws._god && p.ws.readyState === 1) p.ws.send(JSON.stringify({ t: 'state', s: viewFor(room, p.id) }));
  for (const ws of room.gods) if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'state', s: viewFor(room, ws._pid || null, true) }));
}
const err = (ws, m) => ws.send(JSON.stringify({ t: 'error', m }));

// ---------- 发言计时 ----------
function clearSpeech(room) { const g = room.game; if (g && g.speech) { clearTimeout(room.speechTimer); g.speech = null; } }
function startSpeech(room) {
  const g = room.game; const n = room.players.length;
  const order = []; for (let i = 1; i <= n; i++) order.push(room.players[(g.leaderIdx + i) % n].id); // 从队长下家开始，队长最后总结
  g.speech = { order, idx: -1, secs: room.settings.speechSecs };
  nextSpeaker(room);
}
function nextSpeaker(room) {
  const g = room.game; const sp = g && g.speech; if (!sp) return;
  clearTimeout(room.speechTimer);
  sp.idx++;
  if (sp.idx >= sp.order.length) { g.speech = null; return; }
  sp.endsAt = Date.now() + sp.secs * 1000;
  room.speechTimer = setTimeout(() => { nextSpeaker(room); broadcast(room); }, sp.secs * 1000 + 300);
}

// ---------- 游戏流程 ----------
function startGame(room) {
  const n = room.players.length;
  if (!TEAM_SIZES[n]) return `需要 5–10 人，现在 ${n} 人`;
  const r = buildRoles(n, room.settings);
  if (r.error) return r.error;
  room.roles = {};
  room.players = shuffle(room.players); // 随机座位顺序 = 队长轮转顺序
  room.players.forEach((p, i) => { room.roles[p.id] = r.roles[i]; });
  clearTimeout(room.speechTimer);
  room.game = { phase: 'propose', leaderIdx: crypto.randomInt(n), quest: 0, results: [], rejects: 0, team: [], votes: {}, questCards: {}, history: [], speech: null, evilSuggest: {}, seq: 0, id: crypto.randomUUID().slice(0, 8) };
}
function nextLeader(room) { const g = room.game; g.leaderIdx = (g.leaderIdx + 1) % room.players.length; }
function endGame(room, winner, reason) { clearSpeech(room); Object.assign(room.game, { phase: 'end', winner, reason }); }
function event(room, e) { room.game.lastEvent = { ...e, seq: ++room.game.seq }; } // 客户端据此弹出票型/任务结果

function handle(room, pid, msg, ws) {
  const g = room.game;
  const isHost = pid === room.hostId;
  const leaderId = g && room.players[g.leaderIdx].id;
  switch (msg.t) {
    case 'settings': {
      if (!isHost || (g && g.phase !== 'end')) return;
      const s = msg.settings || {};
      for (const k of ['percival', 'morgana', 'mordred', 'oberon']) if (k in s) room.settings[k] = !!s[k];
      if ('speechSecs' in s) room.settings.speechSecs = Math.max(15, Math.min(600, parseInt(s.speechSecs) || 90));
      break;
    }
    case 'profile': {
      const p = room.players.find((x) => x.id === pid);
      if (AVATARS.includes(msg.avatar)) p.avatar = msg.avatar;
      break;
    }
    case 'kick':
      if (!isHost || g || msg.id === pid) return;
      room.players = room.players.filter((p) => p.id !== msg.id); break;
    case 'start': {
      if (!isHost || (g && g.phase !== 'end')) return;
      const e = startGame(room); if (e) return err(ws, e); break;
    }
    case 'lobby':
      if (!isHost) return; clearSpeech(room); room.game = null; room.roles = {}; break;
    case 'speechStart':
      if (!g || !['propose', 'vote'].includes(g.phase) || (pid !== leaderId && !isHost)) return;
      startSpeech(room); break;
    case 'speechNext': {
      if (!g || !g.speech) return;
      const cur = g.speech.order[g.speech.idx];
      if (pid !== cur && pid !== leaderId && !isHost) return;
      nextSpeaker(room); break;
    }
    case 'speechStop':
      if (!g || (pid !== leaderId && !isHost)) return; clearSpeech(room); break;
    case 'propose': {
      if (!g || g.phase !== 'propose' || leaderId !== pid) return;
      const size = TEAM_SIZES[room.players.length][g.quest];
      const team = [...new Set(msg.team)].filter((id) => room.players.some((p) => p.id === id));
      if (team.length !== size) return err(ws, `本轮需要选 ${size} 人`);
      g.team = team; g.votes = {}; g.phase = 'vote'; break;
    }
    case 'unpropose': // 队长投票前反悔重选
      if (!g || g.phase !== 'vote' || leaderId !== pid || Object.keys(g.votes).length) return;
      g.phase = 'propose'; break;
    case 'vote': {
      if (!g || g.phase !== 'vote') return;
      g.votes[pid] = !!msg.approve;
      if (Object.keys(g.votes).length < room.players.length) break;
      finishVote(room); break;
    }
    case 'quest': {
      if (!g || g.phase !== 'quest' || !g.team.includes(pid) || g.questCards[pid] !== undefined) return;
      g.questCards[pid] = isEvil(room.roles[pid]) ? !!msg.success : true; // 好人只能出成功
      if (Object.keys(g.questCards).length < g.team.length) break;
      finishQuest(room); break;
    }
    case 'suggest': // 坏人在刺杀环节标记怀疑对象，仅坏人可见
      if (!g || g.phase !== 'assassin' || !isEvil(room.roles[pid])) return;
      g.evilSuggest[pid] = msg.id; break;
    case 'assassinate': {
      if (!g || g.phase !== 'assassin' || room.roles[pid] !== 'assassin') return;
      doAssassinate(room, msg.id, ws); break;
    }
    default: return;
  }
  broadcast(room);
}

function finishVote(room) {
  const g = room.game;
  const approves = Object.values(g.votes).filter(Boolean).length;
  const ok = approves * 2 > room.players.length;
  const rec = { type: 'vote', quest: g.quest, attempt: g.rejects + 1, leader: room.players[g.leaderIdx].id, team: g.team, votes: { ...g.votes }, ok };
  g.history.push(rec); event(room, rec);
  clearSpeech(room);
  if (ok) { g.rejects = 0; g.questCards = {}; g.phase = 'quest'; }
  else {
    g.rejects++;
    if (g.rejects >= 5) return endGame(room, 'evil', '连续 5 次组队被否决，坏人获胜');
    nextLeader(room); g.team = []; g.phase = 'propose';
  }
}

function finishQuest(room) {
  const g = room.game;
  const fails = Object.values(g.questCards).filter((x) => !x).length;
  const need = g.quest === 3 && room.players.length >= 7 ? 2 : 1;
  const success = fails < need;
  g.results.push({ success, fails });
  const rec = { type: 'quest', quest: g.quest, team: g.team, fails, success, need };
  g.history.push(rec); event(room, rec);
  const wins = g.results.filter((r) => r.success).length;
  if (g.results.length - wins >= 3) return endGame(room, 'evil', '3 次任务失败，坏人获胜');
  if (wins >= 3) { g.phase = 'assassin'; g.evilSuggest = {}; return; }
  g.quest++; nextLeader(room); g.team = []; g.phase = 'propose';
}

function doAssassinate(room, id, ws) {
  const g = room.game;
  const target = room.players.find((p) => p.id === id);
  if (!target || isEvil(room.roles[target.id])) return err(ws, '请选一个好人阵营的玩家');
  g.assassinTarget = target.id;
  if (room.roles[target.id] === 'merlin') endGame(room, 'evil', `刺客刺中了梅林（${target.name}），坏人翻盘`);
  else endGame(room, 'good', `刺客刺了 ${target.name}，没刺中梅林，好人获胜`);
}

// ---------- 上帝模式 ----------
function godAction(room, msg, ws) {
  const g = room.game; const a = msg.a;
  const p = msg.id && room.players.find((x) => x.id === msg.id);
  if (a === 'kick' && p) {
    if (g) return err(ws, '游戏进行中不能移出玩家（会打乱人数），可以先回大厅');
    room.players = room.players.filter((x) => x !== p);
    if (room.hostId === p.id && room.players[0]) room.hostId = room.players[0].id;
  } else if (a === 'host' && p) room.hostId = p.id;
  else if (a === 'lobby') { clearSpeech(room); room.game = null; room.roles = {}; }
  else if (a === 'start') { const e = startGame(room); if (e) return err(ws, e); }
  else if (a === 'settings') { room.settings = { ...room.settings, ...msg.settings }; }
  else if (!g) return err(ws, '游戏还没开始');
  else if (a === 'leader' && p) { g.leaderIdx = room.players.indexOf(p); if (g.phase === 'vote') { g.phase = 'propose'; g.votes = {}; } clearSpeech(room); }
  else if (a === 'role' && p && ROLE_NAME[msg.role]) room.roles[p.id] = msg.role;
  else if (a === 'swapRoles') {
    const q = room.players.find((x) => x.id === msg.id2);
    if (p && q) [room.roles[p.id], room.roles[q.id]] = [room.roles[q.id], room.roles[p.id]];
  } else if (a === 'rejects') g.rejects = Math.max(0, Math.min(4, parseInt(msg.n) || 0));
  else if (a === 'resetRound') { g.phase = 'propose'; g.team = []; g.votes = {}; g.questCards = {}; clearSpeech(room); }
  else if (a === 'undoQuest') {
    if (!g.results.length) return err(ws, '还没有任务结果');
    g.results.pop(); g.quest = g.results.length;
    const i = g.history.map((h) => h.type).lastIndexOf('quest'); if (i >= 0) g.history.splice(i, 1);
    g.phase = 'propose'; g.team = []; g.votes = {}; g.questCards = {}; delete g.winner; delete g.reason; delete g.assassinTarget;
  } else if (a === 'setResult') {
    const r = g.results[msg.i]; if (!r) return;
    r.success = !!msg.success;
  } else if (a === 'forceVote') { // 帮掉线的人补票
    if (g.phase !== 'vote') return;
    for (const x of room.players) if (g.votes[x.id] === undefined) g.votes[x.id] = !!msg.approve;
    finishVote(room);
  } else if (a === 'forceQuest') {
    if (g.phase !== 'quest') return;
    for (const id of g.team) if (g.questCards[id] === undefined) g.questCards[id] = true;
    finishQuest(room);
  } else if (a === 'toAssassin') { clearSpeech(room); g.phase = 'assassin'; g.evilSuggest = {}; }
  else if (a === 'end') endGame(room, msg.winner === 'good' ? 'good' : 'evil', '上帝裁定结束');
  else if (a === 'speechSkip') nextSpeaker(room);
  else if (a === 'speechAdd') { const sp = g.speech; if (sp) { sp.endsAt += 30e3; clearTimeout(room.speechTimer); room.speechTimer = setTimeout(() => { nextSpeaker(room); broadcast(room); }, sp.endsAt - Date.now() + 300); } }
  else return;
  broadcast(room);
}

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  let room = null, pid = null;
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'create' || msg.t === 'join') {
      const name = String(msg.name || '').trim().slice(0, 12);
      const token = String(msg.token || '').slice(0, 64);
      const avatar = AVATARS.includes(msg.avatar) ? msg.avatar : AVATARS[crypto.randomInt(AVATARS.length)];
      if (!name || !token) return err(ws, '请输入昵称');
      if (msg.t === 'create') {
        room = { code: newCode(), players: [], roles: {}, game: null, gods: new Set(), settings: { percival: true, morgana: true, mordred: false, oberon: false, speechSecs: 90 }, touched: Date.now() };
        rooms.set(room.code, room);
      } else {
        room = rooms.get(String(msg.code || '').trim());
        if (!room) return err(ws, '房间不存在（服务器可能重启过，请重新建房）');
      }
      let p = room.players.find((x) => x.token === token);
      if (!p) {
        const same = room.players.find((x) => x.name === name);
        if (same) {
          // 换手机/清了缓存：用昵称 + 重连码找回自己的位置
          if (!msg.pin) return ws.send(JSON.stringify({ t: 'needPin', name }));
          if (!pinOk(String(msg.pin), same.pin)) return err(ws, '重连码不对');
          same.token = token; p = same;
        } else {
          if (room.game) return err(ws, '游戏已开始，不能中途加入。如果你是掉线的玩家，请填写原来的昵称');
          if (room.players.length >= 10) return err(ws, '房间已满（最多 10 人）');
          p = { id: crypto.randomUUID().slice(0, 8), token, name, avatar, pin: String(crypto.randomInt(1000, 10000)) };
          room.players.push(p);
        }
      }
      if (p.ws && p.ws !== ws) try { p.ws.send(JSON.stringify({ t: 'kicked', m: '你的账号在别的设备上登录了' })); p.ws.close(); } catch {}
      p.ws = ws; pid = p.id;
      if (!room.hostId || !room.players.some((x) => x.id === room.hostId)) room.hostId = p.id;
      ws.send(JSON.stringify({ t: 'joined', code: room.code }));
      return broadcast(room);
    }
    if (msg.t === 'god') {
      if (!GOD_PASSWORD) return err(ws, '服务器没有开启上帝模式（未设置 GOD_PASSWORD）');
      const r = rooms.get(String(msg.code || '').trim());
      if (!r) return err(ws, '房间不存在');
      if (!pinOk(crypto.createHash('sha256').update(String(msg.password)).digest('hex'), crypto.createHash('sha256').update(GOD_PASSWORD).digest('hex'))) return err(ws, '密码错误');
      if (room && room !== r) room.gods.delete(ws);
      room = r; room.gods.add(ws); ws._god = true; ws._pid = pid;
      ws.send(JSON.stringify({ t: 'godOk', code: r.code }));
      return broadcast(room);
    }
    if (!room) return err(ws, '你不在房间里');
    room.touched = Date.now();
    if (msg.t === 'g') return ws._god ? godAction(room, msg, ws) : err(ws, '没有上帝权限');
    if (!room.players.some((p) => p.id === pid)) return err(ws, '你不在房间里');
    handle(room, pid, msg, ws);
  });
  ws.on('close', () => {
    if (!room) return;
    room.gods.delete(ws);
    const p = room.players.find((x) => x.id === pid);
    if (p && p.ws === ws) p.ws = null;
    broadcast(room);
  });
});

// 6 小时没人动的房间清掉
setInterval(() => { const t = Date.now(); for (const [c, r] of rooms) if (t - r.touched > 6 * 3600e3) { clearTimeout(r.speechTimer); rooms.delete(c); } }, 600e3);
// 心跳，防止云平台断开空闲连接
setInterval(() => wss.clients.forEach((c) => c.readyState === 1 && c.ping()), 25e3);

server.listen(PORT, () => console.log(`Avalon on http://localhost:${PORT}  god=${GOD_PASSWORD ? 'on' : 'off'}`));
