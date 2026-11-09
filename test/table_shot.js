// 圆桌界面截图：7 人局，分别截 队长组队 / 发言准备 / 发言计时+投票 / 任务 / 结算
const WebSocket = require('ws'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; const port = 3141, base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  await sleep(900);
  const cl = []; let code; const tag = 'ts' + Date.now();
  const AV = ['lion', 'dragon', 'stag', 'wolf', 'owl', 'swan', 'eagle'], NM = ['阿明', '小红', '老王', 'Leo', '七七', '大胖', 'Mia'];
  for (let i = 0; i < 7; i++) { const w = new WebSocket(`ws://127.0.0.1:${port}`); const c = { w, s: null }; w.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') code = m.code; }); await new Promise((r) => w.on('open', r)); cl.push(c); w.send(JSON.stringify({ t: i ? 'join' : 'create', code, name: NM[i], avatar: AV[i], token: tag + i })); await sleep(80); }
  const tx = (c, o) => c.w.send(JSON.stringify(o)); const S = () => cl.find((c) => c.w.readyState === 1).s, by = (id) => cl.find((c) => c.s.me === id);
  tx(cl[0], { t: 'settings', settings: { lady: true } }); await sleep(60); tx(cl[0], { t: 'start' }); await sleep(200);
  // 一轮通过+成功，让桌面上有历史
  { const s = S(); tx(by(s.leader), { t: 'propose', team: s.players.slice(0, 2).map((p) => p.id) }); await sleep(80); cl.forEach((c) => tx(c, { t: 'vote', approve: true })); await sleep(120); for (const id of S().team) { const c = by(id); tx(c, { t: 'quest', card: 'S' }); } await sleep(150); }
  const leader = S().leader, leaderIdx = cl.findIndex((c) => c.s.me === leader);
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9351', '--user-data-dir=' + OUT + '/prof3', 'about:blank']);
  await sleep(2500);
  const list = await (await fetch('http://127.0.0.1:9351/json')).json();
  const page = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => page.on('open', r));
  let id = 0; const pend = {}, errs = [];
  page.on('message', (d) => { const m = JSON.parse(d); if (pend[m.id]) pend[m.id](m.result); if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
  const cdp = (method, params = {}) => new Promise((r) => { pend[++id] = r; page.send(JSON.stringify({ id, method, params })); });
  const ev = (e) => cdp('Runtime.evaluate', { expression: e, awaitPromise: true });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 400, height: 860, deviceScaleFactor: 2, mobile: true });
  const as = async (i) => { cl[i].w.close(); await sleep(150); await cdp('Page.navigate', { url: base }); await sleep(500); await ev(`localStorage.token='${tag}${i}';localStorage.name='${NM[i]}';localStorage.room='${code}';sessionStorage.clear()`); await cdp('Page.reload'); await sleep(1600); await ev(`document.getElementById('modal').innerHTML=''`); };
  const shot = async (n) => { await ev('document.fonts.ready'); await sleep(500); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from((await cdp('Page.captureScreenshot', { captureBeyondViewport: false })).data, 'base64')); };
  await as(leaderIdx); // 以当前队长视角
  // 按住看身份：模拟真实手指按下 → 松开，身份牌必须收回
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const r = JSON.parse((await ev(`JSON.stringify((()=>{const b=document.getElementById('rc').getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})())`)).result.value);
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r[0], y: r[1] }] }); await sleep(300);
  const shown = (await ev('reveal && !!document.querySelector(".idfull")')).result.value;
  await shot('t0-reveal');
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
  const hidden = (await ev('!reveal && !document.querySelector(".idfull")')).result.value;
  console.log(shown ? 'ok   按住时身份牌翻开' : 'FAIL 按住没翻开'); console.log(hidden ? 'ok   松手后身份牌收回' : 'FAIL 松手没收回');
  await ev(`tog(S.players[0].id);tog(S.players[2].id)`); await sleep(300);
  await ev(`{const x=marks();const p=S.players.map(q=>q.id);x.r.push({a:p[5],b:p[6],k:'opp'},{a:p[1],b:p[3],k:'same'},{a:p[0],b:p[4],k:'opp'});x.m[p[5]]='evil';x.m[p[1]]='good';saveMarks(x)}`); await sleep(300);
  await shot('t1-leader-propose');
  await ev(`speechSetup()`); await sleep(500); await shot('t2a-speech-setup');
  await ev(`document.querySelector('.spset .okb').click()`); await sleep(500); await shot('t2-speech-ready');
  const sp = S().speech; const spk = cl.findIndex((c) => c.s && c.s.me === sp.order[0]);
  if (spk >= 0 && cl[spk].w.readyState === 1) tx(cl[spk], { t: 'speechGo' }); else await ev(`send({t:'speechGo'})`);
  await sleep(2500); await shot('t3-speech-running');
  await ev(`send({t:'speechStop'})`); await sleep(200);
  await ev(`send({t:'propose',team:[S.players[0].id,S.players[2].id,S.players[4].id]})`); await sleep(300);
  cl.forEach((c, i) => i !== leaderIdx && i % 2 === 0 && c.w.readyState === 1 && tx(c, { t: 'vote', approve: true })); await sleep(400);
  await shot('t4-vote');
  await ev(`questDetail(0)`); await sleep(500); await shot('t5-quest-detail');
  await cdp('Page.navigate', { url: base + '/?spec=' + code + '&name=' + encodeURIComponent('路人甲') }); await sleep(1800);
  await ev(`document.getElementById('modal').innerHTML=''`); await shot('t6-spectator');
  console.log('errors:', errs.length ? errs : 'none');
  chrome.kill(); server.kill(); process.exit(0);
})();
