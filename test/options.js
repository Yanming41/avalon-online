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
  { // 队长洗牌轮换：5 人局两轮共 10 次队长，每轮 5 人不重复，跨轮不连续同一人
    const R = await room(5, { leaderMode: 'random' });
    const log = [R.S().leader]; let repeat = false;
    const rejectStep = async () => {
      const s = R.S(), prev = s.leader;
      R.tx(R.by(prev), { t: 'propose', team: s.players.slice(0, s.teamSizes[s.quest]).map((p) => p.id) }); await sleep(70);
      R.cl.forEach((c) => R.tx(c, { t: 'vote', approve: false })); await sleep(110);
      if (R.S().leader === prev) repeat = true;
      log.push(R.S().leader);
    };
    for (let k = 0; k < 4; k++) await rejectStep();
    ok(new Set(log.slice(0, 5)).size === 5, '洗牌轮换第 1 轮 5 名玩家各当过 1 次队长');
    const s = R.S(), prev = s.leader, goods = s.players.map((p) => p.id).filter((id) => !R.by(id).s.myRole.evilNow);
    R.tx(R.by(prev), { t: 'propose', team: goods.slice(0, s.teamSizes[s.quest]) }); await sleep(70);
    R.cl.forEach((c) => R.tx(c, { t: 'vote', approve: true })); await sleep(100);
    for (const id of R.S().team) R.tx(R.by(id), { t: 'quest', card: 'S' }); await sleep(130);
    if (R.S().leader === prev) repeat = true;
    log.push(R.S().leader);
    for (let k = 0; k < 4; k++) await rejectStep();
    ok(new Set(log.slice(5, 10)).size === 5, '洗牌轮换第 2 轮重新洗牌后 5 名玩家再次各当 1 次队长');
    ok(!repeat, '洗牌轮换全过程（含跨轮边界）不会连续两次是同一个人');
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
  { // 投屏大屏控制发言（观众席不能）
    const R = await room(6, {});
    const code = R.S().code, ids = R.S().players.map((p) => p.id);
    const tv = new WebSocket(URL), spec = new WebSocket(URL);
    await Promise.all([new Promise((r) => tv.on('open', r)), new Promise((r) => spec.on('open', r))]);
    let tvS = null, specErr = null;
    tv.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'state') tvS = m.s; });
    spec.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'error') specErr = m.m; });
    tv.send(JSON.stringify({ t: 'watch', code })); spec.send(JSON.stringify({ t: 'watch', code, name: '路人' })); await sleep(100);
    spec.send(JSON.stringify({ t: 'speechStart', start: ids[0], dir: 1 })); await sleep(80);
    ok(!tvS.speech && specErr, '观众席不能控制发言');
    tv.send(JSON.stringify({ t: 'speechStart', start: ids[1], dir: 1 })); await sleep(80);
    ok(tvS.speech && tvS.speech.order[0] === ids[1] && tvS.speech.ready, '大屏可以开始轮流发言');
    tv.send(JSON.stringify({ t: 'speechGo' })); await sleep(80);
    ok(tvS.speech && !tvS.speech.ready && tvS.speech.endsAt > Date.now(), '大屏可以替发言人开始计时');
    tv.send(JSON.stringify({ t: 'speechNext' })); await sleep(80);
    ok(tvS.speech && tvS.speech.idx === 1 && tvS.speech.ready, '大屏可以点下一位');
    tv.send(JSON.stringify({ t: 'speechNext' })); await sleep(80);
    ok(tvS.speech && tvS.speech.idx === 2 && tvS.speech.ready, '大屏可以跳过准备中的发言人');
    tv.send(JSON.stringify({ t: 'speechStop' })); await sleep(80);
    ok(!tvS.speech, '大屏可以结束发言');
    tv.close(); spec.close();
  }
  { // 投票计时超时直接同意 + 刺杀计时超时随机刺
    const R = await room(5, { voteSecs: 1, assassinSecs: 1, percival: false, morgana: false });
    const s = R.S(), goods = s.players.map((p) => p.id).filter((id) => !R.by(id).s.myRole.evilNow);
    R.tx(R.by(s.leader), { t: 'propose', team: goods.slice(0, s.teamSizes[0]) }); await sleep(80);
    ok(R.S().phase === 'vote' && R.S().voteSecs === 1 && R.S().voteEndsAt > Date.now(), '发车投票显示倒计时');
    R.tx(R.cl[0], { t: 'vote', approve: false }); // 只投 1 人反对，其余 4 人超时自动同意
    await sleep(1400);
    const hv = R.S().history.find((h) => h.type === 'vote');
    ok(R.S().phase === 'quest' && hv && hv.auto && Object.values(hv.votes).filter(Boolean).length === 4, '投票超时后未投玩家自动投同意并进入任务');
    // 禁用投票限时快速推满 3 次任务进入 1 秒刺杀倒计时
    for (const id of R.S().team) R.tx(R.by(id), { t: 'quest', card: 'S' }); await sleep(120);
    for (let k = 0; k < 2; k++) {
      const cur = R.S();
      R.tx(R.by(cur.leader), { t: 'propose', team: goods.slice(0, cur.teamSizes[cur.quest]) }); await sleep(70);
      R.cl.forEach((c) => R.tx(c, { t: 'vote', approve: true })); await sleep(90);
      for (const id of R.S().team) R.tx(R.by(id), { t: 'quest', card: 'S' }); await sleep(120);
    }
    ok(R.S().phase === 'assassin' && R.S().assassinSecs === 1, '3 胜进入 1 秒刺杀计时');
    await sleep(1400);
    ok(R.S().phase === 'end' && R.S().assassinTarget && R.S().reason.includes('超时随机'), '刺杀超时后自动随机刺杀一名好人并结束对局');
  }
  { // 湖中仙女计时超时自动随机查验
    const R = await room(6, { lady: true, ladySecs: 1, voteSecs: 0, percival: false, morgana: false });
    const runQuest = async () => {
      const s = R.S();
      R.tx(R.by(s.leader), { t: 'propose', team: s.players.slice(0, s.teamSizes[s.quest]).map((p) => p.id) }); await sleep(70);
      R.cl.forEach((c) => R.tx(c, { t: 'vote', approve: true })); await sleep(90);
      for (const id of R.S().team) R.tx(R.by(id), { t: 'quest', card: 'S' }); await sleep(120);
    };
    await runQuest(); // 第 1 轮后不用
    ok(R.S().phase === 'propose' && R.S().quest === 1, '第 1 轮后直接进第 2 轮');
    await runQuest(); // 第 2 轮后进湖中仙女
    const oldHolder = R.S().lady.holder;
    ok(R.S().phase === 'lady' && R.S().lady.secs === 1 && R.S().lady.endsAt > Date.now(), '第 2 轮后进入 1 秒湖中仙女倒计时');
    await sleep(1400);
    const s2 = R.S();
    ok(s2.phase === 'propose' && s2.quest === 2 && s2.lady.holder !== oldHolder, '湖中仙女超时后自动随机查验并移交仙女进入下一轮');
    ok(R.by(oldHolder).s.myChecks.length === 1 && s2.history.some((h) => h.type === 'lady' && h.auto), '原持有人私密收到查验结果且复盘标超时随机');
  }
  console.log(fails ? fails + ' 项失败' : '全部通过'); process.exit(fails ? 1 : 0);
})();
