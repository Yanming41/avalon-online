// 账号系统测试：自带一个假的 Supabase（验证 token、读资料、收对局记录），不需要真项目
// 用法：node test/accounts.js   （会自己起服务器，端口 3127 / 54329）
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const assert = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };

const SB_PORT = 54329, PORT = 3127, SB = `http://127.0.0.1:${SB_PORT}`;
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
const profiles = {
  [A]: { id: A, username: 'peter.wu', display_name: 'Peter', avatar_url: `${SB}/storage/v1/object/public/avatars/${A}/1.webp`, crest: null },
  [B]: { id: B, username: 'mia_7', display_name: 'Mia', avatar_url: null, crest: 'owl' },
};
const tokens = { 'tok-a': A, 'tok-a2': A, 'tok-b': B };
const posted = { games: [], game_players: [] };
const mock = http.createServer((req, res) => {
  let body = ''; req.on('data', (d) => (body += d)); req.on('end', () => {
    const u = new URL(req.url, SB);
    const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/auth/v1/user') {
      const id = tokens[(req.headers.authorization || '').replace('Bearer ', '')];
      return id ? json(200, { id }) : json(401, { msg: 'invalid JWT' });
    }
    if (req.headers.apikey !== 'sb_secret_test') return json(401, { msg: 'need service key' });
    if (req.headers.authorization) return json(401, { msg: 'sb_ keys must not be sent as Bearer' });
    if (u.pathname === '/rest/v1/profiles') { const id = (u.searchParams.get('id') || '').replace('eq.', ''); return json(200, profiles[id] ? [profiles[id]] : []); }
    if (u.pathname === '/rest/v1/games' || u.pathname === '/rest/v1/game_players') { posted[u.pathname.split('/').pop()].push(JSON.parse(body)); return json(201, {}); }
    json(404, {});
  });
});

function mk() {
  return new Promise((res) => {
    const w = new WebSocket(`ws://127.0.0.1:${PORT}`); const c = { w, s: null, msgs: [] };
    w.on('message', (d) => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') c.code = m.code; });
    w.on('open', () => res(c));
  });
}
const tx = (c, o) => c.w.send(JSON.stringify(o));
const lastErr = (c) => [...c.msgs].reverse().find((m) => m.t === 'error');

(async () => {
  await new Promise((r) => mock.listen(SB_PORT, r));
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT, GOD_PASSWORD: 'test', SUPABASE_URL: SB, SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', AUTH_PROVIDERS: 'google, Bad Name!', RECORDS_GITHUB_TOKEN: '', RECORDS_REPO: '' },
    cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((r) => srv.stdout.on('data', (d) => { if (String(d).includes('Avalon on')) r(); }));
  try {
    const cfg = await (await fetch(`http://127.0.0.1:${PORT}/api/config`)).json();
    assert(cfg.url === SB && cfg.anonKey === 'anon-key' && !JSON.stringify(cfg).includes('sb_secret_test'), '/api/config 只给公开 key，不泄露 service key');
    assert(JSON.stringify(cfg.providers) === '["google"]', '第三方登录列表会过滤掉不合法的名字');

    const a = await mk(); tx(a, { t: 'create', name: 'whatever', token: 'dev-a', auth: 'tok-a' }); await sleep(150);
    const code = a.code, me = a.s.players.find((p) => p.id === a.s.me);
    assert(me.name === 'Peter' && me.username === 'peter.wu', '登录建房：昵称和用户名来自服务器读到的资料（客户端填的名字被忽略）');
    assert(me.avatar === profiles[A].avatar_url, '上传的头像地址会显示给大家');

    const bad = await mk(); tx(bad, { t: 'join', code, name: 'x', token: 'dev-x', auth: 'forged' }); await sleep(100);
    assert(lastErr(bad) && lastErr(bad).m.includes('登录已过期'), '伪造 / 过期的登录凭证被拒绝');

    const g1 = await mk(); tx(g1, { t: 'join', code, name: 'Peter', token: 'dev-g1' }); await sleep(100);
    assert(lastErr(g1) && lastErr(g1).m.includes('@peter.wu'), '游客不能用登录玩家的昵称顶替他的座位');

    const b = await mk(); tx(b, { t: 'join', code, name: 'zzz', token: 'dev-b', auth: 'tok-b' }); await sleep(100);
    const bp = b.s.players.find((p) => p.id === b.s.me);
    assert(bp.name === 'Mia' && bp.avatar === 'owl', '没上传头像时用资料里选的纹章');

    tx(b, { t: 'profile', avatar: 'https://evil.example.com/x.png' }); await sleep(80);
    assert(b.s.players.find((p) => p.id === b.s.me).avatar === 'owl', '不接受外站图片当头像');
    tx(b, { t: 'profile', avatar: `${SB}/storage/v1/object/public/avatars/${B}/2.webp` }); await sleep(80);
    assert(b.s.players.find((p) => p.id === b.s.me).avatar.endsWith('/2.webp'), '接受自己项目头像桶里的图片');

    profiles[B].display_name = 'Mia2'; tx(b, { t: 'refreshProfile', auth: 'tok-b' }); await sleep(100);
    assert(b.s.players.find((p) => p.id === b.s.me).name === 'Mia2', '在大厅改了昵称，刷新后房间里立刻更新');
    profiles[B].display_name = 'Peter'; tx(b, { t: 'refreshProfile', auth: 'tok-b' }); await sleep(100);
    assert(b.s.players.find((p) => p.id === b.s.me).name === 'Mia2' && lastErr(b).m.includes('昵称暂时没换'), '改成房间里别人的昵称会被挡住');
    profiles[B].display_name = 'Mia';

    const guests = [];
    for (let i = 0; i < 3; i++) { const g = await mk(); tx(g, { t: 'join', code, name: 'Guest' + i, token: 'dev-guest' + i }); guests.push(g); await sleep(60); }
    tx(a, { t: 'start' }); await sleep(150);
    assert(a.s.phase === 'propose' && a.s.players.length === 5, '登录玩家和游客一起开局');

    // 换手机：同一个账号、新设备 token，直接回到原座位，身份不变
    const role = a.s.myRole.role, seatId = a.s.me;
    a.w.close(); await sleep(100);
    const a2 = await mk(); tx(a2, { t: 'join', code, name: 'anything', token: 'dev-a-phone2', auth: 'tok-a2' }); await sleep(150);
    assert(a2.s && a2.s.me === seatId && a2.s.myRole.role === role, '登录同一账号换手机：回到原座位，身份不变');

    const god = await mk(); tx(god, { t: 'god', code, password: 'test' }); await sleep(80);
    tx(god, { t: 'g', a: 'end', winner: 'good' }); await sleep(300);
    assert(posted.games.length === 1 && posted.games[0].winner === 'good' && posted.games[0].player_count === 5, '对局结束写入 games');
    const rows = posted.game_players[0] || [];
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    assert(rows.length === 5 && byName.Peter.user_id === A && byName.Mia2.user_id === B && byName.Guest0.user_id === null, '每位玩家一行；游客 user_id 为空');
    assert(rows.every((r) => r.won === !r.evil), '胜负按阵营算对');
    assert(posted.games[0].record.players.some((p) => p.username === 'peter.wu') && !JSON.stringify(posted.games[0].record).includes('dev-a'), '记录里有用户名，没有设备 token');
  } finally {
    srv.kill(); mock.close();
    console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
    process.exit(fails ? 1 : 0);
  }
})();
