// 上帝多视角 + 机器人 + 防暴力破解测试
const WebSocket = require('ws'); const URL = process.argv[2] || 'ws://localhost:3123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const assert = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
const mk = () => new Promise((res) => { const w = new WebSocket(URL); const c = { w, s: null, msgs: [] }; w.on('message', (d) => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') c.code = m.code; }); w.on('open', () => res(c)); });
const tx = (c, o) => c.w.send(JSON.stringify(o));
(async () => {
  const me = await mk(); tx(me, { t: 'create', name: '房主', token: 'gv' + Date.now() }); await sleep(100);
  const g = await mk(); tx(g, { t: 'god', code: me.code, password: 'test' }); await sleep(100);
  tx(g, { t: 'g', a: 'addBots', n: 7 }); await sleep(100);
  assert(g.s.players.length === 7, '加机器人补满 7 人');
  tx(me, { t: 'start' }); await sleep(150);
  const bot = g.s.players.find((p) => p.name.startsWith('机器人')).id;
  tx(g, { t: 'g', a: 'viewAs', id: bot }); await sleep(100);
  assert(g.s.viewAs === bot && g.s.me === bot && g.s.myRole && !g.s.allRoles, '代入后看到的是该玩家的视角（看不到全部身份）');
  assert(g.s.roster.length === 7, '代入时仍有身份名单可切换');
  const leader = g.s.leader; tx(g, { t: 'g', a: 'viewAs', id: leader }); await sleep(100);
  tx(g, { t: 'g', a: 'as', msg: { t: 'propose', team: g.s.players.slice(0, 2).map((p) => p.id) } }); await sleep(100);
  assert(g.s.phase === 'vote', '代入队长替他发车');
  for (const p of g.s.players) { tx(g, { t: 'g', a: 'viewAs', id: p.id }); await sleep(40); tx(g, { t: 'g', a: 'as', msg: { t: 'vote', approve: true } }); await sleep(40); }
  await sleep(100);
  assert(g.s.phase === 'quest', '逐个代入投票后进入任务');
  tx(g, { t: 'g', a: 'viewAs', id: null }); await sleep(100);
  assert(g.s.allRoles && !g.s.viewAs, '切回上帝视角');
  const x = await mk(); for (let i = 0; i < 6; i++) { tx(x, { t: 'god', code: me.code, password: 'bad' + i }); await sleep(30); }
  tx(x, { t: 'god', code: me.code, password: 'test' }); await sleep(80);
  assert(x.msgs.at(-1).m && x.msgs.at(-1).m.includes('次数太多'), '输错 5 次后锁定（正确密码也拒绝）');
  console.log(fails ? fails + ' 项失败' : '全部通过'); process.exit(fails ? 1 : 0);
})();
