// 复盘长图：用 canvas 把一局的记录画成一张图（身份、任务、逐次发车票型），手机长按即可保存/分享
const RP = { W: 1080, pad: 48, gold: '#d8ad55', ink: '#f0e6cf', mute: '#a8987c', good: '#6f9be0', evil: '#e0564b', ok: '#6fc46e' };
const rpFont = (px, w = 400) => `${w} ${px}px "Noto Serif SC","Songti SC","STSong",serif`;
function rpImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
function rpRound(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function rpCover(ctx, im, x, y, w, h, fy = 0.18) { // object-fit:cover，偏上取景（露出脸）
  if (!im) { ctx.fillStyle = '#2a1d10'; ctx.fillRect(x, y, w, h); return; }
  const s = Math.max(w / im.width, h / im.height), sw = w / s, sh = h / s;
  ctx.drawImage(im, (im.width - sw) / 2, Math.max(0, (im.height - sh) * fy), sw, sh, x, y, w, h);
}

async function drawReplay(rec) {
  await document.fonts.ready;
  const { W, pad } = RP, n = rec.players.length;
  const votes = rec.history.filter((h) => h.type === 'vote');
  const quests = Object.fromEntries(rec.history.filter((h) => h.type === 'quest').map((h) => [h.quest, h]));
  const cols = n <= 6 ? n : Math.ceil(n / 2), cardW = Math.floor((W - pad * 2 - (cols - 1) * 14) / cols), cardH = Math.round(cardW * 1.45);
  const rosterRows = Math.ceil(n / cols);
  const rowH = 46, tableH = 70 + (n + 1) * rowH;
  const H = 310 + rosterRows * (cardH + 70) + 60 + 300 + tableH + 150;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1d140b'); bg.addColorStop(1, '#0d0905'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const hall = await rpImg('img/items/bg.webp');
  if (hall) { ctx.globalAlpha = 0.25; rpCover(ctx, hall, 0, 0, W, 520, 0.4); ctx.globalAlpha = 1; const fade = ctx.createLinearGradient(0, 300, 0, 520); fade.addColorStop(0, 'rgba(29,20,11,0)'); fade.addColorStop(1, '#1d140b'); ctx.fillStyle = fade; ctx.fillRect(0, 300, W, 220); }
  ctx.strokeStyle = 'rgba(216,173,85,.55)'; ctx.lineWidth = 3; ctx.strokeRect(18, 18, W - 36, H - 36); ctx.lineWidth = 1; ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.textAlign = 'center';
  // 标题
  ctx.fillStyle = RP.gold; ctx.font = rpFont(64, 900); ctx.fillText('阿瓦隆 · 对局复盘', W / 2, 120);
  const d = new Date(rec.endedAt);
  ctx.fillStyle = RP.mute; ctx.font = rpFont(28); ctx.fillText(`${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · ${n} 人局 · 房间 ${rec.code}`, W / 2, 168);
  // 胜负横幅
  const win = rec.winner === 'good';
  rpRound(ctx, pad, 196, W - pad * 2, 82, 10); ctx.fillStyle = win ? 'rgba(74,124,196,.35)' : 'rgba(179,58,51,.38)'; ctx.fill(); ctx.strokeStyle = win ? RP.good : RP.evil; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = rpFont(40, 700); ctx.fillText(win ? '正义阵营获胜' : '邪恶阵营获胜', W / 2, 238);
  ctx.fillStyle = '#e8dcc0'; ctx.font = rpFont(24); ctx.fillText(rec.reason, W / 2, 268);
  // 身份牌
  let y = 310;
  const ims = await Promise.all(rec.players.map((p) => rpImg(`img/roles/${p.art}.webp`).then((im) => im || rpImg(`img/roles/${p.role}.webp`))));
  rec.players.forEach((p, i) => {
    const r = Math.floor(i / cols), c = i % cols, rowCount = Math.min(cols, n - r * cols);
    const x0 = (W - (rowCount * cardW + (rowCount - 1) * 14)) / 2 + c * (cardW + 14), y0 = y + r * (cardH + 70);
    ctx.save(); rpRound(ctx, x0, y0, cardW, cardH, 8); ctx.clip(); rpCover(ctx, ims[i], x0, y0, cardW, cardH); ctx.restore();
    rpRound(ctx, x0, y0, cardW, cardH, 8); ctx.lineWidth = 3; ctx.strokeStyle = p.evil ? RP.evil : RP.good; ctx.stroke();
    if (rec.assassinTarget === p.seat) { ctx.lineWidth = 6; ctx.strokeStyle = '#ff3b30'; ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.beginPath(); ctx.arc(x0 + 26, y0 + 26, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = RP.gold; ctx.font = rpFont(24, 700); ctx.fillText(String(p.seat), x0 + 26, y0 + 34);
    ctx.fillStyle = RP.ink; ctx.font = rpFont(Math.min(28, cardW / 6), 700); ctx.fillText(p.name.slice(0, 8), x0 + cardW / 2, y0 + cardH + 32);
    ctx.fillStyle = p.evil ? '#ff9a92' : '#a9c8ff'; ctx.font = rpFont(Math.min(24, cardW / 7)); ctx.fillText(p.roleName + (rec.assassinTarget === p.seat ? ' · 被刺' : ''), x0 + cardW / 2, y0 + cardH + 60);
  });
  y += rosterRows * (cardH + 70) + 60;
  // 任务进度
  ctx.fillStyle = RP.gold; ctx.font = rpFont(34, 700); ctx.fillText('任务', W / 2, y + 10); y += 40;
  const qw = (W - pad * 2) / 5;
  for (let i = 0; i < 5; i++) {
    const cx = pad + qw * i + qw / 2, cy = y + 60, q = quests[i], r = rec.results[i];
    ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fillStyle = r ? (r.success ? '#2f5a9a' : '#8e211b') : 'rgba(255,255,255,.05)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = r ? (r.success ? RP.good : RP.evil) : 'rgba(216,173,85,.35)'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = rpFont(r ? 30 : 38, 700); ctx.fillText(r ? (r.success ? '成功' : '失败') : String(rec.teamSizes[i]), cx, cy + 12);
    ctx.font = rpFont(22); ctx.fillStyle = RP.mute;
    if (q) { ctx.fillText(`${q.fails} 败${q.magics ? ` · ${q.magics} 魔法` : ''}`, cx, cy + 86); ctx.fillText(q.team.slice().sort((a, b) => a - b).join(' '), cx, cy + 114); }
  }
  y += 260;
  // 票型表
  ctx.fillStyle = RP.gold; ctx.font = rpFont(34, 700); ctx.fillText('每次发车票型', W / 2, y + 10); y += 40;
  const nameW = 230, cw = Math.min(110, (W - pad * 2 - nameW) / Math.max(1, votes.length));
  ctx.font = rpFont(20); ctx.fillStyle = RP.mute; ctx.textAlign = 'center';
  votes.forEach((v, j) => { const x = pad + nameW + cw * j + cw / 2; ctx.fillStyle = v.ok ? RP.ok : RP.evil; ctx.fillText(`${v.quest + 1}-${v.attempt}`, x, y + 24); ctx.fillText(v.ok ? '通过' : '否决', x, y + 48); });
  y += 62;
  rec.players.forEach((p, i) => {
    const ry = y + i * rowH;
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(pad, ry, W - pad * 2, rowH); }
    ctx.textAlign = 'left'; ctx.font = rpFont(24); ctx.fillStyle = p.evil ? '#ff9a92' : '#a9c8ff'; ctx.fillText(`${p.seat}  ${p.name.slice(0, 7)}`, pad + 10, ry + 31);
    ctx.textAlign = 'center';
    votes.forEach((v, j) => {
      const x = pad + nameW + cw * j;
      if (v.team.includes(p.seat)) { ctx.fillStyle = 'rgba(111,196,110,.22)'; ctx.fillRect(x + 3, ry + 3, cw - 6, rowH - 6); }
      const yes = v.votes[p.seat];
      ctx.fillStyle = yes ? RP.ok : RP.evil; ctx.font = rpFont(26, 700); ctx.fillText(yes ? '✓' : '✗', x + cw / 2 + (v.leader === p.seat ? 12 : 0), ry + 32);
      if (v.leader === p.seat) { ctx.fillStyle = RP.gold; ctx.font = rpFont(22); ctx.fillText('♛', x + cw / 2 - 16, ry + 31); }
    });
  });
  y += n * rowH + 30;
  ctx.textAlign = 'center'; ctx.font = rpFont(20); ctx.fillStyle = RP.mute;
  ctx.fillText('绿底 = 在车上的队员 · ♛ = 队长 · ✓ 同意 ✗ 反对 · 名字颜色：蓝 = 好人 红 = 坏人', W / 2, y);
  ctx.fillText(location.host, W / 2, H - 52);
  return cv.toDataURL('image/jpeg', 0.9);
}

async function showReplay(rec) {
  if (!rec) return toast('没有找到这局的记录');
  $('#modal').innerHTML = `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="box rp-box"><div class="mute center">正在生成复盘图…</div></div></div>`;
  try {
    const url = await drawReplay(rec);
    const d = new Date(rec.endedAt), fname = `阿瓦隆复盘-${d.getMonth() + 1}月${d.getDate()}日-${rec.id}.jpg`;
    $('#modal').innerHTML = `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="box rp-box">
      <div class="mute center" style="margin-bottom:6px">长按图片可以保存或发送给朋友</div><img class="rp-img" src="${url}" alt="复盘图">
      <div class="row"><a class="btnlink" href="${url}" download="${fname}"><button>下载图片</button></a><button class="sec" onclick="closeModal()">关闭</button></div></div></div>`;
  } catch (e) { toast('生成失败：' + e.message); closeModal(); }
}

// ---------- 历史战绩页（/?history） ----------
const HISTORY = new URLSearchParams(location.search).has('history');
let HIST = null;
async function loadHistory() {
  try { HIST = await (await fetch('/api/games')).json(); } catch { HIST = { games: [], error: true }; }
  render();
}
function historyView() {
  if (!HIST) { loadHistory(); return `<h1>历史战绩</h1><div class="banner">读取中…</div>`; }
  const gs = HIST.games || [];
  // 按昵称统计
  const st = {};
  for (const g of gs) for (const p of g.players) {
    const s = st[p.name] || (st[p.name] = { name: p.name, n: 0, w: 0, good: 0, evil: 0, roles: {} });
    s.n++; if ((g.winner === 'evil') === p.evil) s.w++;
    p.evil ? s.evil++ : s.good++; s.roles[p.roleName] = (s.roles[p.roleName] || 0) + 1;
  }
  const rows = Object.values(st).sort((a, b) => b.w / b.n - a.w / a.n || b.n - a.n);
  const fav = (s) => Object.entries(s.roles).sort((a, b) => b[1] - a[1])[0];
  const fmt = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  return `<h1>历史战绩</h1><div class="sub">${gs.length} 局${HIST.persistent ? '' : ' · 注意：服务器还没接上长期存档，重启后会丢'}</div>
  <button class="sec" onclick="location.href='/'">返回首页</button>
  ${rows.length ? `<div class="card"><h3>玩家排行</h3><div class="mx"><table><tr><th>玩家</th><th>局数</th><th>胜率</th><th>好/坏</th><th>最常拿</th></tr>
    ${rows.map((s) => `<tr><td>${esc(s.name)}</td><td>${s.n}</td><td>${Math.round((s.w / s.n) * 100)}%</td><td>${s.good}/${s.evil}</td><td>${esc(fav(s)[0])}×${fav(s)[1]}</td></tr>`).join('')}</table></div></div>` : ''}
  <div class="card"><h3>对局</h3>${gs.length ? gs.map((g) => `<div class="hist-g" onclick="openGame('${g.id}')"><b class="${g.winner}">${g.winner === 'good' ? '正义胜' : '邪恶胜'}</b><span>${fmt(g.endedAt)} · ${g.players.length} 人 · ${g.results.map((r) => (r.success ? '●' : '○')).join('')}</span><small>${g.players.map((p) => esc(p.name)).join('、')}</small></div>`).join('') : '<div class="mute">还没有对局记录</div>'}</div>`;
}
async function openGame(id) {
  try { const rec = await (await fetch('/api/games/' + id)).json(); showReplay(rec); } catch { toast('读取失败'); }
}
