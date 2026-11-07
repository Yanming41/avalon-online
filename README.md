# 阿瓦隆在线助手

线下面对面玩，手机负责：发身份（按住查看）、选队长、组队投票、秘密出任务牌、刺杀梅林、身份揭晓。
身份由服务端判定，只发给本人，抓包也看不到别人的。

## 功能
头像、断线自动重连（换设备用昵称+重连码找回）、按住看身份+角色攻略、轮流发言计时、发车投票弹窗+票型表、匿名任务出牌、刺杀环节（坏人互相亮明身份、标记怀疑对象）、上帝模式（看全部身份/实时投票，改身份/队长/否决数/任务结果、补票、判胜负）。

## 上帝模式
在 Render 的 Environment 里加环境变量 `GOD_PASSWORD=你的密码`，没设置就是关闭状态。

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
