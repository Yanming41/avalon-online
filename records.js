// 战绩存档：每局结束生成一条记录，存三处
//  1) 内存（最近 300 局，立刻可查）
//  2) 本地文件 data/games.jsonl（本机运行时持久；Render 免费版磁盘重启会丢）
//  3) GitHub 私有仓库（设置了 RECORDS_GITHUB_TOKEN + RECORDS_REPO 时；长期保存，服务器重启后自动读回）
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.RECORDS_GITHUB_TOKEN || '';
const REPO = process.env.RECORDS_REPO || ''; // 例如 Yanming41/avalon-records
const DIR = path.join(__dirname, 'data');
const FILE = path.join(DIR, 'games.jsonl');
const MAX = 300;
let games = []; // 新的在前
let loaded = false;

const gh = (p, opt = {}) => fetch(`https://api.github.com/repos/${REPO}/contents/${p}`, {
  ...opt,
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'avalon-online', ...(opt.headers || {}) },
});

async function load() {
  if (loaded) return; loaded = true;
  const byId = new Map();
  try { for (const l of fs.readFileSync(FILE, 'utf8').split('\n')) if (l.trim()) { const g = JSON.parse(l); byId.set(g.id, g); } } catch {}
  if (TOKEN && REPO) {
    try {
      const r = await gh('games');
      if (r.ok) {
        const list = (await r.json()).filter((f) => f.name.endsWith('.json')).sort((a, b) => b.name.localeCompare(a.name)).slice(0, MAX);
        for (const f of list) {
          if ([...byId.values()].some((g) => f.name.includes(g.id))) continue;
          try { const raw = await (await fetch(f.download_url, { headers: { Authorization: `Bearer ${TOKEN}` } })).json(); byId.set(raw.id, raw); } catch {}
        }
      } else if (r.status !== 404) console.log('records: GitHub 读取失败', r.status);
    } catch (e) { console.log('records: GitHub 读取出错', e.message); }
  }
  games = [...byId.values()].sort((a, b) => b.endedAt - a.endedAt).slice(0, MAX);
  console.log(`records: 读入 ${games.length} 局战绩${TOKEN && REPO ? '（含 GitHub）' : ''}`);
}

async function save(rec) {
  games.unshift(rec); if (games.length > MAX) games.length = MAX;
  try { fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(FILE, JSON.stringify(rec) + '\n'); } catch (e) { console.log('records: 写文件失败', e.message); }
  if (TOKEN && REPO) {
    const d = new Date(rec.endedAt), name = `games/${d.toISOString().slice(0, 10)}-${rec.id}.json`;
    try {
      const r = await gh(name, { method: 'PUT', body: JSON.stringify({ message: `game ${rec.id}`, content: Buffer.from(JSON.stringify(rec, null, 1)).toString('base64') }) });
      if (!r.ok) console.log('records: GitHub 写入失败', r.status, (await r.text()).slice(0, 200));
    } catch (e) { console.log('records: GitHub 写入出错', e.message); }
  }
}

const list = () => games.map(({ history, ...g }) => g); // 列表不带逐轮明细
const get = (id) => games.find((g) => g.id === id) || null;
const enabled = () => !!(TOKEN && REPO);

module.exports = { load, save, list, get, enabled };
