// 大盒版模块规则端到端测试：不可信的仆人 / 陷阱师 / 信使(3人) / 游侠(2人) / 阴谋卡
// 用法：先 GOD_PASSWORD=test PORT=3123 npm start，再 node test/bigbox.js
const WebSocket = require('ws');
const URL = process.argv[2] || 'ws://localhost:3123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check) { const end = Date.now() + 5000; while (!check()) { if (Date.now() > end) throw new Error('Timed out waiting for client state'); await sleep(20); } }
let fails = 0;
const assert = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };

async function room(n, settings) {
  const cl = []; let code;
  const mk = () => new Promise((res) => {
    const w = new WebSocket(URL);
    const c = { w, s: null, msgs: [] };
    w.on('message', (d) => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') code = m.code; });
    w.on('open', () => res(c));
  });
  const tag = 'bb' + Math.random().toString(36).slice(2);
  for (let i = 0; i < n; i++) {
    const c = await mk(); cl.push(c);
    c.w.send(JSON.stringify({ t: i ? 'join' : 'create', code, name: 'P' + i, token: tag + i }));
    await sleep(45);
  }
  const tx = (c, o) => c.w.send(JSON.stringify(o));
  tx(cl[0], { t: 'settings', settings }); await sleep(45);
  tx(cl[0], { t: 'start' }); await sleep(120);
  const g = await mk(); tx(g, { t: 'god', code, password: 'test' }); await sleep(100);
  const S = () => cl[0].s, G = () => g.s, by = (id) => cl.find((c) => c.s.me === id);
  const role = (id) => G().allRoles.find((r) => r.id === id);
  const who = (r) => G().allRoles.find((x) => x.role === r);
  return { cl, g, tx, S, G, by, role, who, close: () => { cl.forEach((c) => c.w.close()); g.w.close(); } };
}

async function voteAll(R, approve = true) {
  const { S, tx } = R;
  // 处理「冲锋！」先亮票顺序：如果有 chargeWait 先让持卡人投
  const cw = (S().plot && S().plot.chargeWait) || [];
  for (const id of cw) { tx(R.by(id), { t: 'vote', approve }); }
  if (cw.length) await sleep(60);
  for (const c of R.cl) if (!cw.includes(c.s.me)) tx(c, { t: 'vote', approve });
  await until(() => R.cl.every((c) => c.s.phase !== 'vote'));
}

async function passHolders(R, card) {
  let guard = 0;
  while (['plot_vote', 'plot_prequest', 'plot_ambush'].includes(R.S().phase) && guard++ < 10) {
    const hs = [...(R.S().plot.waitHolders || [])];
    for (const hid of hs) { R.tx(R.by(hid), { t: 'plotUse', card, pass: true }); await sleep(50); }
    await sleep(60);
  }
}

async function playQuest(R, team, cardFn, opts = {}) {
  const { tx, S, by } = R;
  if (S().phase !== 'propose') throw new Error('not propose: ' + S().phase);
  tx(by(S().leader), { t: 'propose', team, excalibur: opts.excalibur });
  await until(() => R.cl.every((c) => c.s.phase === 'vote'));
  await voteAll(R, true);
  if (S().phase === 'plot_vote') await passHolders(R, 'king_returns');
  if (S().phase === 'watch') {
    const wt = opts.watchTarget || team[0];
    tx(by(S().leader), { t: 'rogueWatch', id: wt }); await sleep(70);
  }
  if (S().phase === 'plot_prequest') await passHolders(R, 'we_found_you');
  await until(() => R.cl.every((c) => c.s.phase === 'quest'));
  for (const id of team) {
    const c = by(id);
    tx(c, { t: 'quest', card: cardFn(id, c.s.myCards) });
  }
  await until(() => R.cl.every((c) => c.s.phase !== 'quest'));
  if (S().phase === 'excalibur') { tx(by(S().excalibur), { t: 'excalibur', id: opts.excalTarget || null }); await sleep(90); }
  if (S().phase === 'plot_ambush') await passHolders(R, 'ambush');
  if (S().phase === 'trapper') {
    const drop = opts.trapperDrop || team[0];
    tx(by(S().leader), { t: 'trapper', id: drop }); await until(() => R.cl.every((c) => c.s.phase !== 'trapper'));
  }
}

(async () => {
  // ---------- 1. 不可信的仆人：身份视野 / 忠诚查验 / 招募猜错 vs 猜中接管刺杀 ----------
  {
    const R = await room(7, { percival: false, morgana: false, lady: true, untrustworthy: true });
    const { S, by, who, tx } = R;
    const ut = who('untrustworthy').id, mer = who('merlin').id, ass = who('assassin').id;
    const ids = S().players.map((p) => p.id);
    const goods = ids.filter((id) => !R.role(id).evil && id !== ut && id !== mer);
    assert(by(mer).s.myRole.sees.some((x) => x.id === ut && x.tag === '坏人'), '梅林把不可信的仆人看成坏人');
    assert(by(ut).s.myRole.sees.some((x) => x.id === ass && x.tag === '刺客'), '不可信的仆人开局知道谁是刺客');
    assert(!by(ass).s.myRole.sees.some((x) => x.id === ut), '刺客开局不知道谁是不可信的仆人');

    // 第1、2轮好人赢，检查不可信的仆人只能出 S，以及湖中仙女看成好人
    await playQuest(R, [ut, goods[0]].slice(0, 2), (id, mc) => {
      if (id === ut) assert(JSON.stringify(mc) === '["S"]', '招募前不可信的仆人任务只能出成功');
      return 'S';
    });
    await playQuest(R, [ut, goods[0], goods[1]], () => 'S');
    if (S().phase === 'lady') {
      const h = S().lady.holder;
      const tgt = h !== ut ? ut : goods[0];
      tx(by(h), { t: 'lady', id: tgt }); await until(() => R.cl.every((c) => c.s.phase === 'propose'));
      if (tgt === ut) assert(by(h).s.myChecks.at(-1).evil === false, '湖中仙女查不可信的仆人显示为好人');
    }
    await playQuest(R, [ut, goods[0], goods[1]], () => 'S');
    assert(S().phase === 'recruit' && S().recruit.recruiter === ass, '第3次任务成功后先进入招募阶段');
    assert(S().recruit.secs === 60 && typeof S().recruit.endsAt === 'number' && S().recruit.endsAt > Date.now(), '招募阶段默认带有 60 秒倒计时');

    // 1A: 刺客招募猜错 -> 不可信的仆人保持好人，原刺客继续刺杀
    tx(by(ass), { t: 'recruit', id: mer }); await sleep(100);
    assert(S().phase === 'assassin' && S().assassin === ass && !S().recruited, '招募猜错后由原刺客刺杀');
    assert(by(ut).s.myRole.evilNow === false, '招募猜错时不可信的仆人仍是好人');
    tx(by(ass), { t: 'assassinate', id: goods[0] }); await sleep(100);
    assert(S().phase === 'end' && S().winner === 'good', '原刺客刺错 -> 好人获胜');
    R.close();
  }
  {
    const R = await room(6, { percival: false, morgana: false, untrustworthy: true, recruitSecs: 90 });
    const { S, by, who, tx } = R;
    const ut = who('untrustworthy').id, mer = who('merlin').id, ass = who('assassin').id;
    const ids = S().players.map((p) => p.id);
    const goods = ids.filter((id) => !R.role(id).evil);
    await playQuest(R, goods.slice(0, 2), () => 'S');
    await playQuest(R, goods.slice(0, 3), () => 'S');
    await playQuest(R, goods.slice(0, 4), () => 'S');
    assert(S().phase === 'recruit' && S().recruit.secs === 90, '6人局3胜进入招募阶段且自定义90秒生效');
    tx(by(ass), { t: 'recruit', id: ut }); await sleep(100);
    assert(S().phase === 'assassin' && S().assassin === ut && S().recruited === ut, '猜中不可信的仆人 -> 倒戈并接管刺杀');
    assert(by(ut).s.myRole.evilNow === true, '被招募后不可信的仆人变为邪恶阵营');
    tx(by(ass), { t: 'assassinate', id: mer }); await sleep(60);
    assert(S().phase === 'assassin', '原刺客已失去刺杀权');
    tx(by(ut), { t: 'assassinate', id: mer }); await sleep(100);
    assert(S().phase === 'end' && S().winner === 'evil' && S().reason.includes('不可信'), '被招募的仆人刺中梅林翻盘');
    R.close();
  }

  // ---------- 2. 陷阱师：队伍+1人，队长偷看并弃掉1张牌 ----------
  {
    const R = await room(6, { percival: false, morgana: false, trapper: true });
    const { S, by, who, tx } = R;
    const ass = who('assassin').id;
    const ids = S().players.map((p) => p.id);
    const goods = ids.filter((id) => !R.role(id).evil);
    assert(JSON.stringify(S().teamSizes) === '[3,4,5,4,5]', '开启陷阱师后每轮发车人数+1');
    tx(by(S().leader), { t: 'propose', team: goods.slice(0, 2) }); await sleep(60);
    assert(by(S().leader).msgs.some((m) => m.t === 'error' && m.m.includes('3')), '人数未+1时不能发车');
    await playQuest(R, [ass, goods[0], goods[1]], (id) => (id === ass ? 'F' : 'S'), { trapperDrop: ass });
    assert(S().results.length === 1 && S().results[0].success === true && S().results[0].fails === 0, '队长弃掉坏人的失败牌 -> 本轮任务成功');
    const seen = Object.values(R.cl.reduce((acc, c) => (c.s.myTrapperSeen ? [c.s.myTrapperSeen] : acc), []))[0];
    assert(seen && seen.id === ass && seen.card === 'F', '前任队长看到了被弃牌的真实内容');
    R.close();
  }

  // ---------- 3. 信使模块：双好信使限额 / 第5轮+1-1修正 / 改刺双信使 ----------
  {
    const R = await room(8, { percival: false, morgana: false, messengers: true });
    const { S, by, who, tx } = R;
    const jm = who('junior_messenger').id, sm = who('senior_messenger').id, em = who('evil_messenger').id, ass = who('assassin').id;
    const ids = S().players.map((p) => p.id);
    const goods = ids.filter((id) => !R.role(id).evil && id !== jm && id !== sm);
    assert(by(sm).s.myRole.sees.some((x) => x.id === jm && x.tag === '初级信使'), '高级信使开局认识低级信使');
    assert(!by(jm).s.myRole.sees.length, '低级信使不认识高级信使');
    assert(by(ass).s.myRole.sees.some((x) => x.id === em), '坏人认识邪恶信使');

    // 前4轮推到 2胜2负，期间好信使出满 3+ 好信、坏信使只出 1 坏信（保证第5轮 msgGood>=3 且 msgEvil<2 => 失败-1）
    await playQuest(R, [jm, sm, goods[0]], (id) => (id === jm || id === sm ? 'GS' : 'S')); // Q1 Win (GS=2)
    await playQuest(R, [jm, sm, goods[0], goods[1]], (id) => (id === jm ? 'GS' : 'S'));   // Q2 Win (GS=3, jm used 2)
    // 第3次发车时低级信使已用光2次好信，检验 myCards 只剩 S
    await playQuest(R, [jm, em, ass, goods[0]], (id, mc) => {
      if (id === jm) assert(JSON.stringify(mc) === '["S"]', '好信使出满2张好信后只能出成功');
      return id === em ? 'EF' : id === ass ? 'F' : 'S';
    }); // Q3 Fail (EF=1, fails=2)
    await playQuest(R, [ass, em, goods[0], goods[1], goods[2]], (id) => (id === ass || id === em ? 'F' : 'S')); // Q4 Fail (2 fails needed for 8p)
    assert(S().quest === 4 && S().messengers.good === 3 && S().messengers.evil === 1, '第5轮前好信>=3、坏信<2');
    // 第5轮带 1 个普通失败（ass出F），应该被好信增援 -1 抵消 -> 0失败 -> 成功！
    await playQuest(R, [ass, sm, goods[0], goods[1], goods[2]], (id) => (id === ass ? 'F' : 'S'));
    assert(S().results[4].success === true && S().results[4].fails === 0, '第5轮好信>=3使失败数-1，成功晋级刺杀');
    assert(S().phase === 'assassin' && S().canKillMessengers === true, '进入刺杀阶段且支持改刺双信使');

    tx(by(ass), { t: 'assassinate', mode: 'messengers', ids: [jm, sm] }); await sleep(100);
    assert(S().phase === 'end' && S().winner === 'evil' && S().reason.includes('双信使'), '刺客改刺双信使猜中两人翻盘');
    R.close();
  }
  {
    // 坏信>=2且好信<3 -> 第5轮失败数+1；以及改刺双信使猜错1人 -> 好人胜
    const R = await room(6, { percival: false, morgana: false, messengers: true });
    const { S, by, who, tx } = R;
    const jm = who('junior_messenger').id, sm = who('senior_messenger').id, em = who('evil_messenger').id, ass = who('assassin').id;
    const ids = S().players.map((p) => p.id);
    const goods = ids.filter((id) => !R.role(id).evil && id !== jm && id !== sm);
    await playQuest(R, [goods[0], goods[1]], () => 'S'); // W
    await playQuest(R, [em, goods[0], goods[1]], (id) => (id === em ? 'EF' : 'S')); // F (EF=1)
    await playQuest(R, [goods[0], goods[1], jm, em], (id) => (id === em ? 'EF' : 'S')); // F (EF=2)
    await playQuest(R, [goods[0], goods[1], jm], () => 'S'); // W
    assert(S().quest === 4 && S().messengers.good === 0 && S().messengers.evil === 2, '第5轮前好信=0、坏信=2');
    await playQuest(R, [goods[0], goods[1], jm, sm], () => 'S'); // 全员成功但坏信增援+1 => 1失败 => 败！
    assert(S().results[4].success === false && S().results[4].fails === 1, '第5轮坏信>=2使失败数+1，全成功也被翻成失败');
    assert(S().phase === 'end' && S().winner === 'evil', '3败坏人胜');
    R.close();

    // 改刺双信使猜错1人
    const R2 = await room(6, { percival: false, morgana: false, messengers: true });
    const ids2 = R2.S().players.map((p) => p.id), g2 = ids2.filter((id) => !R2.role(id).evil);
    const jm2 = R2.who('junior_messenger').id, sm2 = R2.who('senior_messenger').id, ass2 = R2.who('assassin').id;
    const otherG = g2.find((id) => id !== jm2 && id !== sm2);
    await playQuest(R2, g2.slice(0, 2), () => 'S');
    await playQuest(R2, g2.slice(0, 3), () => 'S');
    await playQuest(R2, g2.slice(0, 4), () => 'S');
    R2.tx(R2.by(ass2), { t: 'assassinate', mode: 'messengers', ids: [jm2, otherG] }); await sleep(100);
    assert(R2.S().phase === 'end' && R2.S().winner === 'good', '改刺双信使只猜中1个 -> 好人获胜');
    R2.close();
  }

  // ---------- 4. 游侠模块：邪恶游侠互盲 / 5-6人前2轮无监视 / 监视禁用 / 独胜跳过刺杀 ----------
  {
    const R = await room(6, { percival: false, morgana: false, good_rogue: true, evil_rogue: true });
    const { S, by, who, tx } = R;
    const gr = who('good_rogue').id, er = who('evil_rogue').id, mer = who('merlin').id, ass = who('assassin').id;
    const ids = S().players.map((p) => p.id), plainGoods = ids.filter((id) => !R.role(id).evil && id !== gr);
    assert(by(er).s.myRole.sees.length === 0, '邪恶游侠不知道任何坏人');
    assert(!by(ass).s.myRole.sees.some((x) => x.id === er), '刺客不知道谁是邪恶游侠');
    assert(!by(mer).s.myRole.sees.some((x) => x.id === er), '梅林看不到邪恶游侠');

    // Q1 (5-6人无监视标记): 正义游侠出 RS
    await playQuest(R, [gr, plainGoods[0]], (id) => (id === gr ? 'RS' : 'S'));
    assert(S().results[0].success && S().results[0].rogueGood === 1, '6人局第1轮跳过监视标记且好游侠出牌成功');
    // Q2 (无监视): 全好人成功
    await playQuest(R, plainGoods.slice(0, 3), () => 'S');
    // Q3 (6人局第3轮开启监视！): 先发车验证 watch 阶段 & 监视禁用游侠牌
    tx(by(S().leader), { t: 'propose', team: [gr, plainGoods[0], plainGoods[1], plainGoods[2]] }); await sleep(70);
    await voteAll(R, true);
    assert(S().phase === 'watch', '6人局第3轮发车通过后进入监视标记阶段');
    // 队长把监视标记贴给别人(plainGoods[0])，不挡住正义游侠出 RS -> 达成2次+第3胜独胜！
    tx(by(S().leader), { t: 'rogueWatch', id: plainGoods[0] }); await sleep(70);
    assert(JSON.stringify(by(plainGoods[0]).s.myCards) === '["S"]' && by(gr).s.myCards.includes('RS'), '未贴监视标记的好游侠仍可出游侠成功牌');
    for (const id of S().team) tx(by(id), { t: 'quest', card: id === gr ? 'RS' : 'S' });
    await sleep(140);
    assert(S().phase === 'end' && S().winner === 'good' && S().soloWinner === gr, '正义游侠第3胜出牌且>=2次 -> 独自获胜并跳过刺杀');
    R.close();

    // 验证被贴监视标记时不能出游侠牌 & 邪恶游侠独胜
    const R2 = await room(7, { percival: false, morgana: false, evil_rogue: true });
    const er2 = R2.who('evil_rogue').id, ass2 = R2.who('assassin').id;
    const ids2 = R2.S().players.map((p) => p.id), g2 = ids2.filter((i) => !R2.role(i).evil);
    R2.tx(R2.by(R2.S().leader), { t: 'propose', team: [er2, g2[0]] }); await sleep(60);
    await voteAll(R2, true);
    assert(R2.S().phase === 'watch', '7人局第1轮即启用监视标记');
    R2.tx(R2.by(R2.S().leader), { t: 'rogueWatch', id: er2 }); await sleep(70);
    assert(!R2.by(er2).s.myCards.includes('RF') && R2.by(er2).s.myCards.includes('F'), '被贴监视标记后游侠禁用游侠牌');
    for (const id of R2.S().team) R2.tx(R2.by(id), { t: 'quest', card: id === er2 ? 'F' : 'S' }); // Q1 Fail (not RF)
    await sleep(120);
    await playQuest(R2, [er2, g2[0], g2[1]], (id) => (id === er2 ? 'RF' : 'S'), { watchTarget: g2[0] }); // Q2 Fail (RF #1)
    await playQuest(R2, [er2, g2[0], g2[1]], (id) => (id === er2 ? 'RF' : 'S'), { watchTarget: g2[0] }); // Q3 Fail (RF #2, 3rd loss!)
    assert(R2.S().phase === 'end' && R2.S().winner === 'evil' && R2.S().soloWinner === er2, '邪恶游侠在第3次任务失败出RF且>=2次 -> 独自获胜');
    R2.close();
  }

  // ---------- 5. 阴谋卡模块：5-6人7张牌堆 / 7+人15张牌堆 / 分发限制 / 冲锋 / 国王归来 / 找到你了 / 伏击 ----------
  {
    const R6 = await room(6, { percival: false, morgana: false, plot: true });
    assert(R6.S().phase === 'plot_deal' && R6.S().plot.pending.length === 1 && R6.S().plot.deckLeft === 6, '6人局用7张牌堆，第1轮摸1张剩6张');
    const lead6 = R6.S().leader;
    R6.tx(R6.by(lead6), { t: 'plotGive', to: lead6 }); await sleep(60);
    assert(R6.by(lead6).msgs.some((m) => m.t === 'error' && m.m.includes('自己')), '队长不能把阴谋卡留给自己');
    R6.close();

    const tested = new Set();
    for (let attempt = 0; attempt < 6 && tested.size < 5; attempt++) {
      const R7 = await room(7, { percival: false, morgana: false, plot: true });
      if (attempt === 0) assert(R7.S().phase === 'plot_deal' && R7.S().plot.pending.length === 2 && R7.S().plot.deckLeft === 13, '7人局用15张牌堆，第1轮摸2张剩13张');
      const pIds = R7.S().players.map((p) => p.id);
      for (let round = 0; round < 5 && !['assassin', 'recruit', 'end'].includes(R7.S().phase); round++) {
        let guard = 0;
        while (R7.S().phase === 'plot_deal' && guard++ < 15) {
          const pl = R7.S().plot;
          if (pl.action) {
            const own = pl.action.owner, oi = pIds.indexOf(own);
            let tgt = pIds[(oi + 1) % pIds.length];
            if (pl.action.type === 'restore_honor') {
              const holder = pIds.find((id) => id !== own && (pl.hands[id] || []).length);
              if (holder) tgt = holder;
            }
            R7.tx(R7.by(own), { t: 'plotResolve', id: tgt });
          } else {
            const lead = R7.S().leader;
            const other = pIds.find((id) => id !== lead && !(pl.hands[id] || []).length) || pIds.find((id) => id !== lead);
            R7.tx(R7.by(lead), { t: 'plotGive', to: other });
          }
          await sleep(45);
        }
        if (attempt === 0 && round === 0) assert(R7.S().phase === 'propose', '阴谋卡分完后进入组队阶段');
        if (R7.S().phase !== 'propose') break;

        // 若有人手上有 lead_to_victory 且非当前队长 -> 测试抢队长
        const hands = R7.S().plot.hands || {};
        const ltvHolder = pIds.find((id) => id !== R7.S().leader && (hands[id] || []).some((c) => c.type === 'lead_to_victory'));
        if (ltvHolder && !tested.has('lead_to_victory')) {
          R7.tx(R7.by(ltvHolder), { t: 'plotUse', card: 'lead_to_victory' }); await sleep(50);
          assert(R7.S().leader === ltvHolder, '引领胜利成功抢夺本轮队长');
          tested.add('lead_to_victory');
        }

        const team = pIds.slice(0, R7.S().teamSizes[R7.S().quest]);
        R7.tx(R7.by(R7.S().leader), { t: 'propose', team }); await sleep(50);
        if (R7.S().phase === 'vote') {
          const cw = R7.S().plot.chargeWait || [];
          if (cw.length && !tested.has('charge')) {
            const non = pIds.find((id) => !cw.includes(id));
            R7.tx(R7.by(non), { t: 'vote', approve: true }); await sleep(45);
            assert(R7.by(non).msgs.some((m) => m.t === 'error' && m.m.includes('冲锋')), '有冲锋！时其他人必须等其先亮票');
            tested.add('charge');
          }
          await voteAll(R7, true);
        }
        if (R7.S().phase === 'plot_vote') {
          const kh = R7.S().plot.waitHolders[0];
          if (!tested.has('king_returns')) {
            R7.tx(R7.by(kh), { t: 'plotUse', card: 'king_returns' }); await sleep(60);
            assert(R7.S().rejects === 1 && R7.S().phase === 'propose', '国王归来成功强行否决组队并增加否决次数');
            tested.add('king_returns');
            R7.tx(R7.by(R7.S().leader), { t: 'propose', team }); await sleep(50);
            await voteAll(R7, true);
          }
          await passHolders(R7, 'king_returns');
        }
        if (R7.S().phase === 'plot_prequest') {
          const wh = R7.S().plot.waitHolders[0];
          if (!tested.has('we_found_you')) {
            R7.tx(R7.by(wh), { t: 'plotUse', card: 'we_found_you', id: team[0] }); await sleep(60);
            assert(R7.S().plot.faceup && R7.S().plot.faceup.id === team[0], '找到你了！锁定目标明牌出牌');
            tested.add('we_found_you');
          } else await passHolders(R7, 'we_found_you');
        }
        if (R7.S().phase === 'quest') {
          for (const id of team) { const c = R7.by(id); R7.tx(c, { t: 'quest', card: 'S' }); }
          await sleep(100);
        }
        if (R7.S().phase === 'plot_ambush') {
          const ah = R7.S().plot.waitHolders[0];
          if (!tested.has('ambush')) {
            R7.tx(R7.by(ah), { t: 'plotUse', card: 'ambush', id: team[0] }); await sleep(70);
            assert((R7.by(ah).s.myPlotChecks || []).some((x) => x.id === team[0] && x.questCard === 'S'), '伏击秘密偷看到队员出的任务牌');
            tested.add('ambush');
          }
          await passHolders(R7, 'ambush');
        }
      }
      R7.close();
    }
    assert(tested.size >= 3, `阴谋卡核心效果至少实测覆盖 ${tested.size} 种（${[...tested].join(',')}）`);
  }

  // ---------- 6. 大厅全部预设板子在对应最低人数下合法开局 ----------
  {
    const fs = require('fs'), vm = require('vm');
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'table.js'), 'utf8');
    const m = src.match(/const PRESET_BASE = [\s\S]*?const PRESETS = \[[\s\S]*?\];/);
    const box = {};
    vm.runInNewContext(m[0] + '; this.PRESETS = PRESETS;', box);
    assert(box.PRESETS.length === 8, `大厅共有 ${box.PRESETS.length} 套预设板子`);
    for (const p of box.PRESETS) {
      const n = p.min || 5;
      const R = await room(n, p.s);
      const err = R.cl[0].msgs.find((x) => x.t === 'error');
      assert(!err && ['propose', 'plot_deal'].includes(R.S().phase), `预设「${p.name}」在 ${n} 人局一键开局成功`);
      R.close();
    }
  }

  console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
  process.exit(fails ? 1 : 0);
})();
