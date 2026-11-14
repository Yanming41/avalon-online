// 对局续存（热更新不打断对局）：把所有房间的状态存成一份快照，服务器重启/重新部署后读回
//  - 有变化后 3 秒写一次（防抖），收到 SIGTERM（Render 部署换进程）时立刻再写一次
//  - 存到战绩私有仓库的 live-state 分支 rooms.json；没配 GitHub 时存本地 data/rooms.json
//  - 新进程启动时读一次；Render 是先起新进程再关旧进程，旧进程最后几秒的操作会晚到，
//    所以启动后 3 分钟内，有人连进来时会再拉一次最新快照（只拉一次，之后以本进程为准）
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.RECORDS_GITHUB_TOKEN || '';
const REPO = process.env.RECORDS_REPO || '';
const BRANCH = 'live-state', FILE_PATH = 'rooms.json';
const LOCAL = path.join(__dirname, 'data', 'rooms.json');
const remote = !!(TOKEN && REPO);
const bootAt = Date.now();
let sha = null, timer = null, writing = Promise.resolve(), lastJson = '', refreshed = false, branchOk = false;

const gh = (p, opt = {}) => fetch(`https://api.github.com/repos/${REPO}${p ? "/" + p : ""}`, {
  ...opt,
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'avalon-online', ...(opt.headers || {}) },
});

// 房间 → 可存的纯数据（去掉连接、定时器）
function pack(rooms) {
  return JSON.stringify([...rooms.values()].map((r) => {
    const { gods, watchers, speechTimer, ...rest } = r;
    return { ...rest, players: r.players.map(({ ws, ...p }) => p) };
  }));
}

async function ensureBranch() {
  const b = await gh(`branches/${BRANCH}`);
  if (b.ok) return true;
  const repo = await (await gh('')).json();
  const head = await (await gh(`git/ref/heads/${repo.default_branch}`)).json();
  const r = await gh('git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: head.object.sha }) });
  return r.ok;
}

async function fetchSnapshot() {
  if (!remote) { try { return JSON.parse(fs.readFileSync(LOCAL, 'utf8')); } catch { return null; } }
  try {
    const r = await gh(`contents/${FILE_PATH}?ref=${BRANCH}`);
    if (!r.ok) return null;
    const j = await r.json(); sha = j.sha;
    return JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
  } catch (e) { console.log('state: 读取快照失败', e.message); return null; }
}

async function write(json) {
  if (json === lastJson) return;
  if (!remote) { try { fs.mkdirSync(path.dirname(LOCAL), { recursive: true }); fs.writeFileSync(LOCAL, json); lastJson = json; } catch {} return; }
  if (!branchOk) { try { branchOk = await ensureBranch(); } catch (e) { console.log('state: 建分支出错', e.message); } }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await gh(`contents/${FILE_PATH}`, { method: 'PUT', body: JSON.stringify({ message: 'state', branch: BRANCH, content: Buffer.from(json).toString('base64'), ...(sha ? { sha } : {}) }) });
      if (r.ok) { sha = (await r.json()).content.sha; lastJson = json; return; }
      if (r.status === 409 || r.status === 422) { await fetchSnapshot(); continue; } // sha 过期：拿到最新 sha 再写
      if (r.status === 404 && attempt === 0) { await ensureBranch(); continue; }
      console.log('state: 写快照失败', r.status, (await r.text()).slice(0, 200)); return;
    } catch (e) { console.log('state: 写快照出错', e.message); return; }
  }
}

module.exports = {
  remote,
  fetchSnapshot,
  // 启动后 3 分钟内第一次有人连进来时，需要再拉一次快照
  needRefresh: () => !refreshed && Date.now() - bootAt < 180e3,
  markRefreshed: () => { refreshed = true; },
  schedule(rooms) { clearTimeout(timer); timer = setTimeout(() => { const j = pack(rooms); writing = writing.then(() => write(j)); }, 3000); },
  flush(rooms) { clearTimeout(timer); const j = pack(rooms); writing = writing.then(() => write(j)); return writing; },
};
