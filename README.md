# 阿瓦隆在线助手

线下面对面玩，手机负责：发身份（按住查看）、选队长、组队投票、秘密出任务牌、刺杀梅林、身份揭晓。
身份由服务端判定，只发给本人，抓包也看不到别人的。

## 功能
头像、断线自动重连（换设备用昵称+重连码找回）、按住看身份+角色攻略、轮流发言计时、发车投票弹窗+票型表、匿名任务出牌、刺杀环节（坏人互相亮明身份、标记怀疑对象）、上帝模式（看全部身份/实时投票，改身份/队长/否决数/任务结果、补票、判胜负）。

## 上帝模式
在 Render 的 Environment 里加环境变量 `GOD_PASSWORD=你的密码`，没设置就是关闭状态。

## 账号系统（可选，Supabase）
不配置也能玩（游客模式）。配置后玩家可以注册/登录，有**唯一用户名**（像 Instagram / Discord，3–20 位小写字母、数字、`_`、`.`）、可随时修改的**昵称**、**上传头像**，战绩跟着账号走（总胜率、好人/坏人胜率、每个角色胜率、排行榜）。换手机登录同一个账号能直接回到原座位。

1. 在 [supabase.com](https://supabase.com) 新建一个项目（免费版即可）
2. 后台 **SQL Editor** → 把 `supabase/schema.sql` 整段粘进去运行（建表、权限、头像存储桶都在里面，重复运行也没事）
3. **Authentication → URL Configuration**：Site URL 填你的 Render 地址（例如 `https://xxx.onrender.com`），Redirect URLs 也加上它（本地测试再加 `http://localhost:3000`）。确认邮件、找回密码邮件里的链接会跳回这里
4. **Project Settings → API Keys** 里拿到项目 URL、公开 key（publishable / anon）和服务端 key（secret / service_role），填到 Render 的 Environment：
   - `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`（服务端 key 只放在 Render，**绝不能**写进代码或发给别人）
5. 可选：想要「用 Google / Discord 登录」，先在 **Authentication → Sign In / Providers** 开启对应方式，再在 Render 加 `AUTH_PROVIDERS=google,discord`
6. 防止免费项目一周没人用被暂停：GitHub 仓库 **Settings → Secrets and variables → Actions** 加 `SUPABASE_URL`、`SUPABASE_ANON_KEY` 两个 secret，`.github/workflows/supabase-keepalive.yml` 会每 3 天查一次数据库。可以在 Actions 页面点 **Run workflow** 先手动跑一次确认是绿的

说明：游客和登录玩家可以在同一个房间里玩；只有登录玩家的战绩会记到账号里（原来的 GitHub 战绩存档照常工作）。默认开启邮件确认，免费版的内置邮件服务每小时只能发很少几封，人多的话可以在 Supabase 里配自己的 SMTP，或者关掉 Confirm email。

## 本地运行
    npm install && npm start   # http://localhost:3000

## 免费部署（Render）
1. 推到 GitHub
2. render.com → New → Blueprint → 选这个仓库（会读 render.yaml）
3. 拿到 https://xxx.onrender.com 发给大家

免费实例 15 分钟没人访问会休眠，第一次打开要等约 30 秒；房间存在内存里，重启后就没了（一局游戏不受影响）。

## 测试
    GOD_PASSWORD=test PORT=3123 npm start  # 另开终端
    node test/sim.js     # 7 个机器人跑完一整局
    node test/roles.js   # 扩展角色/道具规则测试
    node test/accounts.js  # 账号系统测试（自带一个假的 Supabase，不需要真项目）
