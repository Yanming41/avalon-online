// 13 人局 + 自定义任务人数。用法：先起服务器，再 node test/big.js ws://127.0.0.1:端口
const W = require('ws'); const url = process.argv[2] || 'ws://127.0.0.1:3123';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const mk = () => new Promise((r) => { const w = new W(url); w.s = null; w.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'state') w.s = m.s || m; }); w.on('open', () => r(w)); });
const tx = (w, m) => w.send(JSON.stringify(m)); const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const ps = [];
  const h = await mk(); tx(h, { t: 'create', name: 'P0', avatar: 0, token: 'b0' + Date.now() }); await wait(400); ps.push(h);
  const code = h.s.code;
  for (let i = 1; i < 13; i++) { const w = await mk(); tx(w, { t: 'join', code, name: 'P' + i, avatar: 0, token: 'b' + i + Date.now() }); ps.push(w); }
  await wait(800);
  ok(h.s.players.length === 13, '能进 13 人：' + h.s.players.length);
  ok(JSON.stringify(h.s.defaultTeam) === '[4,5,6,6,7]' && h.s.evilTotal === 5, '13 人推荐 4,5,6,6,7 / 5 坏人');
  tx(h, { t: 'settings', settings: { teamSizes: [3, 4, 5, 6, 8] } }); await wait(300);
  tx(h, { t: 'start' }); await wait(800);
  ok(h.s.phase && h.s.phase !== 'lobby', '13 人能开局：' + h.s.phase);
  ok(JSON.stringify(h.s.teamSizes) === '[3,4,5,6,8]', '自定义任务人数生效：' + h.s.teamSizes);
  console.log(fails ? fails + ' 项失败' : '全部通过'); process.exit(fails ? 1 : 0);
})();
