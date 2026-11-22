// 账号：登录 / 注册 / 唯一用户名 / 昵称 / 上传头像 / 我的战绩（Supabase）
// 服务器没配置 Supabase 时，这里什么都不显示，游戏照常以游客方式玩
const ACC = { cfg: null, sb: null, session: null, profile: null, ready: null, busy: false };
const SB_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
const UNAME_RE = /^[a-z0-9_.]{3,20}$/;
const accOn = () => !!(ACC.sb);
const accIn = () => !!(ACC.session && ACC.profile);
const authToken = () => (ACC.session ? ACC.session.access_token : undefined);
const whenAuthReady = () => ACC.ready || Promise.resolve();
const PROVIDER_UI = {
  google: { name: 'Google', ico: '<svg viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1S8.7 5.8 12 5.8c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z"/></svg>' },
  discord: { name: 'Discord', ico: '<svg viewBox="0 0 24 24"><path fill="#8c9eff" d="M19.6 5.3A17 17 0 0 0 15.4 4l-.5 1a15.7 15.7 0 0 0-5.8 0l-.5-1a17 17 0 0 0-4.2 1.3C1.8 9.3 1.1 13.2 1.4 17a17 17 0 0 0 5.2 2.6l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12.2 12.2 0 0 0 11.2 0l.4.3-1.7.8 1.1 1.8a17 17 0 0 0 5.2-2.6c.4-4.4-.7-8.3-3-11.7zM8.7 14.7c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1zm6.6 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1z"/></svg>' },
  github: { name: 'GitHub', ico: '<svg viewBox="0 0 24 24"><path fill="#f0e6cf" d="M12 1.5a10.5 10.5 0 0 0-3.3 20.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.4-3.5-1.4-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.5 1.2 3.1.9.1-.7.4-1.2.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2.1 1.1-2.8-.1-.3-.5-1.4.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.2 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.5.1 2.8.7.8 1.1 1.7 1.1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10.5 10.5 0 0 0 12 1.5z"/></svg>' },
};

// ---------- 启动：读配置、按需加载 supabase-js、恢复登录状态 ----------
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
ACC.ready = (async () => {
  try {
    ACC.cfg = await (await fetch('/api/config')).json();
    if (!ACC.cfg || !ACC.cfg.url) return;
    if (!window.supabase) await loadScript(SB_JS);
    ACC.sb = window.supabase.createClient(ACC.cfg.url, ACC.cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data } = await ACC.sb.auth.getSession();
    ACC.session = data.session;
    if (ACC.session) await accLoadProfile();
    ACC.sb.auth.onAuthStateChange((ev, session) => {
      ACC.session = session;
      // 回调里不能直接 await 其他 supabase 调用，放到下一轮
      setTimeout(async () => {
        if (ev === 'PASSWORD_RECOVERY') return accResetView();
        if (ev === 'SIGNED_OUT') { ACC.profile = null; return render(); }
        if (ev === 'SIGNED_IN' && session && (!ACC.profile || ACC.profile.id !== session.user.id)) {
          await accLoadProfile(); accCleanUrl();
          if (!ACC.profile) accOnboard(); else { closeModal(); toast(`欢迎回来，${ACC.profile.display_name}`, true); }
          render();
        }
      });
    });
    if (ACC.session && !ACC.profile) setTimeout(accOnboard, 300); // 注册了但还没起用户名
  } catch (e) { console.warn('账号系统没加载成功，先以游客身份玩', e); ACC.sb = null; }
  finally { if (typeof render === 'function') render(); }
})();
function accCleanUrl() { // OAuth / 邮件链接回来后，把地址栏里的 code / token 去掉
  const u = new URL(location.href); let changed = false;
  for (const k of ['code', 'error', 'error_description', 'error_code']) if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true; }
  if (u.hash.includes('access_token') || u.hash.includes('error')) { u.hash = ''; changed = true; }
  if (changed) history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
}
async function accLoadProfile() {
  if (!ACC.session) return (ACC.profile = null);
  const { data, error } = await ACC.sb.from('profiles').select('id,username,display_name,avatar_url,crest').eq('id', ACC.session.user.id).maybeSingle();
  if (error) console.warn('读资料失败', error);
  ACC.profile = data || null;
  if (ACC.profile) localStorage.name = ACC.profile.display_name;
  return ACC.profile;
}
const accAvatar = (pr, fb = myAvatar) => (pr && pr.avatar_url) || (pr && pr.crest) || fb;

// ---------- 首页 / 大厅里的账号卡片 ----------
function accountHomeCard() {
  if (!accOn()) return '';
  if (!accIn()) return `<div class="card acc-cta"><div class="acc-cta-t"><b>登录后战绩跟着账号走</b><span>换手机、换名字都不丢；还能上传头像、看自己每个角色的胜率。</span></div>
    <div class="row"><button onclick="accAuthView('in')">登录</button><button class="sec" onclick="accAuthView('up')">注册</button></div></div>`;
  const p = ACC.profile;
  return `<div class="card acc-me"><div class="acc-chip"><span class="acc-av">${avH(accAvatar(p))}</span>
    <div class="acc-id"><b>${esc(p.display_name)}</b><span>@${esc(p.username)}</span></div>
    <span class="acc-act"><span class="tbtn" title="编辑资料" onclick="accEditView()">✎</span></span></div>
    <div class="row"><button class="sec sm" onclick="accStatsView()">📊 我的战绩</button><button class="sec sm" onclick="accEditView()">编辑资料</button><button class="sec sm" onclick="accSignOut()">退出登录</button></div></div>`;
}
function accountLobbyCard() {
  const p = ACC.profile;
  return `<div class="card acc-me"><h3>我的资料</h3><div class="acc-chip"><span class="acc-av">${avH(accAvatar(p))}</span>
    <div class="acc-id"><b>${esc(p.display_name)}</b><span>@${esc(p.username)}</span></div></div>
    <button class="sec" onclick="accEditView()">更换头像 / 改昵称</button></div>`;
}
async function accSignOut() {
  if (S && S.me) return toast('先离开房间再退出登录');
  await ACC.sb.auth.signOut(); ACC.session = null; ACC.profile = null; toast('已退出登录', true); render();
}

// ---------- 弹窗外壳 ----------
function accModal(inner, opts = {}) {
  $('#modal').innerHTML = `<div class="modal acc-modal" ${opts.lock ? '' : 'onclick="if(event.target===this)closeModal()"'}><div class="box acc-box">
    ${opts.lock ? '' : '<span class="acc-x" onclick="closeModal()" aria-label="关闭">✕</span>'}${inner}</div></div>`;
}
const accErr = (m) => { const e = $('#acc-err'); if (e) { e.textContent = m; e.classList.toggle('on', !!m); } };
const accBusy = (on, btnSel = '#acc-go') => { ACC.busy = on; const b = $(btnSel); if (b) { b.disabled = on; b.classList.toggle('loading', on); } };

// ---------- 登录 / 注册 ----------
function accAuthView(mode = 'in') {
  const provs = (ACC.cfg.providers || []).filter((k) => PROVIDER_UI[k]);
  accModal(`<div class="acc-head"><div class="acc-seal">⚜</div><h3>${mode === 'up' ? '加入圆桌' : '回到卡美洛'}</h3><div class="mute">${mode === 'up' ? '注册一个账号，战绩和头像跟着你走' : '登录你的阿瓦隆账号'}</div></div>
    <div class="acc-tabs" role="tablist"><span class="${mode === 'in' ? 'on' : ''}" onclick="accAuthView('in')">登录</span><span class="${mode === 'up' ? 'on' : ''}" onclick="accAuthView('up')">注册</span><i class="${mode}"></i></div>
    <form onsubmit="event.preventDefault();accSubmit('${mode}')" autocomplete="on">
      <label class="acc-f"><span>邮箱</span><input id="acc-em" type="email" autocomplete="email" required placeholder="you@example.com"></label>
      <label class="acc-f"><span>密码</span><input id="acc-pw" type="password" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}" required minlength="6" placeholder="${mode === 'up' ? '至少 6 位' : '你的密码'}"></label>
      ${mode === 'up' ? '<label class="acc-f"><span>再输一次密码</span><input id="acc-pw2" type="password" autocomplete="new-password" required minlength="6"></label>' : ''}
      <div id="acc-err" class="acc-err"></div>
      <button id="acc-go" type="submit">${mode === 'up' ? '注册' : '登录'}</button>
    </form>
    ${mode === 'in' ? '<div class="acc-links"><a onclick="accForgotView()">忘记密码？</a></div>' : ''}
    ${provs.length ? `<div class="acc-or"><span>或者</span></div>${provs.map((k) => `<button class="sec acc-oauth" onclick="accOAuth('${k}')">${PROVIDER_UI[k].ico}使用 ${PROVIDER_UI[k].name} ${mode === 'up' ? '注册' : '登录'}</button>`).join('')}` : ''}
    <div class="acc-links"><a onclick="closeModal()">先以游客身份玩</a></div>`);
  setTimeout(() => { const e = $('#acc-em'); if (e && !matchMedia('(pointer: coarse)').matches) e.focus(); }, 60);
}
async function accSubmit(mode) {
  if (ACC.busy) return;
  const email = $('#acc-em').value.trim(), password = $('#acc-pw').value;
  if (mode === 'up' && password !== $('#acc-pw2').value) return accErr('两次输入的密码不一样');
  accErr(''); accBusy(true);
  try {
    if (mode === 'up') {
      const { data, error } = await ACC.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/' } });
      if (error) return accErr(accMsg(error));
      if (!data.session) return accModal(`<div class="acc-head"><div class="acc-seal">✉</div><h3>查收邮件</h3></div>
        <p class="center">确认邮件已经发到 <b>${esc(email)}</b>。<br>点邮件里的链接就能完成注册，然后回来起一个用户名。</p>
        <div class="mute center">没收到？看看垃圾邮件箱，或者等一分钟再试。</div><button onclick="closeModal()">好的</button>`);
      // 项目关了邮件确认时，注册完直接就是登录状态，onAuthStateChange 会接着弹出起用户名
    } else {
      const { error } = await ACC.sb.auth.signInWithPassword({ email, password });
      if (error) return accErr(accMsg(error));
    }
  } finally { accBusy(false); }
}
async function accOAuth(provider) {
  const { error } = await ACC.sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + '/' } });
  if (error) toast(accMsg(error));
}
function accForgotView() {
  accModal(`<div class="acc-head"><div class="acc-seal">🗝</div><h3>找回密码</h3><div class="mute">我们会发一封重设密码的邮件给你</div></div>
    <form onsubmit="event.preventDefault();accForgot()"><label class="acc-f"><span>邮箱</span><input id="acc-em" type="email" autocomplete="email" required></label>
    <div id="acc-err" class="acc-err"></div><button id="acc-go" type="submit">发送重设邮件</button></form>
    <div class="acc-links"><a onclick="accAuthView('in')">← 返回登录</a></div>`);
}
async function accForgot() {
  accBusy(true);
  const { error } = await ACC.sb.auth.resetPasswordForEmail($('#acc-em').value.trim(), { redirectTo: location.origin + '/' });
  accBusy(false);
  if (error) return accErr(accMsg(error));
  toast('邮件已发送，请查收', true); closeModal();
}
function accResetView() {
  accModal(`<div class="acc-head"><div class="acc-seal">🗝</div><h3>设置新密码</h3></div>
    <form onsubmit="event.preventDefault();accReset()"><label class="acc-f"><span>新密码</span><input id="acc-pw" type="password" autocomplete="new-password" minlength="6" required></label>
    <div id="acc-err" class="acc-err"></div><button id="acc-go" type="submit">保存新密码</button></form>`, { lock: true });
}
async function accReset() {
  accBusy(true);
  const { error } = await ACC.sb.auth.updateUser({ password: $('#acc-pw').value });
  accBusy(false);
  if (error) return accErr(accMsg(error));
  accCleanUrl(); closeModal(); toast('密码已更新', true);
  if (!ACC.profile && !(await accLoadProfile())) accOnboard();
}
function accMsg(e) { // Supabase 英文报错 → 中文
  const m = (e && (e.message || e.error_description)) || String(e);
  const map = [[/invalid login credentials/i, '邮箱或密码不对'], [/email not confirmed/i, '邮箱还没确认，请先点确认邮件里的链接'], [/already registered|already been registered|user already exists/i, '这个邮箱已经注册过了，直接登录吧'],
    [/password should be at least|weak password/i, '密码太短或太简单，至少 6 位'], [/rate limit|too many/i, '操作太频繁，请稍后再试'], [/unable to validate email|invalid email/i, '邮箱格式不对'],
    [/provider is not enabled|unsupported provider/i, '这个登录方式还没在后台开启'], [/network|fetch/i, '网络有问题，请重试']];
  for (const [re, zh] of map) if (re.test(m)) return zh;
  return m;
}

// ---------- 资料编辑（首次注册时也用这个起用户名） ----------
let accDraft = null, accUnameT = null, accUnameOk = null;
function accOnboard() { accEditView(true); }
function accEditView(first) {
  const p = ACC.profile || {};
  const meta = (ACC.session && ACC.session.user.user_metadata) || {};
  accDraft = { file: null, preview: null, avatar_url: p.avatar_url || null, crest: p.crest || (p.avatar_url ? null : myAvatar), first: !!first };
  accUnameOk = p.username ? true : null;
  const suggest = p.username || accSuggestName(meta.name || meta.full_name || ''); // 不再用邮箱前缀当默认用户名
  accModal(`<div class="acc-head">${first ? '<div class="acc-seal">⚜</div><h3>起个名字吧</h3><div class="mute">用户名是唯一的，别人可以用它认出你；昵称是游戏里显示的名字，随时能改</div>' : '<h3>编辑资料</h3>'}</div>
    <div class="acc-avedit"><label class="acc-avbig" title="上传头像"><span id="acc-avprev">${avH(accDraftAvatar())}</span><span class="acc-cam">📷</span>
      <input type="file" accept="image/*" onchange="accPickFile(this.files[0])" hidden></label>
      <div class="acc-avside"><b>头像</b><span class="mute">点左边上传照片，会自动裁成方形；或者选一个纹章</span>
      <div class="acc-crests">${AVATARS.map((a) => `<span class="${!accDraft.preview && !accDraft.avatar_url && accDraft.crest === a ? 'on' : ''}" onclick="accPickCrest('${a}')">${avH(a)}</span>`).join('')}</div></div></div>
    <form onsubmit="event.preventDefault();accSave()">
      <label class="acc-f"><span>用户名 <small>3–20 位：小写字母、数字、下划线、点</small></span>
        <div class="acc-uname"><i>@</i><input id="acc-un" autocapitalize="none" autocomplete="username" spellcheck="false" maxlength="20" value="${esc(suggest)}" oninput="accUname(this)"><em id="acc-unst"></em></div></label>
      <label class="acc-f"><span>昵称 <small>游戏里显示，最多 12 个字</small></span><input id="acc-dn" maxlength="12" value="${esc(p.display_name || localStorage.name || meta.name || '')}" placeholder="比如：阿明"></label>
      <div id="acc-err" class="acc-err"></div>
      <button id="acc-go" type="submit">${first ? '完成' : '保存'}</button>
      ${first ? '<div class="acc-links"><a onclick="accCancelOnboard()">稍后再说（先退出登录）</a></div>' : '<button type="button" class="sec" onclick="closeModal()">取消</button>'}
    </form>`, { lock: first });
  accUname($('#acc-un'));
}
const accDraftAvatar = () => accDraft.preview || accDraft.avatar_url || accDraft.crest || myAvatar;
function accSuggestName(s) {
  const base = String(s).split('@')[0].toLowerCase().normalize('NFKD').replace(/[^a-z0-9_.]/g, '').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 16);
  return base.length >= 3 ? base : '';
}
function accUname(el) {
  const v = el.value.toLowerCase().replace(/\s/g, '');
  if (v !== el.value) el.value = v;
  const st = $('#acc-unst'); clearTimeout(accUnameT); accUnameOk = null;
  const set = (cls, t) => { st.className = cls; st.textContent = t; };
  if (!v) return set('', '');
  if (/[^a-z0-9_.]/.test(v)) return set('bad', '只能用小写字母、数字、_ 和 .');
  if (v.length < 3) return set('bad', '至少 3 位');
  if (/^\.|\.$|\.\./.test(v)) return set('bad', '点不能在开头、结尾或连着用');
  if (ACC.profile && v === ACC.profile.username) { accUnameOk = true; return set('ok', '✓ 当前用户名'); }
  set('wait', '检查中…');
  accUnameT = setTimeout(async () => {
    const { data, error } = await ACC.sb.from('profiles').select('id').eq('username', v).maybeSingle();
    if ($('#acc-un').value !== v) return;
    if (error) return set('bad', '检查失败，请重试');
    accUnameOk = !data; set(data ? 'bad' : 'ok', data ? '✗ 已经被别人用了' : '✓ 可以用');
  }, 350);
}
async function accPickFile(f) {
  if (!f) return;
  if (!/^image\//.test(f.type)) return toast('请选一张图片');
  if (f.size > 15 * 1024 * 1024) return toast('图片太大了（最多 15MB）');
  try {
    const blob = await accSquare(f, 320);
    if (accDraft.preview) URL.revokeObjectURL(accDraft.preview);
    accDraft.file = blob; accDraft.preview = URL.createObjectURL(blob);
    $('#acc-avprev').innerHTML = `<img class="crest" src="${accDraft.preview}" alt="">`;
    document.querySelectorAll('.acc-crests span').forEach((s) => s.classList.remove('on'));
  } catch (e) { toast('这张图片读不了，换一张试试'); }
}
function accPickCrest(a) {
  if (accDraft.preview) URL.revokeObjectURL(accDraft.preview);
  Object.assign(accDraft, { file: null, preview: null, avatar_url: null, crest: a });
  $('#acc-avprev').innerHTML = avH(a);
  document.querySelectorAll('.acc-crests span').forEach((s, i) => s.classList.toggle('on', AVATARS[i] === a));
}
// 居中裁成正方形、缩到 size×size，压成 webp（不支持的浏览器用 jpeg）
async function accSquare(file, size) {
  const bmp = await (window.createImageBitmap ? createImageBitmap(file, { imageOrientation: 'from-image' }) : new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); }));
  const w = bmp.width, h = bmp.height, s = Math.min(w, h);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
  let blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.86));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.88));
  return blob;
}
async function accSave() {
  if (ACC.busy) return;
  const username = $('#acc-un').value.trim(), display_name = $('#acc-dn').value.trim();
  if (!UNAME_RE.test(username) || /^\.|\.$|\.\./.test(username)) return accErr('用户名格式不对');
  if (accUnameOk === false) return accErr('这个用户名已经被别人用了');
  if (!display_name) return accErr('昵称不能为空');
  accErr(''); accBusy(true);
  const uid = ACC.session.user.id, old = ACC.profile;
  try {
    let avatar_url = accDraft.avatar_url, crest = accDraft.crest;
    if (accDraft.file) {
      const ext = accDraft.file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${uid}/${Date.now()}.${ext}`;
      const up = await ACC.sb.storage.from('avatars').upload(path, accDraft.file, { contentType: accDraft.file.type, cacheControl: '31536000', upsert: false });
      if (up.error) return accErr('头像上传失败：' + accMsg(up.error));
      avatar_url = ACC.sb.storage.from('avatars').getPublicUrl(path).data.publicUrl; crest = null;
    }
    const row = { id: uid, username, display_name, avatar_url, crest };
    const { data, error } = old
      ? await ACC.sb.from('profiles').update(row).eq('id', uid).select().single()
      : await ACC.sb.from('profiles').insert(row).select().single();
    if (error) {
      if (error.code === '23505') { accUnameOk = false; accUname($('#acc-un')); return accErr('这个用户名刚被别人抢了，换一个吧'); }
      if (error.code === '23514') return accErr('用户名或昵称格式不对');
      return accErr('保存失败：' + accMsg(error));
    }
    // 换了头像，把旧的那张删掉（只删自己文件夹里的）
    const prefix = ACC.sb.storage.from('avatars').getPublicUrl(uid + '/').data.publicUrl;
    if (old && old.avatar_url && old.avatar_url !== avatar_url && old.avatar_url.startsWith(prefix)) ACC.sb.storage.from('avatars').remove([old.avatar_url.slice(prefix.length - uid.length - 1)]).catch(() => {});
    ACC.profile = data; localStorage.name = data.display_name;
    if (!data.avatar_url && data.crest) { myAvatar = data.crest; localStorage.avatar = data.crest; }
    closeModal(); toast(accDraft.first ? `欢迎，@${data.username}` : '资料已保存', true);
    if (S && S.me) send({ t: 'refreshProfile', auth: authToken() });
    render();
  } finally { accBusy(false); }
}
async function accCancelOnboard() { await ACC.sb.auth.signOut(); ACC.session = null; ACC.profile = null; closeModal(); render(); }

// ---------- 我的战绩 / 排行榜 ----------
async function accStatsView(tab = 'me') {
  accModal(`<div class="acc-head"><h3>📊 战绩</h3></div><div class="acc-tabs"><span class="${tab === 'me' ? 'on' : ''}" onclick="accStatsView('me')">我的</span><span class="${tab === 'top' ? 'on' : ''}" onclick="accStatsView('top')">排行榜</span><i class="${tab === 'me' ? 'in' : 'up'}"></i></div><div id="acc-st" class="acc-st"><div class="mute center">读取中…</div></div>`);
  const box = () => $('#acc-st');
  const pct = (w, n) => (n ? Math.round((w / n) * 100) + '%' : '—');
  try {
    if (tab === 'top') {
      const { data, error } = await ACC.sb.from('player_stats').select('user_id,username,display_name,avatar_url,crest,games,wins').gte('games', 3).order('games', { ascending: false }).limit(100);
      if (error) throw error;
      const rows = data.sort((a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games).slice(0, 30);
      if (!box()) return;
      box().innerHTML = rows.length ? `<div class="mute">至少打过 3 局的玩家，按胜率排</div><div class="acc-lb">${rows.map((r, i) => `<div class="acc-lbr ${ACC.profile && r.user_id === ACC.profile.id ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="acc-av sm">${avH(accAvatar(r, '⚜'))}</span><span class="nm"><b>${esc(r.display_name)}</b><small>@${esc(r.username)}</small></span><span class="wr"><b>${pct(r.wins, r.games)}</b><small>${r.games} 局</small></span></div>`).join('')}</div>`
        : '<div class="mute center">还没有人打满 3 局</div>';
      return;
    }
    const uid = ACC.profile.id;
    const [st, rs, rec] = await Promise.all([
      ACC.sb.from('player_stats').select('*').eq('user_id', uid).maybeSingle(),
      ACC.sb.from('role_stats').select('role,games,wins').eq('user_id', uid).order('games', { ascending: false }),
      ACC.sb.from('games').select('id,ended_at,winner,player_count,game_players!inner(role,evil,won,user_id)').eq('game_players.user_id', uid).order('ended_at', { ascending: false }).limit(10),
    ]);
    for (const r of [st, rs, rec]) if (r.error) throw r.error;
    if (!box()) return;
    const s = st.data;
    if (!s) { box().innerHTML = '<div class="acc-empty">⚔<p>还没有战绩。登录状态下打完一局，战绩会自动记到这里。</p></div>'; return; }
    const rn = (k) => (window.ROLES && ROLES[k] ? `${ROLES[k].emo} ${ROLES[k].name}` : k);
    const fmt = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
    box().innerHTML = `<div class="acc-big"><div><b>${s.games}</b><span>局数</span></div><div><b>${pct(s.wins, s.games)}</b><span>总胜率</span></div><div class="g"><b>${pct(s.good_wins, s.good_games)}</b><span>好人 ${s.good_games} 局</span></div><div class="e"><b>${pct(s.evil_wins, s.evil_games)}</b><span>坏人 ${s.evil_games} 局</span></div></div>
      <h4>各角色</h4><div class="acc-roles">${rs.data.map((r) => `<div class="acc-rr ${window.ROLES && ROLES[r.role] ? ROLES[r.role].side : ''}"><span>${rn(r.role)}</span><span class="bar"><i style="width:${Math.round((r.wins / r.games) * 100)}%"></i></span><b>${pct(r.wins, r.games)}</b><small>${r.wins}/${r.games}</small></div>`).join('')}</div>
      <h4>最近对局</h4>${rec.data.map((g) => { const me = g.game_players[0]; return `<div class="hist-g" onclick="accOpenGame('${esc(g.id)}')"><b class="${me.won ? 'good' : 'evil'}">${me.won ? '胜' : '负'}</b><span>${fmt(g.ended_at)} · ${g.player_count} 人 · ${rn(me.role)}</span></div>`; }).join('')}`;
  } catch (e) { if (box()) box().innerHTML = `<div class="acc-err on">读取失败：${esc(accMsg(e))}</div>`; }
}
async function accOpenGame(id) {
  try {
    const r = await fetch('/api/games/' + encodeURIComponent(id));
    if (r.ok) return showReplay(await r.json());
    const { data, error } = await ACC.sb.from('games').select('record').eq('id', id).single(); // 服务器内存里没有就从 Supabase 读
    if (error) throw error;
    showReplay(data.record);
  } catch { toast('读取失败'); }
}
