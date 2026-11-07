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
const ROLE_NAME = {
  merlin: '梅林', percival: '派西维尔', servant: '亚瑟的忠臣', cleric: '牧师', troublemaker: '捣蛋鬼',
  good_sorcerer: '正义巫师', good_lancelot: '正义兰斯洛特',
  assassin: '刺客', morgana: '莫甘娜', mordred: '莫德雷德', oberon: '奥伯伦', minion: '莫德雷德的爪牙',
  lunatic: '疯子', brute: '莽夫', revealer: '暴露者', trickster: '诡术师', evil_sorcerer: '邪恶巫师', evil_lancelot: '邪恶兰斯洛特',
};
const EVIL_ROLES = new Set(['assassin', 'morgana', 'mordred', 'oberon', 'minion', 'lunatic', 'brute', 'revealer', 'trickster', 'evil_sorcerer', 'evil_lancelot']);
// 大厅里可勾选的单个角色（阵营）；lancelot / sorcerer 是成对的
const OPT_GOOD = ['percival', 'cleric', 'troublemaker'];
const OPT_EVIL = ['morgana', 'mordred', 'oberon', 'lunatic', 'brute', 'revealer', 'trickster'];
const AVATARS = ['🦁', '🐺', '🦊', '🐻', '🐼', '🐯', '🦉', '🦅', '🐉', '🦄', '🐸', '🐙', '🦈', '🐢', '🦌', '🐗', '🐰', '🐱', '🐶', '🐧'];
const DEFAULT_SETTINGS = {
  percival: true, morgana: true, mordred: false, oberon: false, cleric: false, troublemaker: false,
  lunatic: false, brute: false, revealer: false, trickster: false, sorcerer: false,
  lancelot: 0, // 0 关闭，1/2/3 对应三套兰斯洛特规则
  lady: false, excalibur: false, speechSecs: 90,
};

const rooms = new Map();

// ---------- 静态文件 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json' };
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
const isEvilRole = (r) => EVIL_ROLES.has(r);
const pinOk = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const isLancelot = (r) => r === 'good_lancelot' || r === 'evil_lancelot';
// 当前阵营：兰斯洛特换阵营后会反过来
function evilNow(room, pid) {
  const r = room.roles[pid]; const e = isEvilRole(r);
  return room.game && room.game.lancelotSwapped && isLancelot(r) ? !e : e;
}
// 忠诚查验（湖中仙女 / 牧师）看到的结果：捣蛋鬼必须显示坏，诡术师可以自选
function loyaltyShown(room, pid) {
  const r = room.roles[pid];
  if (r === 'troublemaker') return true;
  if (r === 'trickster') return !!room.game.trickShowEvil[pid];
  return evilNow(room, pid);
}

function buildRoles(n, s) {
  const evil = ['assassin', ...OPT_EVIL.filter((k) => s[k])];
  const good = ['merlin', ...OPT_GOOD.filter((k) => s[k])];
  if (s.sorcerer) { evil.push('evil_sorcerer'); good.push('good_sorcerer'); }
  if (s.lancelot) { evil.push('evil_lancelot'); good.push('good_lancelot'); }
  const E = EVIL_COUNT[n], G = n - E;
  if (evil.length > E) return { error: `${n} 人局只有 ${E} 个坏人，现在选了 ${evil.length} 个坏人角色` };
  if (good.length > G) return { error: `${n} 人局只有 ${G} 个好人，现在选了 ${good.length} 个好人角色` };
  while (evil.length < E) evil.push('minion');
  while (good.length < G) good.push('servant');
  return { roles: shuffle([...good, ...evil]) };
}

// 开局"睁眼"信息，按初始身份算（之后兰斯洛特换阵营不影响开局看到的东西）
function knowledge(room, pid) {
  const me = room.roles[pid], g = room.game;
  const out = [];
  const seenByEvil = (r) => isEvilRole(r) && r !== 'oberon';
  for (const p of room.players) {
    if (p.id === pid) continue;
    const r = room.roles[p.id];
    if (me === 'merlin' && isEvilRole(r) && r !== 'mordred') out.push({ id: p.id, tag: '坏人' });
    else if (me === 'percival' && (r === 'merlin' || r === 'morgana')) out.push({ id: p.id, tag: '梅林？' });
    else if (g.lancelotRule === 3 && isLancelot(me) && isLancelot(r)) out.push({ id: p.id, tag: '另一个兰斯洛特' });
    else if (seenByEvil(me) && me !== 'evil_lancelot' && seenByEvil(r)) out.push({ id: p.id, tag: r === 'evil_lancelot' ? '邪恶兰斯洛特' : '同伙' });
  }
  if (me === 'cleric' && g.clericSaw) out.push({ id: g.clericSaw.id, tag: `首任队长·${g.clericSaw.evil ? '坏人' : '好人'}` });
  return out;
}

// 这个人这轮能出哪些任务牌
function allowedCards(room, pid) {
  const r = room.roles[pid], q = room.game.quest;
  if (r === 'good_sorcerer' || r === 'evil_sorcerer') return ['S', 'M'];
  if (!evilNow(room, pid)) return ['S'];
  if (r === 'lunatic') return ['F'];
  if (r === 'brute') return q <= 2 ? ['S', 'F'] : ['S'];
  return ['S', 'F'];
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
    teamSizes: TEAM_SIZES[n], twoFailQuest4: n >= 7, evilTotal: EVIL_COUNT[n],
    leader: room.players[g.leaderIdx].id, quest: g.quest, results: g.results,
    gameId: g.id, bellSeq: g.bellSeq || 0, rejects: g.rejects, team: g.team, history: g.history, speech: g.speech, lastEvent: g.lastEvent,
    voted: Object.keys(g.votes), questDone: Object.keys(g.questCards),
    revealed: g.revealed, excalibur: g.excalibur, rolesInGame: g.rolesInGame,
    lady: room.settings.lady ? { holder: g.ladyHolder, used: g.ladyUsed, log: g.ladyLog } : null,
    lancelot: g.lancelotRule ? { rule: g.lancelotRule, swapped: g.lancelotSwapped, flips: g.lancelotFlips, left: g.lancelotDeck.length } : null,
  });
  const role = room.roles[pid];
  if (role) {
    v.myRole = { role, name: ROLE_NAME[role], evil: isEvilRole(role), evilNow: evilNow(room, pid), sees: knowledge(room, pid) };
    if (role === 'trickster') v.myRole.trickShowEvil = !!g.trickShowEvil[pid];
    v.myChecks = g.ladyResults[pid] || [];
    if (g.excalSeen[pid]) v.myExcalSeen = g.excalSeen[pid];
  }
  if (g.phase === 'vote' && g.votes[pid] !== undefined) v.myVote = g.votes[pid];
  if (g.phase === 'quest' && g.team.includes(pid)) { v.myCards = allowedCards(room, pid); if (g.questCards[pid] !== undefined) v.myCard = true; }
  if (g.phase === 'assassin') {
    v.assassin = room.players.find((p) => room.roles[p.id] === 'assassin').id;
    // 刺杀环节：当前坏人阵营全部亮明身份，一起商量刺谁
    if ((role && evilNow(room, pid)) || god) {
      v.evilTeam = room.players.filter((p) => evilNow(room, p.id)).map((p) => p.id);
      v.evilSuggest = g.evilSuggest;
    }
  }
  if (g.phase === 'end' || god) v.allRoles = room.players.map((p) => ({ id: p.id, role: room.roles[p.id], name: ROLE_NAME[room.roles[p.id]], evil: evilNow(room, p.id) }));
  if (g.phase === 'end') Object.assign(v, { winner: g.winner, reason: g.reason, assassinTarget: g.assassinTarget });
  if (god) { v.liveVotes = g.votes; v.liveCards = g.questCards; v.leaderIdx = g.leaderIdx; v.lancelotDeck = g.lancelotDeck; }
  return v;
}

function broadcast(room) {
  for (const p of room.players) if (p.ws && !p.ws._god && p.ws.readyState === 1) p.ws.send(JSON.stringify({ t: 'state', s: viewFor(room, p.id) }));
  // 观战 / 投屏：只拿公开信息（等同于一个没有身份的旁观者）
  if (room.watchers.size) { const pub = JSON.stringify({ t: 'state', s: { ...viewFor(room, null, false), watch: true } }); for (const w of room.watchers) if (w.readyState === 1) w.send(pub); }
  for (const ws of room.gods) {
    if (ws.readyState !== 1) continue;
    let v;
    if (ws._viewAs && room.players.some((p) => p.id === ws._viewAs)) {
      v = viewFor(room, ws._viewAs, false);
      Object.assign(v, { god: true, viewAs: ws._viewAs, roster: room.players.map((p) => ({ id: p.id, role: room.roles[p.id] ? ROLE_NAME[room.roles[p.id]] : '' })) });
    } else { ws._viewAs = null; v = viewFor(room, ws._pid || null, true); }
    ws.send(JSON.stringify({ t: 'state', s: v }));
  }
}
const err = (ws, m) => ws.send(JSON.stringify({ t: 'error', m }));

// ---------- 发言计时 ----------
function clearSpeech(room) { const g = room.game; clearTimeout(room.speechTimer); if (g) g.speech = null; }
function startSpeech(room) {
  const g = room.game; const n = room.players.length;
  const order = []; for (let i = 1; i <= n; i++) order.push(room.players[(g.leaderIdx + i) % n].id); // 从队长下家开始，队长最后总结
  g.speech = { order, idx: -1, secs: room.settings.speechSecs };
  nextSpeaker(room);
}
function armSpeechTimer(room) {
  clearTimeout(room.speechTimer);
  const sp = room.game.speech;
  room.speechTimer = setTimeout(() => { nextSpeaker(room, true); broadcast(room); }, sp.endsAt - Date.now() + 300);
}
function nextSpeaker(room, timeout) {
  const g = room.game; const sp = g && g.speech; if (!sp) return;
  clearTimeout(room.speechTimer);
  if (timeout) g.bellSeq = (g.bellSeq || 0) + 1; // 发言超时，客户端据此响铃
  sp.idx++;
  if (sp.idx >= sp.order.length) { g.speech = null; return; }
  sp.endsAt = Date.now() + sp.secs * 1000;
  armSpeechTimer(room);
}

// ---------- 游戏流程 ----------
function startGame(room) {
  const n = room.players.length;
  if (!TEAM_SIZES[n]) return `需要 5–10 人，现在 ${n} 人`;
  const s = room.settings;
  const r = buildRoles(n, s);
  if (r.error) return r.error;
  room.roles = {};
  room.players = shuffle(room.players); // 随机座位顺序 = 队长轮转顺序
  room.players.forEach((p, i) => { room.roles[p.id] = r.roles[i]; });
  clearTimeout(room.speechTimer);
  const leaderIdx = crypto.randomInt(n);
  const g = room.game = {
    id: crypto.randomUUID().slice(0, 8), phase: 'propose', leaderIdx, quest: 0, results: [], rejects: 0, team: [], votes: {}, questCards: {},
    history: [], speech: null, evilSuggest: {}, seq: 0, revealed: [], trickShowEvil: {},
    excalibur: null, excalSeen: {}, ladyResults: {}, ladyLog: [], ladyUsed: [], ladyHolder: null,
    lancelotRule: s.lancelot || 0, lancelotSwapped: false, lancelotFlips: [], lancelotDeck: [],
    rolesInGame: [...new Set(r.roles)],
  };
  if (s.lady) { g.ladyHolder = room.players[(leaderIdx - 1 + n) % n].id; g.ladyUsed = [g.ladyHolder]; } // 首任队长右手边（上家）
  const first = room.players[leaderIdx].id;
  const cleric = room.players.find((p) => room.roles[p.id] === 'cleric');
  if (cleric && cleric.id !== first) g.clericSaw = { id: first, evil: loyaltyShown(room, first) };
  if (g.lancelotRule === 1) g.lancelotDeck = shuffle(['switch', 'switch', 'stay', 'stay', 'stay']);
  if (g.lancelotRule === 2) g.lancelotDeck = shuffle(['switch', 'switch', 'stay', 'stay', 'stay', 'stay', 'stay']).slice(0, 5);
  enterPropose(room, true);
}
function nextLeader(room) { const g = room.game; g.leaderIdx = (g.leaderIdx + 1) % room.players.length; }
function endGame(room, winner, reason) { clearSpeech(room); Object.assign(room.game, { phase: 'end', winner, reason }); }
function event(room, e) { room.game.lastEvent = { ...e, seq: ++room.game.seq }; } // 客户端据此弹出票型/任务结果

// 进入组队阶段：兰斯洛特规则 1 从第 3 轮起每次组队翻牌，规则 2 每轮开始翻牌
function enterPropose(room, newQuest) {
  const g = room.game;
  g.phase = 'propose'; g.team = []; g.votes = {}; g.excalibur = null;
  const flip = (g.lancelotRule === 1 && g.quest >= 2) || (g.lancelotRule === 2 && newQuest);
  if (flip && g.lancelotDeck.length) {
    const card = g.lancelotDeck.shift();
    if (card === 'switch') g.lancelotSwapped = !g.lancelotSwapped;
    const rec = { type: 'lancelot', quest: g.quest, card, swapped: g.lancelotSwapped };
    g.lancelotFlips.push(rec); g.history.push(rec); event(room, rec);
  }
}

function handle(room, pid, msg, ws) {
  const g = room.game;
  const isHost = pid === room.hostId;
  const leaderId = g && room.players[g.leaderIdx].id;
  switch (msg.t) {
    case 'settings': {
      if (!isHost || (g && g.phase !== 'end')) return;
      applySettings(room, msg.settings || {});
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
    case 'trickShow':
      if (!g || room.roles[pid] !== 'trickster') return;
      g.trickShowEvil[pid] = !!msg.evil; break;
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
      if (room.settings.excalibur) {
        if (!team.includes(msg.excalibur) || msg.excalibur === pid) return err(ws, '王者之剑要交给车上的一名队员（不能给自己）');
        g.excalibur = msg.excalibur;
      }
      g.team = team; g.votes = {}; g.phase = 'vote'; break;
    }
    case 'unpropose': // 队长投票前反悔重选
      if (!g || g.phase !== 'vote' || leaderId !== pid || Object.keys(g.votes).length) return;
      g.phase = 'propose'; g.excalibur = null; break;
    case 'vote': {
      if (!g || g.phase !== 'vote') return;
      g.votes[pid] = !!msg.approve;
      if (Object.keys(g.votes).length < room.players.length) break;
      finishVote(room); break;
    }
    case 'quest': {
      if (!g || g.phase !== 'quest' || !g.team.includes(pid) || g.questCards[pid] !== undefined) return;
      const card = msg.card || (msg.success === false ? 'F' : 'S');
      if (!allowedCards(room, pid).includes(card)) return err(ws, '你不能出这张牌');
      g.questCards[pid] = card;
      if (Object.keys(g.questCards).length < g.team.length) break;
      if (g.excalibur) { g.phase = 'excalibur'; break; }
      finishQuest(room); break;
    }
    case 'excalibur': { // 王者之剑：翻转一名其他队员的牌，或者不用
      if (!g || g.phase !== 'excalibur' || g.excalibur !== pid) return;
      let used = null;
      if (msg.id) {
        if (msg.id === pid || !g.team.includes(msg.id)) return err(ws, '只能选车上的其他队员');
        const before = g.questCards[msg.id];
        g.excalSeen[pid] = { id: msg.id, card: before, quest: g.quest };
        if (before === 'S') g.questCards[msg.id] = 'F'; else if (before === 'F') g.questCards[msg.id] = 'S';
        used = msg.id;
      }
      finishQuest(room, { holder: pid, target: used }); break;
    }
    case 'lady': { // 湖中仙女：查验一名没拿过湖中仙女的人，结果只有自己看到
      if (!g || g.phase !== 'lady' || g.ladyHolder !== pid) return;
      const t = room.players.find((p) => p.id === msg.id);
      if (!t || t.id === pid || g.ladyUsed.includes(t.id)) return err(ws, '不能查自己或拿过湖中仙女的人');
      (g.ladyResults[pid] = g.ladyResults[pid] || []).push({ id: t.id, evil: loyaltyShown(room, t.id), quest: g.quest });
      const rec = { type: 'lady', quest: g.quest, holder: pid, target: t.id };
      g.ladyLog.push(rec); g.history.push(rec); event(room, rec);
      g.ladyHolder = t.id; g.ladyUsed.push(t.id);
      g.quest++; nextLeader(room); enterPropose(room, true);
      break;
    }
    case 'suggest': // 坏人在刺杀环节标记怀疑对象，仅坏人可见
      if (!g || g.phase !== 'assassin' || !evilNow(room, pid)) return;
      g.evilSuggest[pid] = msg.id; break;
    case 'assassinate': {
      if (!g || g.phase !== 'assassin' || room.roles[pid] !== 'assassin') return;
      doAssassinate(room, msg.id, ws); break;
    }
    default: return;
  }
  broadcast(room);
}

function applySettings(room, s) {
  for (const k of [...OPT_GOOD, ...OPT_EVIL, 'sorcerer', 'lady', 'excalibur']) if (k in s) room.settings[k] = !!s[k];
  if ('lancelot' in s) room.settings.lancelot = [0, 1, 2, 3].includes(+s.lancelot) ? +s.lancelot : 0;
  if ('speechSecs' in s) room.settings.speechSecs = Math.max(15, Math.min(600, parseInt(s.speechSecs) || 90));
}

function finishVote(room) {
  const g = room.game;
  const approves = Object.values(g.votes).filter(Boolean).length;
  const ok = approves * 2 > room.players.length;
  const rec = { type: 'vote', quest: g.quest, attempt: g.rejects + 1, leader: room.players[g.leaderIdx].id, team: g.team, votes: { ...g.votes }, ok, excalibur: g.excalibur };
  g.history.push(rec); event(room, rec);
  clearSpeech(room);
  if (ok) { g.rejects = 0; g.questCards = {}; g.phase = 'quest'; }
  else {
    g.rejects++;
    if (g.rejects >= 5) return endGame(room, 'evil', '连续 5 次组队被否决，坏人获胜');
    nextLeader(room); enterPropose(room, false);
  }
}

function finishQuest(room, excal) {
  const g = room.game;
  const cards = Object.values(g.questCards);
  const fails = cards.filter((c) => c === 'F').length, magics = cards.filter((c) => c === 'M').length;
  const need = g.quest === 3 && room.players.length >= 7 ? 2 : 1;
  let success = fails < need;
  if (magics % 2 === 1) success = !success; // 魔法牌反转结果（两张互相抵消）
  g.results.push({ success, fails, magics });
  const rec = { type: 'quest', quest: g.quest, team: g.team, fails, magics, success, need, excal: excal || null };
  g.history.push(rec); event(room, rec);
  const wins = g.results.filter((r) => r.success).length, losses = g.results.length - wins;
  // 暴露者：第二次任务失败后公开身份
  if (!success && losses === 2) for (const p of room.players) if (room.roles[p.id] === 'revealer' && !g.revealed.includes(p.id)) g.revealed.push(p.id);
  if (losses >= 3) return endGame(room, 'evil', '3 次任务失败，坏人获胜');
  if (wins >= 3) { clearSpeech(room); g.phase = 'assassin'; g.evilSuggest = {}; return; }
  // 湖中仙女：第 2、3、4 轮任务结束后使用
  if (room.settings.lady && g.quest >= 1 && g.quest <= 3) { clearSpeech(room); g.phase = 'lady'; return; }
  g.quest++; nextLeader(room); enterPropose(room, true);
}

function doAssassinate(room, id, ws) {
  const g = room.game;
  const target = room.players.find((p) => p.id === id);
  if (!target || evilNow(room, target.id)) return err(ws, '请选一个好人阵营的玩家');
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
  else if (a === 'addBots') {
    if (g && g.phase !== 'end') return err(ws, '游戏进行中不能加人');
    const want = Math.max(1, Math.min(10, parseInt(msg.n) || 5));
    let k = 1;
    while (room.players.length < want) {
      while (room.players.some((x) => x.name === '机器人' + k)) k++;
      room.players.push({ id: crypto.randomUUID().slice(0, 8), token: 'bot-' + crypto.randomUUID(), name: '机器人' + k, avatar: AVATARS[crypto.randomInt(AVATARS.length)], pin: String(crypto.randomInt(1000, 10000)), bot: true });
    }
    if (!room.hostId) room.hostId = room.players[0].id;
  } else if (a === 'removeBots') {
    if (g && g.phase !== 'end') return err(ws, '游戏进行中不能移出玩家');
    room.players = room.players.filter((x) => !x.bot);
    if (!room.players.some((x) => x.id === room.hostId)) room.hostId = room.players[0] && room.players[0].id;
  } else if (a === 'viewAs') { ws._viewAs = p ? p.id : null; }
  else if (a === 'as') { // 以某个玩家的身份操作
    const id = ws._viewAs; if (!id) return err(ws, '先选择要代入的玩家');
    if (!msg.msg || ['create', 'join', 'god', 'g'].includes(msg.msg.t)) return;
    return handle(room, id, msg.msg, ws);
  }
  else if (a === 'lobby') { clearSpeech(room); room.game = null; room.roles = {}; }
  else if (a === 'start') { const e = startGame(room); if (e) return err(ws, e); }
  else if (a === 'settings') applySettings(room, msg.settings || {});
  else if (!g) return err(ws, '游戏还没开始');
  else if (a === 'leader' && p) { g.leaderIdx = room.players.indexOf(p); if (g.phase === 'vote') { g.phase = 'propose'; g.votes = {}; } clearSpeech(room); }
  else if (a === 'role' && p && ROLE_NAME[msg.role]) room.roles[p.id] = msg.role;
  else if (a === 'rejects') g.rejects = Math.max(0, Math.min(4, parseInt(msg.n) || 0));
  else if (a === 'resetRound') { g.questCards = {}; clearSpeech(room); enterPropose(room, false); }
  else if (a === 'undoQuest') {
    if (!g.results.length) return err(ws, '还没有任务结果');
    g.results.pop(); g.quest = g.results.length;
    const i = g.history.map((h) => h.type).lastIndexOf('quest'); if (i >= 0) g.history.splice(i, 1);
    g.questCards = {}; delete g.winner; delete g.reason; delete g.assassinTarget;
    g.phase = 'propose'; g.team = []; g.votes = {};
  } else if (a === 'setResult') {
    const r = g.results[msg.i]; if (!r) return;
    r.success = !!msg.success;
  } else if (a === 'forceVote') { // 帮掉线的人补票
    if (g.phase !== 'vote') return;
    for (const x of room.players) if (g.votes[x.id] === undefined) g.votes[x.id] = !!msg.approve;
    finishVote(room);
  } else if (a === 'forceQuest') {
    if (g.phase !== 'quest') return;
    for (const id of g.team) if (g.questCards[id] === undefined) g.questCards[id] = allowedCards(room, id)[0];
    if (g.excalibur) g.phase = 'excalibur'; else finishQuest(room);
  } else if (a === 'skipPhase') { // 跳过湖中仙女 / 王者之剑
    if (g.phase === 'excalibur') finishQuest(room, { holder: g.excalibur, target: null });
    else if (g.phase === 'lady') { g.quest++; nextLeader(room); enterPropose(room, true); }
  } else if (a === 'swapLancelot') { g.lancelotSwapped = !g.lancelotSwapped; }
  else if (a === 'toAssassin') { clearSpeech(room); g.phase = 'assassin'; g.evilSuggest = {}; }
  else if (a === 'end') endGame(room, msg.winner === 'good' ? 'good' : 'evil', '上帝裁定结束');
  else if (a === 'speechSkip') nextSpeaker(room);
  else if (a === 'speechAdd') { if (g.speech) { g.speech.endsAt += 30e3; armSpeechTimer(room); } }
  else return;
  broadcast(room);
}

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });
const godFails = new Map(); // ip -> 连续输错次数
wss.on('connection', (ws, req) => {
  ws._ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  let room = null, pid = null;
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'create' || msg.t === 'join') {
      const name = String(msg.name || '').trim().slice(0, 12);
      const token = String(msg.token || '').slice(0, 64);
      const avatar = AVATARS.includes(msg.avatar) ? msg.avatar : AVATARS[crypto.randomInt(AVATARS.length)];
      if (!name || !token) return err(ws, '请输入昵称');
      if (msg.t === 'create') {
        room = { code: newCode(), players: [], roles: {}, game: null, gods: new Set(), watchers: new Set(), settings: { ...DEFAULT_SETTINGS }, touched: Date.now() };
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
    if (msg.t === 'watch') {
      const r = rooms.get(String(msg.code || '').trim());
      if (!r) return err(ws, '房间不存在');
      if (room && room !== r) { room.watchers.delete(ws); room.gods.delete(ws); }
      room = r; room.watchers.add(ws);
      return broadcast(room);
    }
    if (msg.t === 'god') {
      if (!GOD_PASSWORD) return err(ws, '服务器没有开启上帝模式（未设置 GOD_PASSWORD）');
      const r = rooms.get(String(msg.code || '').trim());
      if (!r) return err(ws, '房间不存在');
      const h = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');
      const ip = ws._ip, f = godFails.get(ip) || { n: 0, until: 0 };
      if (f.until > Date.now()) return err(ws, `密码错误次数太多，请 ${Math.ceil((f.until - Date.now()) / 60000)} 分钟后再试`);
      if (!pinOk(h(msg.password), h(GOD_PASSWORD))) {
        f.n++; if (f.n >= 5) { f.n = 0; f.until = Date.now() + 10 * 60e3; }
        godFails.set(ip, f); return err(ws, '密码错误');
      }
      godFails.delete(ip);
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
    room.gods.delete(ws); room.watchers.delete(ws);
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
