// 账号系统（Supabase）：没配置环境变量时整个模块关闭，游戏照常以游客方式运行
//  SUPABASE_URL              项目地址，例如 https://xxxx.supabase.co
//  SUPABASE_ANON_KEY         公开 key（publishable / anon），会发给浏览器用来登录
//  SUPABASE_SERVICE_ROLE_KEY 服务端 key（secret / service_role），只在服务器上用来写对局记录，绝不能发给浏览器
//  AUTH_PROVIDERS            可选，逗号分隔的第三方登录，例如 google,discord（要先在 Supabase 后台开启）
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON = process.env.SUPABASE_ANON_KEY || '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PROVIDERS = (process.env.AUTH_PROVIDERS || '').split(',').map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z]+$/.test(s));

const enabled = () => !!(URL_ && ANON && SERVICE);
const AVATAR_PREFIX = URL_ ? `${URL_}/storage/v1/object/public/avatars/` : null;

// 浏览器需要的公开配置
const publicConfig = () => (enabled() ? { url: URL_, anonKey: ANON, providers: PROVIDERS } : { url: null });

const rest = (p, opt = {}) => fetch(`${URL_}/rest/v1/${p}`, {
  ...opt,
  // 新版 sb_secret_ key 不是 JWT，只能放在 apikey 头里；旧版 service_role JWT 两个头都放
  headers: { apikey: SERVICE, ...(SERVICE.startsWith('sb_') ? {} : { Authorization: `Bearer ${SERVICE}` }), 'Content-Type': 'application/json', ...(opt.headers || {}) },
});

// 用户 token → 用户 id（找 Supabase 验证，伪造的 token 过不了）；结果缓存 5 分钟
const cache = new Map();
async function verify(token) {
  if (!enabled() || !token || typeof token !== 'string' || token.length > 4096) return null;
  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) return hit.id;
  try {
    const r = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    cache.set(token, { id: u.id, exp: Date.now() + 5 * 60e3 });
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
    return u.id;
  } catch (e) { console.log('accounts: 验证 token 出错', e.message); return null; }
}

// 读用户资料（昵称、唯一用户名、头像）
async function profile(id) {
  try {
    const r = await rest(`profiles?id=eq.${encodeURIComponent(id)}&select=id,username,display_name,avatar_url,crest`);
    if (!r.ok) return null;
    return (await r.json())[0] || null;
  } catch (e) { console.log('accounts: 读资料出错', e.message); return null; }
}

// 登录用户 → 资料；token 无效或还没建资料时返回 null
async function lookup(token) {
  const id = await verify(token);
  return id ? profile(id) : null;
}

// 只接受本项目 avatars 桶里的图片地址
const isAvatarUrl = (s) => typeof s === 'string' && !!AVATAR_PREFIX && s.length < 400 && s.startsWith(AVATAR_PREFIX) && !/[\s"'<>()\\]/.test(s);

// 对局结束：写一条对局 + 每位玩家一行（游客 user_id 为空）
async function saveGame(rec, userIds) {
  if (!enabled()) return;
  try {
    const g = await rest('games', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ id: rec.id, ended_at: new Date(rec.endedAt).toISOString(), winner: rec.winner, reason: rec.reason, player_count: rec.players.length, record: rec }),
    });
    if (!g.ok) return console.log('accounts: 写对局失败', g.status, (await g.text()).slice(0, 200));
    const rows = rec.players.map((p, i) => ({
      game_id: rec.id, seat: p.seat, user_id: userIds[i] || null, name: p.name, role: p.role, evil: !!p.evil, won: (rec.winner === 'evil') === !!p.evil,
    }));
    const r = await rest('game_players', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(rows) });
    if (!r.ok) console.log('accounts: 写玩家战绩失败', r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.log('accounts: 写对局出错', e.message); }
}

module.exports = { enabled, publicConfig, lookup, verify, profile, isAvatarUrl, saveGame };
