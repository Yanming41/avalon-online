// 观战位只能拿到公开信息
const WebSocket = require('ws'); const URL = process.argv[2] || 'ws://localhost:3123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const assert = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
const mk = () => new Promise((res) => { const w = new WebSocket(URL); const c = { w, s: null, all: [] }; w.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'state') { c.s = m.s; c.all.push(m.s); } if (m.t === 'joined') c.code = m.code; }); w.on('open', () => res(c)); });
const tx = (c, o) => c.w.send(JSON.stringify(o));
(async () => {
  const cl = []; const tag = 'w' + Date.now();
  for (let i = 0; i < 7; i++) { const c = await mk(); cl.push(c); tx(c, { t: i ? 'join' : 'create', code: cl[0].code, name: 'W' + i, token: tag + i }); await sleep(60); }
  const tv = await mk(); tx(tv, { t: 'watch', code: cl[0].code }); await sleep(80);
  assert(tv.s && tv.s.watch && tv.s.players.length === 7, '观战位进入房间，看到玩家列表');
  assert(tv.s.players.length === 7 && cl[0].s.players.length === 7, '观战位不占玩家位置');
  tx(cl[0], { t: 'settings', settings: { lady: true } }); await sleep(50);
  tx(cl[0], { t: 'start' }); await sleep(150);
  const S = () => cl[0].s, by = (id) => cl.find((c) => c.s.me === id);
  // 打到刺杀环节，过程中检查观战位拿到的所有状态
  let guard = 0;
  while (S().phase !== 'end' && guard++ < 300) {
    const s = S();
    if (s.phase === 'propose') tx(by(s.leader), { t: 'propose', team: s.players.slice(0, s.teamSizes[s.quest]).map((p) => p.id) });
    else if (s.phase === 'vote') cl.forEach((c) => tx(c, { t: 'vote', approve: true }));
    else if (s.phase === 'quest') for (const id of s.team) tx(by(id), { t: 'quest', card: 'S' });
    else if (s.phase === 'lady') { const h = by(s.lady.holder); tx(h, { t: 'lady', id: s.players.find((p) => !s.lady.used.includes(p.id)).id }); }
    else if (s.phase === 'assassin') { const a = by(s.assassin); tx(a, { t: 'suggest', id: s.players[0].id }); await sleep(60); tx(a, { t: 'assassinate', id: a.s.players.find((p) => !a.s.evilTeam.includes(p.id)).id }); }
    await sleep(60);
  }
  const leaked = tv.all.filter((v) => v.phase !== 'end' && (v.myRole || v.allRoles || v.liveVotes || v.evilSuggest || v.evilTeam || v.myPin || v.pins || (v.myChecks && v.myChecks.length)));
  assert(tv.all.length > 10 && leaked.length === 0, `观战位全程没有拿到任何私密信息（检查了 ${tv.all.length} 个状态）`);
  assert(tv.all.some((v) => v.phase === 'assassin'), '观战位能看到刺杀环节');
  assert(tv.s.phase === 'end' && tv.s.allRoles, '结束后观战位看到身份揭晓');
  console.log(fails ? fails + ' 项失败' : '全部通过'); process.exit(fails ? 1 : 0);
})();
