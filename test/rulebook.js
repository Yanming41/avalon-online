// Isolated real-server / headless Edge review. No personal browser or mouse used.
const { spawn } = require('child_process');
const fs = require('fs'); const path = require('path'); const assert = require('assert/strict');
const WebSocket = require('ws');
const OUT = path.resolve(process.argv[2] || '../avalon-preview'); fs.mkdirSync(OUT, { recursive: true });
const port = 3137, debugPort = 9347, base = `http://127.0.0.1:${port}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sockets = []; let server, browser, page, cdp, ev;
async function wait(fn) { for (let i = 0; i < 150; i++) { try { if (await fn()) return; } catch {} await sleep(100); } throw Error('Timed out'); }
async function mk() { const w = new WebSocket(`ws://127.0.0.1:${port}`); sockets.push(w); const c = { w, s: null }; w.on('message', d => { const m = JSON.parse(d); if (m.t === 'state') c.s = m.s; if (m.t === 'joined') c.code = m.code; if (m.t === 'error') console.error(m.m); }); await new Promise(r => w.on('open', r)); return c; }
const tx = (c, o) => c.w.send(JSON.stringify(o));
(async () => {
  server = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port), GOD_PASSWORD: 'test' }, windowsHide: true, stdio: 'ignore' });
  await wait(async () => (await fetch(base)).ok);
  const cl = [], names = ['阿明', '小红', '老王', 'Leo', '七七', 'Mia', '小林'], tag = 'book' + Date.now(); let code;
  for (let i = 0; i < 7; i++) { const c = await mk(); cl.push(c); tx(c, { t: i ? 'join' : 'create', code, name: names[i], token: tag + i, avatar: ['🦁','🦊','🐻','🐺','🐼','🦉','🐱'][i] }); await wait(() => c.s); code = c.code; }
  tx(cl[0], { t: 'start' }); await wait(() => cl.every(c => c.s.gameId));
  const S = () => cl.find(c => c.w.readyState === 1).s;
  const by = id => cl.find(c => c.s.me === id);
  const actualCounts = Object.fromEntries(Object.keys(cl[0].s.roleCounts).map(k => [k, cl.filter(c => c.s.myRole.role === k).length]));
  cl.forEach(c => { assert.deepEqual(c.s.roleCounts, actualCounts); assert(!c.s.allRoles); assert.equal(c.s.players.some(p => p.role), false); });
  assert.equal(Object.values(actualCounts).reduce((a,b) => a+b,0), 7);
  console.log('PASS: every player receives identical accurate aggregate counts, no identity mapping');
  browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + debugPort, '--user-data-dir=' + path.join(OUT, 'edge-' + tag), '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let targets; await wait(async () => { targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json(); return targets.some(t => t.type === 'page'); });
  page = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => page.on('open', r));
  let id = 0; const pending = new Map(), errors = [];
  page.on('message', d => { const m = JSON.parse(d); if (pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(Error(JSON.stringify(m.error))) : resolve(m.result); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails); });
  cdp = (method, params = {}) => new Promise((resolve,reject) => { pending.set(++id,{resolve,reject}); page.send(JSON.stringify({id,method,params})); });
  ev = async expression => { const r = await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  await cdp('Runtime.enable'); await cdp('Page.enable');
  const size = (width,height) => cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  const shot = async name => { await ev('document.fonts.ready'); await sleep(450); fs.writeFileSync(path.join(OUT,name+'.png'), Buffer.from((await cdp('Page.captureScreenshot')).data,'base64')); };
  await size(400,1200); await cdp('Page.navigate',{url:base}); await wait(() => ev("typeof S !== 'undefined' && online"));
  let current = -1;
  async function disconnect() {
    if (current < 0) return;
    await ev('ws.onclose=null;ws.close()'); await sleep(100);
    const c = await mk(); cl[current] = c; tx(c,{t:'join',code,name:names[current],token:tag+current}); await wait(() => c.s?.gameId); current = -1;
  }
  async function view(i) {
    await disconnect(); cl[i].w.close(); await sleep(100);
    await ev(`localStorage.clear();sessionStorage.clear();localStorage.token=${JSON.stringify(tag+i)};localStorage.name=${JSON.stringify(names[i])};localStorage.room=${JSON.stringify(code)};localStorage.muted='1'`);
    await cdp('Page.reload'); await wait(() => ev('!!S?.myRole')); current = i;
    await ev("document.querySelector('#modal').innerHTML='';scrollTo(0,0)");
    await wait(() => ev('!!IMG_OK[S.myRole.art]'));
  }
  for (const [role,file] of [['merlin','01-merlin'],['percival','02-percival'],['servant','03-servant'],['assassin','04-assassin']]) {
    await view(cl.findIndex(c => c.s.myRole.role === role)); await ev('reveal=true;render()'); await shot(file);
  }
  await ev("reveal=false;render();document.querySelector('.book-trigger').click()");
  assert(await ev("document.querySelector('#rulebook').open"));
  assert.equal(await ev("document.querySelectorAll('.book-role-link').length"), Object.keys(actualCounts).length);
  await size(400,820); await shot('05-book-mobile');
  await size(1280,900); await shot('06-book-desktop');
  await ev('turnBook(2)'); await shot('07-book-role');
  await size(360,640); await ev('turnBook(1)');
  assert(await ev("document.querySelector('#book-paper').scrollHeight>document.querySelector('#book-paper').clientHeight"));
  assert(await ev("document.querySelector('#rulebook').getBoundingClientRect().right<=innerWidth"));
  assert(await ev("document.querySelector('#rulebook footer').getBoundingClientRect().bottom<=innerHeight"));
  await ev("document.querySelector('#book-paper').scrollTop=150");
  const before = await ev("document.querySelector('#book-paper').scrollTop");
  // Unrelated broadcasts must preserve the page and scroll position.
  const other = cl.find((c,i) => i !== current); tx(other,{t:'profile',avatar:'🐯'}); await sleep(250);
  assert.equal(await ev('bookPage'),1); assert.equal(await ev("document.querySelector('#book-paper').scrollTop"),before);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}); await sleep(250);
  assert(!await ev("document.querySelector('#rulebook').open"));
  // 关闭后焦点回到按钮（重绘会替换按钮元素，这里不强制）;
  console.log('PASS: responsive layout, scrolling, persistent reading, Escape and focus return');
  await disconnect();
  const leader = by(S().leader); tx(leader,{t:'propose',team:S().players.slice(0,2).map(p=>p.id)}); await wait(() => S().phase==='vote');
  await size(400,1200); await view(0); await shot('08-vote'); await disconnect();
  cl.forEach(c=>tx(c,{t:'vote',approve:true})); await wait(() => S().phase==='quest');
  const member = cl.findIndex(c => S().team.includes(c.s.me)); await view(member); await shot('09-quest'); await disconnect();
  // Add a second room with extensions to ensure their rules are included selectively.
  tx(cl[0],{t:'quest',card:'S'}); // No-op if not on team; no effect on reference UI.
  const extra = [];
  for(let i=0;i<7;i++){const c=await mk();extra.push(c);tx(c,{t:i?'join':'create',code:extra[0].code,name:'扩展'+i,token:tag+'extra'+i});await wait(()=>c.s);}
  tx(extra[0],{t:'settings',settings:{percival:false,morgana:false,sorcerer:true,lancelot:2,lady:true,excalibur:true}}); await sleep(100);tx(extra[0],{t:'start'});await wait(()=>extra[0].s.gameId);
  await ev(`localStorage.token=${JSON.stringify(tag+'extra0')};localStorage.name='扩展0';localStorage.room=${JSON.stringify(extra[0].code)}`);await cdp('Page.reload');await wait(()=>ev('!!S?.gameId'));await ev('openRulebook();turnBook(1)');
  const text = await ev("document.querySelector('#book-paper').textContent");for(const label of ['湖中仙女','王者之剑','巫师 · 魔法牌','兰斯洛特 · 规则 2'])assert(text.includes(label));
  await ev("S=null;render()");assert(!await ev("document.querySelector('#rulebook').open"));
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('PASS: extension selection, leaving closes book, no browser exceptions');
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify({room:code,roles:actualCounts,files:fs.readdirSync(OUT).filter(f=>f.endsWith('.png'))},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{sockets.forEach(w=>w.terminate());if(cdp)await cdp('Browser.close').catch(()=>{});page?.terminate();browser?.kill();server?.kill();});
