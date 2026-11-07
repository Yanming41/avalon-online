# 阿瓦隆在线助手

线下面对面玩，手机负责：发身份（按住查看）、选队长、组队投票、秘密出任务牌、刺杀梅林、身份揭晓。
身份由服务端判定，只发给本人，抓包也看不到别人的。

## 本地运行
    npm install && npm start   # http://localhost:3000

## 免费部署（Render）
1. 推到 GitHub
2. render.com → New → Blueprint → 选这个仓库（会读 render.yaml）
3. 拿到 https://xxx.onrender.com 发给大家

免费实例 15 分钟没人访问会休眠，第一次打开要等约 30 秒；房间存在内存里，重启后就没了（一局游戏不受影响）。

## 测试
    PORT=3123 npm start  # 另开终端
    node test/sim.js     # 7 个机器人跑完一整局
