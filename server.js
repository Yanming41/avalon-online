// 阿瓦隆在线助手：服务端权威，身份只发给本人，防止抓包看别人身份
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
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

const rooms = new Map();

// ---------- 静态文件 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || !path.extname(p)) p = '/index.html';
  const file = path.join(PUB, path.normalize(p));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- 工具 ----------
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function newCode() { let c; do { c = String(crypto.randomInt(1000, 10000)); } while (rooms.has(c)); return c; }
const isEvil = (r) => EVIL_ROLES.has(r);

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

// 每个人能看到的信息
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

function hint(role) {
  return {
    merlin: '你知道谁是坏人（莫德雷德除外）。帮好人赢，但别让刺客认出你。',
    percival: '下面两个人一个是梅林、一个是莫甘娜，分辨出真梅林并保护他。',
    servant: '你什么都不知道，靠推理找出坏人。',
    assassin: '好人完成3次任务后，你有一次机会刺杀梅林，刺中则坏人翻盘。',
    morgana: '你在派西维尔眼里看起来像梅林，去迷惑他。',
    mordred: '梅林看不到你。',
    oberon: '你是坏人，但你不认识同伙，同伙也不认识你。',
    minion: '和同伙一起破坏任务。',
  }[role];
}

// ---------- 状态下发 ----------
function viewFor(room, pid) {
  const g = room.game;
  const v = {
    code: room.code, hostId: room.hostId, me: pid, settings: room.settings,
    players: room.players.map((p) => ({ id: p.id, name: p.name, online: !!p.ws })),
    phase: g ? g.phase : 'lobby',
  };
  if (!g) return v;
  const n = room.players.length;
  Object.assign(v, {
    teamSizes: TEAM_SIZES[n], twoFailQuest4: n >= 7,
    leader: room.players[g.leaderIdx].id, quest: g.quest, results: g.results,
    rejects: g.rejects, team: g.team, history: g.history,
    voted: Object.keys(g.votes), questDone: Object.keys(g.questCards),
  });
  const role = room.roles[pid];
  if (role) v.myRole = { role, name: ROLE_NAME[role], evil: isEvil(role), hint: hint(role), sees: knowledge(room, pid) };
  if (g.phase === 'vote' && g.votes[pid] !== undefined) v.myVote = g.votes[pid];
  if (g.phase === 'quest' && g.questCards[pid] !== undefined) v.myCard = true;
  if (g.phase === 'end') {
    v.winner = g.winner; v.reason = g.reason; v.assassinTarget = g.assassinTarget;
    v.allRoles = room.players.map((p) => ({ id: p.id, role: room.roles[p.id], name: ROLE_NAME[room.roles[p.id]], evil: isEvil(room.roles[p.id]) }));
  }
  if (g.phase === 'assassin') v.assassin = room.players.find((p) => room.roles[p.id] === 'assassin').id;
  return v;
}

function broadcast(room) {
  for (const p of room.players) if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify({ t: 'state', s: viewFor(room, p.id) }));
}
const err = (ws, m) => ws.send(JSON.stringify({ t: 'error', m }));

// ---------- 游戏流程 ----------
function startGame(room) {
  const n = room.players.length;
  if (!TEAM_SIZES[n]) return `需要 5–10 人，现在 ${n} 人`;
  const r = buildRoles(n, room.settings);
  if (r.error) return r.error;
  room.roles = {};
  room.players = shuffle(room.players); // 随机座位顺序 = 队长轮转顺序
  room.players.forEach((p, i) => { room.roles[p.id] = r.roles[i]; });
  room.game = { phase: 'propose', leaderIdx: crypto.randomInt(n), quest: 0, results: [], rejects: 0, team: [], votes: {}, questCards: {}, history: [] };
}

function nextLeader(room) { const g = room.game; g.leaderIdx = (g.leaderIdx + 1) % room.players.length; }

function endGame(room, winner, reason) { Object.assign(room.game, { phase: 'end', winner, reason }); }

function handle(room, pid, msg, ws) {
  const g = room.game;
  const isHost = pid === room.hostId;
  switch (msg.t) {
    case 'settings':
      if (!isHost || g) return;
      room.settings = { ...room.settings, ...msg.settings }; break;
    case 'kick':
      if (!isHost || g || msg.id === pid) return;
      room.players = room.players.filter((p) => p.id !== msg.id); break;
    case 'start': {
      if (!isHost || (g && g.phase !== 'end')) return;
      const e = startGame(room); if (e) return err(ws, e); break;
    }
    case 'lobby':
      if (!isHost) return; room.game = null; room.roles = {}; break;
    case 'propose': {
      if (!g || g.phase !== 'propose' || room.players[g.leaderIdx].id !== pid) return;
      const size = TEAM_SIZES[room.players.length][g.quest];
      const team = [...new Set(msg.team)].filter((id) => room.players.some((p) => p.id === id));
      if (team.length !== size) return err(ws, `本轮需要选 ${size} 人`);
      g.team = team; g.votes = {}; g.phase = 'vote'; break;
    }
    case 'vote': {
      if (!g || g.phase !== 'vote') return;
      g.votes[pid] = !!msg.approve;
      if (Object.keys(g.votes).length < room.players.length) break;
      const approves = Object.values(g.votes).filter(Boolean).length;
      const ok = approves * 2 > room.players.length;
      g.history.push({ type: 'vote', quest: g.quest, leader: room.players[g.leaderIdx].id, team: g.team, votes: { ...g.votes }, ok });
      if (ok) { g.rejects = 0; g.questCards = {}; g.phase = 'quest'; }
      else {
        g.rejects++;
        if (g.rejects >= 5) { endGame(room, 'evil', '连续 5 次组队被否决，坏人获胜'); break; }
        nextLeader(room); g.team = []; g.phase = 'propose';
      }
      break;
    }
    case 'quest': {
      if (!g || g.phase !== 'quest' || !g.team.includes(pid) || g.questCards[pid] !== undefined) return;
      g.questCards[pid] = isEvil(room.roles[pid]) ? !!msg.success : true; // 好人只能出成功
      if (Object.keys(g.questCards).length < g.team.length) break;
      const fails = Object.values(g.questCards).filter((x) => !x).length;
      const need = g.quest === 3 && room.players.length >= 7 ? 2 : 1;
      const success = fails < need;
      g.results.push({ success, fails });
      g.history.push({ type: 'quest', quest: g.quest, team: g.team, fails, success });
      const wins = g.results.filter((r) => r.success).length;
      const losses = g.results.length - wins;
      if (losses >= 3) { endGame(room, 'evil', '3 次任务失败，坏人获胜'); break; }
      if (wins >= 3) { g.phase = 'assassin'; break; }
      g.quest++; nextLeader(room); g.team = []; g.phase = 'propose';
      break;
    }
    case 'assassinate': {
      if (!g || g.phase !== 'assassin' || room.roles[pid] !== 'assassin') return;
      const target = room.players.find((p) => p.id === msg.id);
      if (!target || isEvil(room.roles[target.id])) return err(ws, '请选一个好人阵营的玩家');
      g.assassinTarget = target.id;
      if (room.roles[target.id] === 'merlin') endGame(room, 'evil', `刺客刺中了梅林（${target.name}），坏人翻盘`);
      else endGame(room, 'good', `刺客刺错了人（${target.name}），好人获胜`);
      break;
    }
    default: return;
  }
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
      if (!name || !token) return err(ws, '请输入昵称');
      if (msg.t === 'create') {
        room = { code: newCode(), players: [], roles: {}, game: null, settings: { percival: true, morgana: true, mordred: false, oberon: false }, touched: Date.now() };
        rooms.set(room.code, room);
      } else {
        room = rooms.get(String(msg.code || '').trim());
        if (!room) return err(ws, '房间不存在');
      }
      let p = room.players.find((x) => x.token === token);
      if (!p) {
        if (room.game) return err(ws, '游戏已开始，不能中途加入');
        if (room.players.length >= 10) return err(ws, '房间已满（最多 10 人）');
        if (room.players.some((x) => x.name === name)) return err(ws, '昵称被占用了');
        p = { id: crypto.randomUUID().slice(0, 8), token, name };
        room.players.push(p);
      }
      if (p.ws && p.ws !== ws) try { p.ws.close(); } catch {}
      p.ws = ws; pid = p.id;
      if (!room.hostId || !room.players.some((x) => x.id === room.hostId)) room.hostId = p.id;
      ws.send(JSON.stringify({ t: 'joined', code: room.code }));
      return broadcast(room);
    }
    if (!room || !room.players.some((p) => p.id === pid)) return err(ws, '你不在房间里');
    room.touched = Date.now();
    handle(room, pid, msg, ws);
  });
  ws.on('close', () => {
    if (!room) return;
    const p = room.players.find((x) => x.id === pid);
    if (p && p.ws === ws) { p.ws = null; broadcast(room); }
  });
});

// 6 小时没人动的房间清掉
setInterval(() => { const t = Date.now(); for (const [c, r] of rooms) if (t - r.touched > 6 * 3600e3) rooms.delete(c); }, 600e3);
// 心跳，防止云平台断开空闲连接
setInterval(() => wss.clients.forEach((c) => c.readyState === 1 && c.ping()), 25e3);

server.listen(PORT, () => console.log(`Avalon on http://localhost:${PORT}`));
