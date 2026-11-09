// 新选项测试：刺客可选 / 队长随机 / 发言起点+方向 / 牧师发车后查 / 巫师单选
const WebSocket = require('ws'); const URL = process.argv[2] || 'ws://localhost:3123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
async function room(n, settings) {
  const cl = []; let code; const tag = Math.random().toString(36).slice(2);
  for (let i = 0; i < n; i++) { const w = new WebSocket(URL); const c = { w, s: null, msgs: [] }; w.on('message', (d) => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') code = m.code; }); await new Promise((r) => w.on('open', r)); cl.push(c); w.send(JSON.stringify({ t: i ? 'join' : 'create', code, name: 'O' + i, token: tag + i })); await sleep(60); }
  const tx = (c, o) => c.w.send(JSON.stringify(o));
  tx(cl[0], { t: 'settings', settings }); await sleep(60); tx(cl[0], { t: 'start' }); await sleep(150);
  return { cl, tx, S: () => cl[0].s, by: (id) => cl.find((c) => c.s.me === id) };
}
async function winThree(R) {
  for (let k = 0; k < 3 && R.S().phase === 'propose'; k++) {
    const s = R.S(); const goods = s.players.map((p) => p.id).filter((id) => !R.by(id).s.myRole.evilNow);
    R.tx(R.by(s.leader), { t: 'propose', team: goods.slice(0, s.teamSizes[s.quest]) }); await sleep(80);
    R.cl.forEach((c) => R.tx(c, { t: 'vote', approve: true })); await sleep(120);
    for (const id of R.S().team) R.tx(R.by(id), { t: 'quest', card: 'S' }); await sleep(150);
  }
}
(async () => {
  { // 不选刺客：随机坏人刺杀
    const R = await room(7, { assassin: false, percival: false, morgana: false });
    ok(!R.cl.some((c) => c.s.myRole.role === 'assassin'), '没选刺客时没人拿到刺客');
    await winThree(R);
    const s = R.S(), a = R.by(s.assassin);
    ok(s.phase === 'assassin' && s.assassinRandom && a && a.s.myRole.evilNow, '好人三胜后随机抽一名坏人当刺杀者');
    const t = a.s.players.find((p) => !a.s.evilTeam.includes(p.id)); R.tx(a, { t: 'assassinate', id: t.id }); await sleep(120);
    ok(R.S().phase === 'end', '随机抽中的坏人可以执行刺杀');
  }
  { // 队长每轮随机
    const R = await room(7, { leaderMode: 'random' });
    const seen = new Set([R.S().leader]); let prev = R.S().leader, repeat = false;
    for (let k = 0; k < 4; k++) { R.tx(R.by(R.S().leader), { t: 'propose', team: R.S().players.slice(0, R.S().teamSizes[R.S().quest]).map((p) => p.id) }); await sleep(70); R.cl.forEach((c) => R.tx(c, { t: 'vote', approve: false })); await sleep(110); if (R.S().leader === prev) repeat = true; prev = R.S().leader; seen.add(prev); }
    ok(!repeat, '随机队长不会连续两次是同一个人');
    const ids = R.S().players.map((p) => p.id), seq = [...seen].map((id) => ids.indexOf(id));
    ok(seen.size >= 2, `随机模式下换了 ${seen.size} 个不同的队长`);
  }
  { // 发言起点 + 方向
    const R = await room(6, {});
    const s = R.S(), ids = s.players.map((p) => p.id), st = ids[3];
    R.tx(R.by(s.leader), { t: 'speechStart', start: st, dir: -1 }); await sleep(100);
    const o = R.S().speech.order;
    ok(o[0] === st && o[1] === ids[2] && o[2] === ids[1] && o.length === 6, '队长指定 4 号开始、逆时针：4→3→2…');
    ok(R.S().speech.ready && !R.S().speech.endsAt, '第一个人等待按开始，不显示时间');
  }
  { // 牧师：首次发车后查发车的队长
    let R, cleric, guard = 0;
    do { R && R.cl.forEach((c) => c.w.close()); R = await room(6, { cleric: true, clericTiming: 'propose' }); cleric = R.cl.find((c) => c.s.myRole.role === 'cleric'); } while (cleric.s.me === R.S().leader && guard++ < 5);
    ok(!cleric.s.myRole.sees.length, '开局时牧师还不知道任何信息');
    const L = R.S().leader; R.tx(R.by(L), { t: 'propose', team: R.S().players.slice(0, 2).map((p) => p.id) }); await sleep(120);
    const saw = cleric.s.myRole.sees.find((x) => x.id === L);
    ok(saw && saw.tag.includes('首次发车的队长'), '首次发车后牧师得知发车队长的阵营');
  }
  { // 巫师单独选
    const R = await room(6, { good_sorcerer: true, evil_sorcerer: false, percival: false, morgana: false });
    const roles = R.cl.map((c) => c.s.myRole.role);
    ok(roles.includes('good_sorcerer') && !roles.includes('evil_sorcerer'), '只选正义巫师时只有正义巫师');
  }
  console.log(fails ? fails + ' 项失败' : '全部通过'); process.exit(fails ? 1 : 0);
})();
