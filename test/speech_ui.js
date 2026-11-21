// 发言按钮放大 & 空格/回车快捷键测试
const path = require('path');
const fs = require('fs');
const vm = require('vm');

let fails = 0;
const assert = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };

const cwd = path.resolve(__dirname, '..');
const appCode = fs.readFileSync(path.join(cwd, 'public', 'app.js'), 'utf8');
const tableCode = fs.readFileSync(path.join(cwd, 'public', 'table.js'), 'utf8');

const sent = [];
const listeners = {};
const modalEl = { innerHTML: '' };
const rulebookEl = { open: false };

const ctx = {
  WebSocket: class { send() {} close() {} },
  location: { protocol: 'https:', host: 'example.com', search: '?watch=1234', origin: 'https://example.com' },
  localStorage: {},
  sessionStorage: {},
  history: { replaceState() {} },
  crypto: { randomUUID: () => 'u1' },
  navigator: {},
  matchMedia: () => ({ matches: false }),
  URLSearchParams,
  requestAnimationFrame: () => {},
  document: {
    hidden: false,
    body: { classList: { add() {}, toggle() {}, remove() {} } },
    querySelector: (s) => (s === '#modal' ? modalEl : s === '#rulebook' ? rulebookEl : { innerHTML: '' }),
    querySelectorAll: () => [],
    addEventListener: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
  },
  window: { addEventListener: () => {} },
  whenAuthReady: () => Promise.resolve(),
  authToken: () => undefined,
  ROLES: {},
  ITEMS: {},
  setTimeout, clearTimeout, setInterval, clearInterval,
  console,
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(appCode + '\n' + tableCode, ctx);
vm.runInContext('send = (o) => { __sent.push(o); };', Object.assign(ctx, { __sent: sent }));

const keydown = (over) => {
  let prevented = false;
  const ev = {
    key: ' ',
    code: 'Space',
    repeat: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: { closest: () => null },
    preventDefault: () => { prevented = true; },
    ...over,
  };
  for (const fn of listeners.keydown || []) fn(ev);
  return prevented;
};

// 1. 大屏发言栏含加大按钮与快捷键提示
vm.runInContext(`S = { phase: 'propose', me: null, hostId: 'p1', leader: 'p1', players: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }], speech: { order: ['p1', 'p2'], idx: 0, ready: true, secs: 90, dir: 1 } };`, ctx);
const barHtml = vm.runInContext('tvSpeechBar()', ctx);
assert(barHtml.includes('spb sp-go') && barHtml.includes('spb sp-skip') && barHtml.includes('spb sp-stop'), '大屏发言栏使用放大按钮类 spb');
assert(barHtml.includes('空格 / 回车'), '大屏发言栏显示快捷键提示');

// 2. ready=true 时空格发送 speechGo，repeat 被忽略
const p1 = keydown({ code: 'Space', key: ' ' });
assert(p1 && sent.length === 1 && sent[0].t === 'speechGo', '准备中按空格触发开始计时 (speechGo)');
keydown({ code: 'Space', key: ' ', repeat: true });
assert(sent.length === 1, '长按重复 repeat 不触发多余操作');

// 3. ready=false 时回车发送 speechNext
vm.runInContext('S.speech.ready = false;', ctx);
const p2 = keydown({ code: 'Enter', key: 'Enter' });
assert(p2 && sent.length === 2 && sent[1].t === 'speechNext', '发言中按回车触发下一位 (speechNext)');

// 4. 弹窗 / 输入框聚焦时不拦截
modalEl.innerHTML = '<div>modal</div>';
const p3 = keydown({ code: 'Space', key: ' ' });
assert(!p3 && sent.length === 2, '弹窗打开时不触发快捷键');
modalEl.innerHTML = '';

const p4 = keydown({ code: 'Enter', key: 'Enter', target: { closest: () => ({}) } });
assert(!p4 && sent.length === 2, '聚焦输入或按钮时不触发快捷键');

console.log(fails ? `${fails} 项失败` : '全部通过');
process.exit(fails ? 1 : 0);
