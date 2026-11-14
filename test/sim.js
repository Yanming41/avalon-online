// 用法：先 GOD_PASSWORD=test PORT=3123 npm start，再 node test/sim.js [ws地址]
const WebSocket = require('ws');
const URL = process.argv[2] || 'ws://localhost:3123';
const N = 7, cl = []; let code; const tag = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exit(1); } else console.log('ok  ', m); };
function mk(i, token) {
  return new Promise((res) => {
    const w = new WebSocket(URL); const c = { w, s: null, i, msgs: [] };
    w.on('message', (d) => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') code = m.code; });
    w.on('open', () => res(c));
  });
}
const tx = (c, o) => c.w.send(JSON.stringify(o));
(async () => {
  for (let i = 0; i < N; i++) { const c = await mk(i); cl.push(c); tx(c, { t: i ? 'join' : 'create', code, name: 'P' + i, avatar: '🐺', token: 't' + tag + i }); await sleep(80); }
  const S = () => cl[0].s, by = (id) => cl.find((c) => c.s.me === id);
  tx(cl[0], { t: 'settings', settings: { mordred: true, speechSecs: 15 } }); await sleep(50);
  tx(cl[0], { t: 'start' }); await sleep(150);
  assert(cl.every((c) => c.s.myRole), '每人都拿到身份');
  // 发言
  tx(by(S().leader), { t: 'speechStart' }); await sleep(80);
  assert(S().speech && S().speech.idx === 0 && S().speech.order.at(-1) === S().leader, '发言轮开始，队长最后');
  tx(by(S().speech.order[0]), { t: 'speechNext' }); await sleep(80);
  assert(S().speech.idx === 1, '说完了切到下一位');
  // 换设备重连：房间号 + 原昵称；原玩家在线时拒绝
  const victim = cl[2], role = victim.s.myRole.role;
  const nc = await mk(99); tx(nc, { t: 'join', code, name: 'P2', token: 'newdev' + tag }); await sleep(100);
  assert(nc.msgs.some((m) => m.t === 'error' && m.m.includes('正在线上')), '原玩家在线时，同名加入被拒（防冒名）');
  victim.w.close(); await sleep(200);
  tx(nc, { t: 'join', code, name: 'P2', token: 'newdev' + tag }); await sleep(150);
  assert(nc.s && nc.s.myRole.role === role, '原玩家掉线后，用房间号 + 昵称找回原身份');
  cl[2] = nc;
  // 上帝
  const g = await mk(-1); tx(g, { t: 'god', code, password: 'wrong' }); await sleep(80);
  assert(g.msgs.some((m) => m.m === '密码错误'), '上帝密码错误被拒');
  tx(g, { t: 'god', code, password: 'test' }); await sleep(100);
  assert(g.s && g.s.god && g.s.allRoles.length === N, '上帝看到全部身份');
  const someone = S().players[0].id; tx(g, { t: 'g', a: 'leader', id: someone }); await sleep(80);
  assert(S().leader === someone, '上帝改队长');
  assert(!S().allRoles, '普通玩家看不到全部身份');
  // 跑完整局
  let guard = 0;
  while (S().phase !== 'end' && guard++ < 400) {
    const s = S();
    if (s.phase === 'propose') tx(by(s.leader), { t: 'propose', team: s.players.slice(0, s.teamSizes[s.quest]).map((p) => p.id) });
    else if (s.phase === 'vote') for (const c of cl) tx(c, { t: 'vote', approve: Math.random() < 0.6 });
    else if (s.phase === 'quest') for (const id of s.team) tx(by(id), { t: 'quest', success: Math.random() < 0.5 });
    else if (s.phase === 'assassin') {
      const a = by(s.assassin); assert(a.s.evilTeam && a.s.evilTeam.length === 3, '刺杀环节坏人互相可见');
      assert(s.assassinEndsAt > Date.now() + 100e3 && s.assassinSecs === 120, '刺杀计时默认 2 分钟');
      const t = a.s.players.find((p) => !a.s.evilTeam.includes(p.id)); tx(a, { t: 'assassinate', id: t.id });
    }
    await sleep(60);
  }
  assert(S().phase === 'end', `结束：${S().reason}`);
  assert(S().history.filter((h) => h.type === 'vote').every((h) => Object.keys(h.votes).length === N), '每次发车都有完整票型');
  process.exit(0);
})();
