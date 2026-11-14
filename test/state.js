// 续存测试：排座交换 → 开局 → 发言计时中 → 等快照写盘 → 杀掉服务器重启 → 同 token 重连，房间/座位/对局/发言都还在
const WebSocket = require('ws'); const { spawn } = require('child_process'); const path = require('path'); const fs = require('fs');
const port = 3144, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cwd = path.resolve(__dirname, '..'), env = { ...process.env, PORT: String(port), RECORDS_GITHUB_TOKEN: '', RECORDS_REPO: '' };
try { fs.unlinkSync(path.join(cwd, 'data', 'rooms.json')); } catch {}
const boot = async () => { const s = spawn(process.execPath, ['server.js'], { cwd, env, stdio: 'ignore' }); await sleep(900); return s; };
const conn = async (o) => { const w = new WebSocket(`ws://127.0.0.1:${port}`); const c = { w, s: null, err: [] }; w.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') c.code = m.code; if (m.t === 'error') c.err.push(m.m); }); await new Promise((r) => w.on('open', r)); w.send(JSON.stringify(o)); await sleep(120); return c; };
const ok = (b, m) => console.log((b ? 'ok   ' : 'FAIL ') + m);
(async () => {
  let srv = await boot(); const tag = 'st' + Date.now(); const cl = [];
  cl.push(await conn({ t: 'create', name: 'P0', avatar: 'lion', token: tag + 0 })); const code = cl[0].code;
  for (let i = 1; i < 6; i++) cl.push(await conn({ t: 'join', code, name: 'P' + i, avatar: 'wolf', token: tag + i }));
  const ids = () => cl[0].s.players.map((p) => p.name).join(',');
  cl[3].w.send(JSON.stringify({ t: 'seat', a: cl[0].s.players[0].id, b: cl[0].s.players[4].id })); await sleep(200);
  ok(ids() === 'P4,P1,P2,P3,P0,P5', '排座交换 ' + ids());
  cl[0].w.send(JSON.stringify({ t: 'start' })); await sleep(200);
  cl[2].w.send(JSON.stringify({ t: 'seat', a: cl[0].s.players[0].id, b: cl[0].s.players[1].id })); await sleep(200);
  ok(ids() === 'P4,P1,P2,P3,P0,P5', '开局后不能再换座');
  const s = cl[0].s, leader = cl.find((c) => c.s.me === s.leader);
  leader.w.send(JSON.stringify({ t: 'speechStart', start: s.players[1].id, dir: 1 })); await sleep(150);
  const spk = cl.find((c) => c.s.me === cl[0].s.speech.order[0]); spk.w.send(JSON.stringify({ t: 'speechGo' })); await sleep(150);
  const before = { phase: cl[0].s.phase, leader: cl[0].s.leader, role: cl[1].s.myRole && cl[1].s.myRole.role, endsAt: cl[0].s.speech.endsAt, gid: cl[0].s.gameId };
  await sleep(3600);
  srv.kill(); cl.forEach((c) => c.w.terminate()); await sleep(500);
  srv = await boot();
  const c1 = await conn({ t: 'join', code, name: 'P1', avatar: 'wolf', token: tag + 1 }); await sleep(200);
  ok(!c1.err.length && c1.s, '重启后房间还在 ' + c1.err.join());
  if (c1.s) {
    ok(c1.s.gameId === before.gid && c1.s.phase === before.phase && c1.s.leader === before.leader, '对局/阶段/队长一致');
    ok(c1.s.myRole && c1.s.myRole.role === before.role, '身份不变');
    ok(c1.s.players.map((p) => p.name).join(',') === 'P4,P1,P2,P3,P0,P5', '座位顺序保留');
    ok(c1.s.speech && c1.s.speech.endsAt === before.endsAt, '发言计时接着走');
  }
  srv.kill(); process.exit(0);
})();
