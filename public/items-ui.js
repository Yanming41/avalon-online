// Images decorate existing public state / legal card choices; never reveal private cards.
function itemPicture(key, cls = '') {
  return `<img class="item-picture ${cls}" src="img/items/${key}.webp" alt="" draggable="false" onerror="this.style.visibility='hidden'">`;
}
function questArt(code) {
  return code === 'M' ? 'quest_magic' : ['F', 'EF', 'RF'].includes(code) ? 'quest_fail' : 'quest_success';
}
function questHand() {
  return `<div class="quest-hand">${(S.myCards || []).map(c => `<button class="quest-choice ${CARD[c].b}" onclick="qc('${c}')" aria-label="出${esc(CARD[c].t)}">${itemPicture(questArt(c))}<span>${esc(CARD[c].t)}</span><small>点击出牌</small></button>`).join('')}</div>`;
}
function itemTile(key, title, desc) {
  return `<div class="item-tile"><button class="item-preview" onclick="showDetail('item:${key}',this.querySelector('img'))" aria-label="查看${esc(ITEMS[key].name)}规则">${itemPicture(key)}</button><div><b>${esc(title || ITEMS[key].name)}</b><p>${esc(desc || ITEMS[key].desc)}</p></div></div>`;
}
function gameItems(publicOnly = false) {
  if (!S || ['lobby', 'end'].includes(S.phase)) return '';
  let rows = '';
  const key = ['lady', 'excalibur', 'trapper'].includes(S.phase) ? S.phase : null;
  if (key) rows += itemTile(key, '', ITEMS[key].desc);
  if (S.phase === 'propose' && S.settings.excalibur) rows += itemTile('excalibur', '本轮王者之剑', '队长选好队伍后，把剑交给一名其他队员。');
  if (S.phase.startsWith('plot_') && S.plot) {
    const type = S.plot.action?.type || (S.phase === 'plot_deal' ? S.plot.pending?.[0]?.type : { plot_vote: 'king_returns', plot_prequest: 'we_found_you', plot_ambush: 'ambush' }[S.phase]);
    const card = PLOT_CARDS[type];
    rows += itemTile('plot', card ? `阴谋卡 · ${card.name}` : '阴谋卡分配', card?.desc || ITEMS.plot.desc);
  }
  if (S.lancelot?.flips?.length) {
    const last = S.lancelot.flips.at(-1);
    rows += `<details class="item-history"><summary>忠诚牌 · ${last.card === 'switch' ? '换阵营' : '不换'}</summary>${itemTile('loyalty', '最近翻开的忠诚牌', last.swapped ? '目前两位兰斯洛特已交换阵营。' : '目前两位兰斯洛特为初始阵营。')}</details>`;
  }
  const hands = publicOnly ? S.players : S.players.filter(p => p.id === S.me);
  const held = hands.flatMap(p => (S.plot?.hands?.[p.id] || []).map(c => ({ p, c })));
  if (held.length) rows += `<details class="item-history" open><summary>${publicOnly ? '公开持有的阴谋卡' : '我的阴谋卡'} · ${held.length} 张</summary><div class="plot-hand">${held.map(({p,c}) => itemTile('plot', `${publicOnly ? seat(p.id) + '号 · ' : ''}${PLOT_CARDS[c.type]?.name || c.type}`, PLOT_CARDS[c.type]?.desc)).join('')}</div></details>`;
  return rows ? `<section class="game-items" aria-label="本局道具">${rows}</section>` : '';
}
function loyaltyReveal(e) {
  return `<div class="loyalty-reveal"><div class="loyalty-flip"><div class="loyalty-back">${itemPicture('card_back')}</div><div class="loyalty-front">${itemPicture('loyalty')}<strong>${e.card === 'switch' ? '换阵营' : '不换'}</strong></div></div></div>`;
}
