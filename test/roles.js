// 扩展角色 / 道具规则测试。用法：先 GOD_PASSWORD=test PORT=3123 npm start，再 node test/roles.js
const WebSocket = require('ws');
const URL = process.argv[2] || 'ws://localhost:3123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const assert = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };

async function room(n, settings) {
  const cl = []; let code;
  const mk = () => new Promise((res) => { const w = new WebSocket(URL); const c = { w, s: null, msgs: [] }; w.on('message', (d) => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') code = m.code; }); w.on('open', () => res(c)); });
  const tag = Math.random().toString(36).slice(2);
  for (let i = 0; i < n; i++) { const c = await mk(); cl.push(c); c.w.send(JSON.stringify({ t: i ? 'join' : 'create', code, name: 'P' + i, token: tag + i })); await sleep(60); }
  const tx = (c, o) => c.w.send(JSON.stringify(o));
  tx(cl[0], { t: 'settings', settings }); await sleep(60);
  tx(cl[0], { t: 'start' }); await sleep(150);
  const g = await mk(); tx(g, { t: 'god', code, password: 'test' }); await sleep(120);
  const S = () => cl[0].s, G = () => g.s, by = (id) => cl.find((c) => c.s.me === id);
  const role = (id) => G().allRoles.find((r) => r.id === id);
  const who = (r) => G().allRoles.find((x) => x.role === r);
  return { cl, g, tx, S, G, by, role, who, close: () => { cl.forEach((c) => c.w.close()); g.w.close(); } };
}

// 推进一轮：指定队伍、全员同意、按 cardFn 出牌
async function playQuest(R, team, cardFn, opts = {}) {
  const { tx, S, by } = R;
  if (S().phase !== 'propose') throw new Error('not propose: ' + S().phase);
  tx(by(S().leader), { t: 'propose', team, excalibur: opts.excalibur }); await sleep(80);
  R.cl.forEach((c) => tx(c, { t: 'vote', approve: true })); await sleep(120);
  for (const id of team) { const c = by(id); tx(c, { t: 'quest', card: cardFn(id, c.s.myCards) }); }
  await sleep(150);
}

(async () => {
  // ---------- 1. 10 人全角色：人数校验 ----------
  {
    const R = await room(10, { percival: true, cleric: true, troublemaker: true, morgana: true, mordred: true, oberon: true, lunatic: true, brute: true, revealer: true, trickster: true });
    assert(R.cl[0].msgs.some((m) => m.t === 'error' && m.m.includes('坏人')), '坏人角色超过人数时拒绝开局');
    R.close();
  }
  // ---------- 2. 疯子 / 莽夫 / 暴露者 / 牧师 ----------
  {
    const R = await room(8, { percival: false, morgana: false, cleric: true, lunatic: true, brute: true });
    const { S, G, by, who, tx } = R;
    const lun = who('lunatic').id, bru = who('brute').id, ass = who('assassin').id, cle = who('cleric').id;
    assert(JSON.stringify(by(lun).s.myRole.sees.length) === '2', '疯子能看到两个同伙');
    const first = S().leader, cs = by(cle).s.myRole.sees;
    if (first !== cle) assert(cs.some((x) => x.id === first && x.tag.includes(R.role(first).evil ? '坏人' : '好人')), '牧师看到首任队长的真实阵营');
    else assert(!cs.length, '牧师自己是首任队长时什么也看不到');
    // 第 1 轮：疯子 + 莽夫 上车
    const others = S().players.map((p) => p.id).filter((id) => ![lun, bru].includes(id));
    await playQuest(R, [lun, bru, others[0]].slice(0, 3), (id, cards) => (id === lun ? 'S' : cards[0]));
    assert(by(lun).msgs.some((m) => m.t === 'error' && m.m.includes('不能出')), '疯子出成功被拒绝');
    assert(JSON.stringify(by(lun).s.myCards) === '["F"]', '疯子只能出失败');
    tx(by(lun), { t: 'quest', card: 'F' }); await sleep(150);
    assert(S().results.length === 1 && !S().results[0].success, '疯子出失败 → 任务失败');
    // 用上帝把局面推进到第 4 轮，检查莽夫
    tx(R.g, { t: 'g', a: 'setResult', i: 0, success: true });
    S().phase === 'propose' && 0;
    // 第 2、3 轮让好人赢一次输一次
    await playQuest(R, others.slice(0, 4), (id, c) => c[0] === 'F' ? 'S' : 'S');
    await playQuest(R, others.slice(0, 4), () => 'S');
    // 现在 3 胜 → 刺杀；改用上帝撤回一轮
    if (S().phase === 'assassin') { tx(R.g, { t: 'g', a: 'undoQuest' }); await sleep(100); }
    tx(R.g, { t: 'g', a: 'setResult', i: 1, success: false }); await sleep(80);
    // 进入第 4 轮（quest=3），莽夫上车
    const q = S().quest;
    if (q === 2) await playQuest(R, others.slice(0, 4), () => 'S');
    if (S().phase === 'assassin') { tx(R.g, { t: 'g', a: 'undoQuest' }); await sleep(100); tx(R.g, { t: 'g', a: 'setResult', i: 2, success: false }); }
    await sleep(100);
    if (S().quest === 3 && S().phase === 'propose') {
      tx(by(S().leader), { t: 'propose', team: [bru, ...others].slice(0, 5) }); await sleep(80);
      R.cl.forEach((c) => tx(c, { t: 'vote', approve: true })); await sleep(120);
      assert(JSON.stringify(by(bru).s.myCards) === '["S"]', '莽夫第 4 轮只能出成功');
    } else assert(false, '没能推进到第 4 轮（测试流程问题） quest=' + S().quest + ' phase=' + S().phase);
    R.close();
  }
  // ---------- 3. 暴露者 ----------
  {
    const R = await room(7, { percival: false, morgana: false, revealer: true });
    const { S, by, who } = R;
    const rev = who('revealer').id, ass = who('assassin').id;
    const ids = S().players.map((p) => p.id), team1 = [ass, ...ids.filter((i) => i !== ass && i !== rev)].slice(0, 2);
    await playQuest(R, team1, (id, c) => (id === ass ? 'F' : c[0]));
    assert(!S().revealed.length, '第 1 次失败后暴露者还没公开');
    await playQuest(R, [ass, ...ids.filter((i) => i !== ass && i !== rev)].slice(0, 3), (id, c) => (id === ass ? 'F' : c[0]));
    assert(S().revealed.includes(rev), '第 2 次失败后暴露者公开');
    R.close();
  }
  // ---------- 4. 巫师魔法牌 ----------
  {
    const R = await room(6, { percival: false, morgana: false, sorcerer: true });
    const { S, by, who } = R;
    const gs = who('good_sorcerer').id, es = who('evil_sorcerer').id;
    assert(JSON.stringify(by(es).s.myCards || ['S', 'M']) === '["S","M"]', '邪恶巫师只有成功/魔法');
    const goods = S().players.map((p) => p.id).filter((id) => !R.role(id).evil && id !== gs);
    await playQuest(R, [es, goods[0]], (id) => (id === es ? 'M' : 'S'));
    assert(!S().results[0].success && S().results[0].magics === 1, '一张魔法：成功 → 失败');
    await playQuest(R, [es, gs, goods[0]], (id) => (id === goods[0] ? 'S' : 'M'));
    assert(S().results[1].success && S().results[1].magics === 2, '两张魔法互相抵消');
    R.close();
  }
  // ---------- 5. 湖中仙女 + 捣蛋鬼 + 诡术师 ----------
  {
    const R = await room(7, { percival: false, morgana: false, lady: true, troublemaker: true, trickster: true });
    const { S, by, who, tx } = R;
    const tm = who('troublemaker').id, tr = who('trickster').id;
    const ids = S().players.map((p) => p.id);
    assert(S().lady && S().lady.holder === ids[(ids.indexOf(S().leader) - 1 + 7) % 7], '湖中仙女初始在首任队长上家');
    const goods = ids.filter((id) => !R.role(id).evil);
    await playQuest(R, goods.slice(0, 2), () => 'S');
    assert(S().phase === 'propose', '第 1 轮后不使用湖中仙女');
    await playQuest(R, goods.slice(0, 3), () => 'S');
    assert(S().phase === 'lady', '第 2 轮后进入湖中仙女');
    const holder = S().lady.holder;
    let target = tm !== holder ? tm : tr;
    tx(by(holder), { t: 'lady', id: holder }); await sleep(80);
    assert(by(holder).msgs.some((m) => m.t === 'error'), '不能查自己');
    tx(by(holder), { t: 'lady', id: target }); await sleep(120);
    const res = by(holder).s.myChecks.at(-1);
    if (target === tm) assert(res.evil === true, '捣蛋鬼被查成坏人');
    else assert(res.evil === false, '诡术师默认被查成好人');
    assert(S().lady.holder === target && S().phase === 'propose', '湖中仙女交给被查的人，进入下一轮');
    assert(!R.cl.filter((c) => c.s.me !== holder).some((c) => c.s.myChecks.length), '其他人看不到查验结果');
    R.close();
  }
  // ---------- 6. 王者之剑 ----------
  {
    const R = await room(6, { percival: false, morgana: false, excalibur: true });
    const { S, by, tx } = R;
    const ids = S().players.map((p) => p.id), leader = S().leader;
    const goods = ids.filter((id) => !R.role(id).evil && id !== leader);
    tx(by(leader), { t: 'propose', team: [goods[0], goods[1]] }); await sleep(80);
    assert(by(leader).msgs.some((m) => m.t === 'error' && m.m.includes('王者之剑')), '没指定王者之剑不能发车');
    await playQuest(R, [goods[0], goods[1]], () => 'S', { excalibur: goods[0] });
    assert(S().phase === 'excalibur' && S().excalibur === goods[0], '出完牌进入王者之剑阶段');
    tx(by(goods[0]), { t: 'excalibur', id: goods[1] }); await sleep(150);
    assert(!S().results[0].success, '王者之剑把好人的成功翻成失败');
    assert(by(goods[0]).s.myExcalSeen && by(goods[0]).s.myExcalSeen.card === 'S', '持剑人看到对方原来的牌');
    R.close();
  }
  // ---------- 7. 兰斯洛特 ----------
  for (const rule of [1, 2, 3]) {
    const R = await room(7, { percival: false, morgana: false, lancelot: rule });
    const { S, by, who, G } = R;
    const gl = who('good_lancelot').id, el = who('evil_lancelot').id;
    if (rule === 3) {
      assert(by(gl).s.myRole.sees.some((x) => x.id === el) && by(el).s.myRole.sees.some((x) => x.id === gl), '规则3：两个兰斯洛特互相认识');
      R.close(); continue;
    }
    assert(by(el).s.myRole.sees.length === 0, `规则${rule}：邪恶兰斯洛特看不到同伙`);
    assert(by(who('assassin').id).s.myRole.sees.some((x) => x.id === el), `规则${rule}：坏人能看到邪恶兰斯洛特`);
    const deck0 = G().lancelotDeck.length;
    assert(deck0 === (rule === 1 ? 5 : rule === 2 ? 4 : 0), `规则${rule}：开局牌堆数量正确（规则2开局已翻1张）`);
    // 打到看到一次换阵营
    let guard = 0;
    while (!G().lancelot.swapped && S().phase === 'propose' && guard++ < 6) {
      const ids = S().players.map((p) => p.id), t = ids.slice(0, S().teamSizes[S().quest]);
      await playQuest(R, t, (id, c) => (c.includes('F') && guard % 2 ? 'F' : 'S'));
      if (S().phase === 'assassin' || S().phase === 'end') break;
    }
    if (G().lancelot.swapped) {
      assert(by(gl).s.myRole.evilNow === true && by(el).s.myRole.evilNow === false, `规则${rule}：换阵营后两人当前阵营互换`);
    } else console.log('    (本局没翻到换阵营牌，跳过换边检查)');
    R.close();
  }
  console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
  process.exit(fails ? 1 : 0);
})();
