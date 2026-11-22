// 隐私：昵称里的邮箱被去掉；纯邮箱昵称被拒；别人的账号用户名不下发。用法：node test/privacy.js ws://127.0.0.1:端口
const W = require('ws'); const url = process.argv[2] || 'ws://127.0.0.1:3123';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const mk = () => new Promise((r) => { const w = new W(url); w.s = null; w.msgs = []; w.on('message', (d) => { const m = JSON.parse(d); w.msgs.push(m); if (m.t === 'state') w.s = m.s || m; }); w.on('open', () => r(w)); });
const tx = (w, m) => w.send(JSON.stringify(m)); const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const a = await mk(); tx(a, { t: 'create', name: '阿明 a@b.co', avatar: 0, token: 'pa' + Date.now() }); await wait(400);
  ok(a.s && a.s.players[0].name === '阿明', '昵称里的邮箱被去掉：' + (a.s && a.s.players[0].name));
  const b = await mk(); tx(b, { t: 'join', code: a.s.code, name: 'bob@gmail.com', avatar: 0, token: 'pb' + Date.now() }); await wait(400);
  ok(!b.s && b.msgs.some((m) => /邮箱/.test(m.m || '')), '纯邮箱昵称被拒');
  const json = JSON.stringify(a.msgs);
  ok(!/@[a-z]+\.[a-z]/i.test(json), '下发给玩家的数据里没有邮箱');
  console.log(fails ? fails + ' 项失败' : '全部通过'); process.exit(fails ? 1 : 0);
})();
