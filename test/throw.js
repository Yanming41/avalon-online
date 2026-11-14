// 投掷测试：7 人局开局，以 0 号视角，让别人扔东西过来，截飞行中/命中画面；再测观众能扔、大屏不能扔、冷却
const WebSocket = require('ws'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; const port = 3142, base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  await sleep(900);
  const cl = []; let code; const tag = 'th' + Date.now(); const got = [];
  const AV = ['lion', 'dragon', 'stag', 'wolf', 'owl', 'swan', 'eagle'], NM = ['阿明', '小红', '老王', 'Leo', '七七', '大胖', 'Mia'];
  for (let i = 0; i < 7; i++) { const w = new WebSocket(`ws://127.0.0.1:${port}`); const c = { w, s: null, th: [] }; w.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') code = m.code; if (m.t === 'throw') c.th.push(m); }); await new Promise((r) => w.on('open', r)); cl.push(c); w.send(JSON.stringify({ t: i ? 'join' : 'create', code, name: NM[i], avatar: AV[i], token: tag + i })); await sleep(80); }
  const tx = (c, o) => c.w.send(JSON.stringify(o));
  tx(cl[0], { t: 'start' }); await sleep(300);
  const ids = cl.map((c) => c.s.me); const S0me = ids[0];
  // 观众 + 大屏
  const spec = new WebSocket(`ws://127.0.0.1:${port}`); await new Promise((r) => spec.on('open', r)); spec.send(JSON.stringify({ t: 'watch', code, name: '路人甲' }));
  const tv = new WebSocket(`ws://127.0.0.1:${port}`); await new Promise((r) => tv.on('open', r)); tv.send(JSON.stringify({ t: 'watch', code })); await sleep(200);
  const n0 = cl[1].th.length;
  spec.send(JSON.stringify({ t: 'throw', to: ids[2], item: 'tomato' })); await sleep(150);
  tv.send(JSON.stringify({ t: 'throw', to: ids[2], item: 'tomato' })); await sleep(150);
  console.log(cl[1].th.length - n0 === 1 && cl[1].th.at(-1).fromName === '路人甲' ? 'ok   观众能扔、大屏不能扔' : 'FAIL 观众/大屏 ' + (cl[1].th.length - n0));
  const n1 = cl[1].th.length; tx(cl[3], { t: 'throw', to: ids[1], item: 'egg' }); tx(cl[3], { t: 'throw', to: ids[1], item: 'egg' }); tx(cl[3], { t: 'throw', to: ids[1], item: 'bomb' }); await sleep(200);
  console.log(cl[1].th.length - n1 === 1 ? 'ok   冷却与非法物品被拦' : 'FAIL 冷却 ' + (cl[1].th.length - n1));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9352', '--user-data-dir=' + OUT + '/prof4', '--autoplay-policy=no-user-gesture-required', 'about:blank']);
  await sleep(2500);
  const list = await (await fetch('http://127.0.0.1:9352/json')).json();
  const page = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => page.on('open', r));
  let id = 0; const pend = {}, errs = [];
  page.on('message', (d) => { const m = JSON.parse(d); if (pend[m.id]) pend[m.id](m.result); if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
  const cdp = (method, params = {}) => new Promise((r) => { pend[++id] = r; page.send(JSON.stringify({ id, method, params })); });
  const ev = (e) => cdp('Runtime.evaluate', { expression: e, awaitPromise: true });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 400, height: 860, deviceScaleFactor: 2, mobile: true });
  const shot = async (n) => { fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from((await cdp('Page.captureScreenshot')).data, 'base64')); };
  cl[0].w.close(); await sleep(150); await cdp('Page.navigate', { url: base }); await sleep(500);
  await ev(`localStorage.token='${tag}0';localStorage.name='${NM[0]}';localStorage.room='${code}';sessionStorage.clear()`); await cdp('Page.reload'); await sleep(1800);
  await ev(`document.getElementById('modal').innerHTML='';unlockAudio()`); await sleep(300);
  await ev(`document.getElementById('throwFab').click()`); await sleep(400); await shot('th1-panel');
  const mk0 = (await ev(`JSON.stringify(marks().m)`)).result.value;
  await ev(`document.querySelector('[data-pid="'+S.players[1].id+'"] .seat-av').click()`); await sleep(1300);
  const mk1 = (await ev(`JSON.stringify(marks().m)`)).result.value;
  console.log(cl[1].th.at(-1).from === S0me && mk0 === mk1 ? 'ok   投掷模式点头像直接扔、不改标记' : 'FAIL 点头像投掷');
  await ev(`document.getElementById('throwFab').click()`); await sleep(200);
  await sleep(1600); tx(cl[4], { t: 'throw', to: ids[0], item: 'egg' }); tx(cl[5], { t: 'throw', to: ids[2], item: 'tomato' }); spec.send(JSON.stringify({ t: 'throw', to: ids[3], item: 'rose' }));
  await sleep(380); await shot('th2-flying');
  await sleep(900); await shot('th3-hit');
  await ev(`pickThrow('shoe');doThrow(S.players[5].id)`); await sleep(1300); await shot('th4-shoe');
  console.log(errs.length ? 'FAIL 页面报错 ' + errs.join(' | ') : 'ok   页面无报错');
  chrome.kill(); server.kill(); process.exit(0);
})();
