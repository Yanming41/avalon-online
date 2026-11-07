// 起一个7人局推进到第2轮发车投票，然后用无头 Chrome 以 P0 身份打开页面截图（含上帝视角）
const WebSocket = require('ws'); const { spawn } = require('child_process'); const fs = require('fs');
const URL = 'ws://localhost:3123', OUT = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cl = []; let code; const tag = 'shot' + Date.now();
const mk = () => new Promise((res) => { const w = new WebSocket(URL); const c = { w, s: null }; w.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') code = m.code; }); w.on('open', () => res(c)); });
const tx = (c, o) => c.w.send(JSON.stringify(o));
const AV = ['🦁','🐺','🦊','🐻','🐼','🐯','🦉'];
(async () => {
  for (let i = 0; i < 7; i++) { const c = await mk(); cl.push(c); tx(c, { t: i ? 'join' : 'create', code, name: ['阿明','小红','老王','Leo','七七','大胖','Mia'][i], avatar: AV[i], token: tag + i }); await sleep(80); }
  const S = () => cl[0].s, by = (id) => cl.find((c) => c.s.me === id);
  tx(cl[0], { t: 'settings', settings: { cleric: true, sorcerer: true, lancelot: 2, percival: false, morgana: false } }); await sleep(80);
  tx(cl[0], { t: 'start' }); await sleep(150);
  for (let k = 0; k < 3; k++) { // 一次否决、一次通过+任务失败、再一次发车
    const s = S(); tx(by(s.leader), { t: 'propose', team: s.players.slice(k, k + s.teamSizes[s.quest]).map((p) => p.id) }); await sleep(80);
    cl.forEach((c, i) => tx(c, { t: 'vote', approve: k === 0 ? i < 2 : i < 5 })); await sleep(100);
    if (S().phase === 'quest') { for (const id of S().team) { const c = by(id); tx(c, { t: 'quest', card: c.s.myCards.includes('F') ? 'F' : c.s.myCards.at(-1) }); } await sleep(100); }
  }
  const s = S(); tx(by(s.leader), { t: 'propose', team: s.players.slice(0, s.teamSizes[s.quest]).map((p) => p.id) }); await sleep(80);
  cl.slice(0, 3).forEach((c) => tx(c, { t: 'vote', approve: true }));
  tx(by(S().leader), { t: 'speechStart' }); await sleep(100);
  cl[0].w.close(); await sleep(100);
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + OUT + '/prof', '--window-size=420,2600', 'about:blank']);
  await sleep(2500);
  const list = await (await fetch('http://127.0.0.1:9333/json')).json();
  const page = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => page.on('open', r));
  let id = 0; const pend = {}; const errs = [];
  page.on('message', (d) => { const m = JSON.parse(d); if (pend[m.id]) pend[m.id](m.result); if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(JSON.stringify(m.params.args)); });
  const cdp = (method, params = {}) => new Promise((r) => { pend[++id] = r; page.send(JSON.stringify({ id, method, params })); });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 400, height: 2400, deviceScaleFactor: 1, mobile: true });
  await cdp('Page.navigate', { url: 'http://localhost:3123/' }); await sleep(800);
  await cdp('Runtime.evaluate', { expression: `localStorage.token='${tag}0';localStorage.name='阿明';localStorage.room='${code}';localStorage.avatar='🦁';sessionStorage.clear()` });
  await cdp('Page.reload'); await sleep(1500);
  await cdp('Runtime.evaluate', { expression: `document.getElementById('modal').innerHTML=''` });
  // 推理标记交互：点 2 号头像两次（→坏人）、点 3 号一次（→好人）、长按 2 号再点 5 号 → 互踩
  const center = async (n) => JSON.parse((await cdp('Runtime.evaluate', { expression: `JSON.stringify((()=>{const r=document.querySelectorAll('[data-av]')[${n}].getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})())`, returnByValue: true })).result.value);
  const mouse = async (type, [x, y]) => cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  const tap = async (n) => { const c = await center(n); await mouse('mousePressed', c); await mouse('mouseReleased', c); await sleep(150); };
  const selBefore = (await cdp('Runtime.evaluate', { expression: 'sel.size', returnByValue: true })).result.value;
  await tap(1); await tap(1); await tap(2);
  { const c = await center(1); await mouse('mousePressed', c); await sleep(650); await mouse('mouseReleased', c); await sleep(150); }
  await tap(4); await sleep(150);
  await cdp('Runtime.evaluate', { expression: `[...document.querySelectorAll('#modal button')].find(b=>b.textContent.includes('互踩')).click()` }); await sleep(200);
  const st = (await cdp('Runtime.evaluate', { expression: 'JSON.stringify({marks:marks(),sel:sel.size})', returnByValue: true })).result.value;
  console.log('selBefore', selBefore, 'after', st);
  fs.writeFileSync(OUT + '/player.png', Buffer.from((await cdp('Page.captureScreenshot')).data, 'base64'));
  await cdp('Runtime.evaluate', { expression: `sessionStorage.godPw='test';localStorage.godRoom='${code}';delete localStorage.room` });
  await cdp('Page.reload'); await sleep(1500);
  await cdp('Runtime.evaluate', { expression: `document.getElementById('modal').innerHTML=''` });
  fs.writeFileSync(OUT + '/god.png', Buffer.from((await cdp('Page.captureScreenshot')).data, 'base64'));
  await cdp('Page.navigate', { url: 'http://localhost:3123/?r=1234' }); await sleep(800);
  await cdp('Runtime.evaluate', { expression: `localStorage.clear();sessionStorage.clear();location.reload()` }); await sleep(1200);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 400, height: 3000, deviceScaleFactor: 1, mobile: true });
  await cdp('Runtime.evaluate', { expression: `document.querySelectorAll('.flip')[1].classList.add('on');document.querySelectorAll('.flip')[14].classList.add('on')` }); await sleep(900);
  fs.writeFileSync(OUT + '/home.png', Buffer.from((await cdp('Page.captureScreenshot')).data, 'base64'));
  await cdp('Runtime.evaluate', { expression: `document.querySelector('.flip.on')&&document.querySelectorAll('.flip.on').forEach(e=>e.classList.remove('on'));document.getElementById('nm').value='测试';doCreate()` }); await sleep(1200);
  await cdp('Runtime.evaluate', { expression: `setS({cleric:true,lunatic:true,lancelot:2})` }); await sleep(600);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 400, height: 1900, deviceScaleFactor: 1, mobile: true });
  fs.writeFileSync(OUT + '/lobby.png', Buffer.from((await cdp('Page.captureScreenshot')).data, 'base64'));
  await cdp('Emulation.setDeviceMetricsOverride', { width: 400, height: 800, deviceScaleFactor: 1, mobile: true });
  await cdp('Runtime.evaluate', { expression: `scrollTo(0,0);showDetail('revealer')` }); await sleep(800);
  fs.writeFileSync(OUT + '/zoom.png', Buffer.from((await cdp('Page.captureScreenshot')).data, 'base64'));
  await cdp('Runtime.evaluate', { expression: `document.querySelector('.lightbox')?.remove()` });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp('Runtime.evaluate', { expression: `showDetail('oberon')` }); await sleep(1500);
  fs.writeFileSync(OUT + '/detail_pc.png', Buffer.from((await cdp('Page.captureScreenshot')).data, 'base64'));
  await cdp('Page.navigate', { url: 'http://localhost:3123/?watch=' + code }); await sleep(1500);
  await cdp('Runtime.evaluate', { expression: `document.getElementById('modal').innerHTML=''` });
  fs.writeFileSync(OUT + '/tv.png', Buffer.from((await cdp('Page.captureScreenshot')).data, 'base64'));
  console.log('errors:', errs.length ? errs : 'none');
  chrome.kill(); process.exit(0);
})();
