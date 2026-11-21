// 心跳与重连防抖测试：服务端 ping/pong、客户端防重复建连、断网探测
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const WebSocket = require('ws');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const assert = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };

(async () => {
  // 1. 服务端应用层 ping -> pong（不触发 state 广播）
  const port = 3149;
  const cwd = path.resolve(__dirname, '..');
  const srv = spawn(process.execPath, ['server.js'], {
    cwd,
    env: { ...process.env, PORT: String(port), RECORDS_GITHUB_TOKEN: '', RECORDS_REPO: '', SUPABASE_URL: '' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((r) => srv.stdout.on('data', (d) => { if (String(d).includes('Avalon on')) r(); }));
  try {
    const w = new WebSocket(`ws://127.0.0.1:${port}`);
    const msgs = [];
    w.on('message', (d) => msgs.push(JSON.parse(d)));
    await new Promise((r) => w.on('open', r));
    w.send(JSON.stringify({ t: 'create', name: 'P1', avatar: 'lion', token: 'hb-t1' }));
    await sleep(100);
    const statesBefore = msgs.filter((m) => m.t === 'state').length;
    w.send('{"t":"ping"}');
    await sleep(80);
    assert(msgs.some((m) => m.t === 'pong'), '服务端收到 ping 立刻回 pong');
    assert(msgs.filter((m) => m.t === 'state').length === statesBefore, 'ping/pong 不触发多余 state 广播');
    w.close();
  } finally {
    srv.kill();
  }

  // 2. 客户端 connect / checkConn 不重复建连、旧连接关闭不影响当前连接
  const code = fs.readFileSync(path.join(cwd, 'public', 'app.js'), 'utf8');
  const socks = [];
  class MockWS {
    constructor(url) {
      this.url = url;
      this.readyState = 0; // CONNECTING
      this.sent = [];
      socks.push(this);
    }
    send(d) { this.sent.push(d); }
    close() {
      if (this.readyState >= 2) return;
      this.readyState = 3;
      if (this.onclose) this.onclose();
    }
  }
  const listeners = {};
  const ctx = {
    WebSocket: MockWS,
    location: { protocol: 'https:', host: 'example.com', search: '', origin: 'https://example.com' },
    localStorage: { room: '1234', name: 'Alice' },
    sessionStorage: {},
    history: { replaceState() {} },
    crypto: { randomUUID: () => 'uuid-1' },
    navigator: {},
    document: {
      hidden: false,
      body: { classList: { add() {}, toggle() {}, remove() {} } },
      querySelector: () => ({ innerHTML: '' }),
      querySelectorAll: () => [],
      addEventListener: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
    },
    window: { addEventListener: (ev, fn) => { (listeners['w:' + ev] ||= []).push(fn); } },
    whenAuthReady: () => Promise.resolve(),
    authToken: () => undefined,
    matchMedia: () => ({ matches: false }),
    URLSearchParams,
    ROLES: {}, ITEMS: {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    console,
  };
  ctx.globalThis = ctx;
  // Stub minimal helpers overwritten later by table.js
  vm.createContext(ctx);
  vm.runInContext(code + '\nfunction render(){}\nfunction syncRulebook(){}\nfunction maybeEvent(){}', ctx);

  ctx.connect();
  assert(socks.length === 1, '首次 connect 创建 1 条连接');
  ctx.connect();
  ctx.checkConn();
  assert(socks.length === 1, 'CONNECTING 期间重复调用 connect/checkConn 不会建第 2 条连接');

  const s1 = socks[0];
  s1.readyState = 1;
  s1.onopen();
  await sleep(10);
  assert(s1.sent.some((x) => x.includes('"t":"join"')), '连上后自动回房间');

  // 切回前台时，如果连接仍 OPEN 会发一次 ping 探测而不是盲目重连
  ctx.checkConn();
  assert(socks.length === 1 && s1.sent.some((x) => x.includes('"t":"ping"')), '前台唤醒发送 ping 探测而非重复建连');
  // 模拟超时无 pong -> 自动切到新连接，且旧连接异步 onclose 不把新连接拉成离线
  await sleep(3600);
  assert(socks.length === 2, 'ping 超时自动重连到第 2 条连接');
  const s2 = socks[1];
  s2.readyState = 1;
  s2.onopen();
  assert(vm.runInContext('online', ctx) === true, '第 2 条连接已上线');
  if (s1.onclose) s1.onclose();
  assert(vm.runInContext('online', ctx) === true && socks.length === 2, '旧连接的迟到 onclose 不会打断新连接或引发循环重连');

  // 清理定时器以便进程退出
  vm.runInContext('stopHb(); clearTimeout(reconT);', ctx);
  console.log(fails ? `${fails} 项失败` : '全部通过');
  process.exit(fails ? 1 : 0);
})();
