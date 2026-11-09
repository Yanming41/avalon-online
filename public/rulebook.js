// Public reference only. Never read myRole, allRoles, checks or player IDs here.
let bookGame = null, bookPage = 0, bookPages = [], bookOpener = null;
function syncRulebook() {
  if (bookGame && (!S || S.gameId !== bookGame)) {
    document.querySelector('#rulebook')?.close();
    bookGame = null;
  }
}
function openRulebook() {
  if (!S?.gameId) return;
  bookOpener = document.activeElement;
  bookGame = S.gameId; bookPage = 0;
  const counts = S.roleCounts || Object.fromEntries((S.rolesInGame || []).map(k => [k, 1]));
  const roles = Object.keys(ROLES).filter(k => counts[k]);
  const count = k => `<span class="book-count">× ${counts[k]}</span>`;
  const badges = roles.map(k => `<button class="book-role-link" onclick="turnBook(${2 + roles.indexOf(k)})"><img src="${img(k)}" alt=""><span>${ROLES[k].name}<small>${ROLES[k].side === 'good' ? '正义' : '邪恶'}阵营</small></span>${count(k)}</button>`).join('');
  const modules = [];
  if (S.settings.lady) modules.push(['湖中仙女', ITEMS.lady.when]);
  if (S.settings.excalibur) modules.push(['王者之剑', ITEMS.excalibur.when]);
  if (counts.good_sorcerer || counts.evil_sorcerer) modules.push(['巫师 · 魔法牌', ITEMS.quest_magic.when + ' 巫师（正义、邪恶可以单独出现）只能出成功或魔法。']);
  if (S.lancelot) modules.push(['兰斯洛特 · 规则 ' + S.lancelot.rule, {
    1: '5 张忠诚牌中有 2 张换阵营。从第 3 轮起，每次组队翻 1 张（队伍被否决后重新组队也翻），牌用完即止。翻到换阵营时，两位兰斯洛特一起换边。',
    2: '7 张忠诚牌中有 2 张换阵营，随机抽取 5 张；每轮任务开始组队时翻 1 张。同一轮重新组队不再翻。两位兰斯洛特按当前阵营行动。',
    3: '不使用忠诚牌，不换阵营；两位兰斯洛特开局互相认识。',
  }[S.lancelot.rule]]);
  bookPages = [
    { title: '本局阵容', body: `<div class="book-eyebrow">THE ROUND TABLE</div><h2>本局阵容</h2><p class="book-intro">${S.players.length} 位玩家 · ${S.players.length - S.evilTotal} 位好人 · ${S.evilTotal} 位坏人</p><p class="book-note">公开的身份牌清单，不显示任何玩家拿到了哪张牌。阵营以开局配置计。</p><div class="book-roster">${badges}</div>` },
    { title: '流程与本局规则', body: `<div class="book-eyebrow">HOW TO PLAY</div><h2>流程与本局规则</h2><p class="book-note">每轮任务人数：${S.teamSizes.join(' → ')}<br>每人发言：${S.settings.speechSecs} 秒</p><ol><li><b>组队：</b>队长选够本轮人数，可以选自己。</li><li><b>投票：</b>全员投票，超过半数同意才通过，平票也否决。否决后换队长，连续 5 次否决，坏人获胜。</li><li><b>任务：</b>仅队员匿名出牌；一般好人只能出成功，坏人可出成功或失败，特殊角色以能力为准。${S.twoFailQuest4 ? '本局第 4 轮需 2 张失败，其余轮次 1 张失败即失败。' : '每轮 1 张失败即任务失败。'}</li><li><b>胜负：</b>3 次任务失败则坏人获胜。3 次任务成功后进入刺杀：刺中梅林则坏人获胜，否则好人获胜。</li></ol><h3>本局扩展</h3>${modules.length ? modules.map(([name, desc]) => `<p><b>${name}</b><br>${desc}</p>`).join('') : '<p>未启用额外道具或成对角色模块。</p>'}<p class="book-note">各个特殊角色的出牌限制、可见信息，见对应角色页。</p>` },
    ...roles.map(k => { const r = ROLES[k]; return { title: r.name, body: `<div class="book-eyebrow">${r.side === 'good' ? 'LOYAL TO ARTHUR' : 'MINIONS OF MORDRED'} · ${counts[k]} 张</div><h2>${r.name}</h2><img class="book-portrait" src="${img(k)}" alt="${r.name}"><h3>能力与信息</h3><p>${r.know}</p><h3>何时生效</h3><p>${r.when || ''}</p>${k.includes('lancelot') ? `<p class="book-note">本局采用兰斯洛特规则 ${S.lancelot?.rule || 0}，详见「流程与本局规则」。</p>` : ''}<h3>目标</h3><p>${r.goal}</p><h3>玩法提示</h3><ul>${r.tips.map(t => `<li>${t}</li>`).join('')}</ul>` }; }),
  ];
  let dialog = document.querySelector('#rulebook');
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.id = 'rulebook'; dialog.setAttribute('aria-labelledby', 'book-title');
    document.body.appendChild(dialog);
    dialog.addEventListener('click', e => { if (e.target === dialog) closeRulebook(); });
    dialog.addEventListener('cancel', e => { e.preventDefault(); closeRulebook(); });
    dialog.addEventListener('close', () => { document.body.classList.remove('book-open'); (bookOpener?.isConnected ? bookOpener : document.querySelector('.book-trigger'))?.focus(); });
  }
  dialog.innerHTML = `<div class="book-shell"><header><div><small>AVALON · FIELD GUIDE</small><h2 id="book-title">本局规则书</h2></div><button class="book-close" onclick="closeRulebook()" aria-label="关闭规则书">✕</button></header><div class="book-spread"><nav aria-label="规则书目录">${bookPages.map((p,i) => `<button onclick="turnBook(${i})">${String(i + 1).padStart(2, '0')} <span>${p.title}</span></button>`).join('')}</nav><article id="book-paper" tabindex="0" aria-label="规则书正文"></article></div><footer><button id="book-prev" onclick="turnBook(bookPage-1)">← 上一页</button><span id="book-number" aria-live="polite"></span><button id="book-next" onclick="turnBook(bookPage+1)">下一页 →</button></footer></div>`;
  turnBook(0); dialog.showModal(); document.body.classList.add('book-open');
  dialog.querySelector('.book-close').focus();
}
function turnBook(page) {
  if (page < 0 || page >= bookPages.length) return;
  bookPage = page;
  const paper = document.querySelector('#book-paper');
  paper.innerHTML = bookPages[page].body; paper.scrollTop = 0;
  paper.classList.remove('book-turn'); void paper.offsetWidth; paper.classList.add('book-turn');
  document.querySelectorAll('#rulebook nav button').forEach((b,i) => b.setAttribute('aria-current', i === page ? 'page' : 'false'));
  document.querySelector('#book-number').textContent = `${page + 1} / ${bookPages.length}`;
  document.querySelector('#book-prev').disabled = page === 0;
  document.querySelector('#book-next').disabled = page === bookPages.length - 1;
}
function closeRulebook() {
  const dialog = document.querySelector('#rulebook');
  if (!dialog?.open || dialog.classList.contains('book-closing')) return;
  dialog.classList.add('book-closing');
  setTimeout(() => { dialog.close(); dialog.classList.remove('book-closing'); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
}
