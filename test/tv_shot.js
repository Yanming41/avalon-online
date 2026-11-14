// 投屏大屏截图：7 人局 发言计时中 + 狂扔道具（1920x1080）
const WebSocket = require('ws'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; const port = 3143, base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  await sleep(900);
  const cl = []; let code; const tag = 'tv' + Date.now();
  const AV = ['lion', 'dragon', 'stag', 'wolf', 'owl', 'swan', 'eagle'], NM = ['阿明', '小红', '老王', 'Leo', '七七', '大胖', 'Mia'];
  for (let i = 0; i < 7; i++) { const w = new WebSocket(`ws://127.0.0.1:${port}`); const c = { w, s: null }; w.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') code = m.code; }); await new Promise((r) => w.on('open', r)); cl.push(c); w.send(JSON.stringify({ t: i ? 'join' : 'create', code, name: NM[i], avatar: AV[i], token: tag + i })); await sleep(80); }
  const tx = (c, o) => c.w.send(JSON.stringify(o)); const by = (id) => cl.find((c) => c.s.me === id);
  tx(cl[0], { t: 'start' }); await sleep(300);
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9353', '--user-data-dir=' + OUT + '/prof5', 'about:blank']);
  await sleep(2500);
  const list = await (await fetch('http://127.0.0.1:9353/json')).json();
  const page = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => page.on('open', r));
  let id = 0; const pend = {}, errs = [];
  page.on('message', (d) => { const m = JSON.parse(d); if (pend[m.id]) pend[m.id](m.result); if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
  const cdp = (method, params = {}) => new Promise((r) => { pend[++id] = r; page.send(JSON.stringify({ id, method, params })); });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const shot = async (n) => { fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from((await cdp('Page.captureScreenshot')).data, 'base64')); };
  await cdp('Page.navigate', { url: base + '/?watch=' + code }); await sleep(2000);
  await shot('tv1-propose');
  const s = cl[0].s; tx(by(s.leader), { t: 'speechStart', start: s.players[2].id, dir: 1 }); await sleep(300);
  await shot('tv2-ready');
  const sp = cl[0].s.speech; tx(by(sp.order[sp.idx]), { t: 'speechGo' }); await sleep(3000);
  // 狂扔：每人连扔
  for (let k = 0; k < 4; k++) { cl.forEach((c, i) => tx(c, { t: 'throw', to: cl[(i + 3) % 7].s.me, item: ['egg', 'tomato', 'rose', 'shoe', 'cabbage', 'goblet'][(i + k) % 6] })); await sleep(1600); }
  await sleep(200); await shot('tv3-speech-throw');
  const t0 = Date.now(); const fps = (await cdp('Runtime.evaluate', { expression: `new Promise(r=>{let n=0;const s=performance.now();(function f(){n++;performance.now()-s<1000?requestAnimationFrame(f):r(n)})()})`, awaitPromise: true })).result.value;
  console.log('fps during throws', fps, errs.length ? 'ERR ' + errs.join('|') : 'no errors');
  chrome.kill(); server.kill(); process.exit(0);
})();
