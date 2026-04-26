<div align="center">

```
      .                ·               .
                          _
                        _/ \_
              _       _/     \_
            _/ \_    /         \_
          _/     \__/             \___
        _/                             \__
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

# Roam · 漫游 🛰️

**忘掉 SSH。忘掉 VPN。忘掉端口转发。**

🖥️ 终端 · 📂 文件 · 🤖 Agent · 🌐 浏览器 —— 在任何设备的浏览器里直接用回你自己电脑

</div>

---

## 📸 长什么样

> 想象一下:在公司、咖啡馆、iPad 上点开一条链接,登进去就是你家那台电脑。
> 多标签终端、文件管理、AI agent、Playwright 浏览器,**就像没出过门**。

---

## ✨ 特性

- 🖥️ **完整终端** —— 多标签、xterm 全功能、触屏友好,远程连上像坐在电脑前
- 📂 **文件管理** —— 列表、预览(文本+图片)、上传/下载、重命名、搜索、排序
- 🤖 **AI Agent** —— OpenAI 兼容接口即用,内置 `terminal_exec` / `fs_*` / `browser_run_code` 工具
- 🌐 **浏览器操控** —— Agent 可开本机 Chrome 跑 Playwright 代码
- 🔐 **认证硬核** —— HMAC-SHA256 challenge/response(密码不出浏览器)+ 30 天 token + 暴力锁定 + 单设备独占
- 💾 **全量持久化** —— SQLite 落盘 `~/.roam/roam.db`,模型/会话/消息重启不丢
- 🚀 **链接即会话** —— 桌面端打印一条 URL,任何浏览器打开就是你本机
- 🍃 **几乎免费** —— Cloudflare Worker 用 Hibernation API,DO 挂着 WebSocket 不计 duration 费

## 🛠 技术栈

Cloudflare Workers · Durable Objects · WebSocket Hibernation · Vue 3 · Vite · Tailwind 4 · xterm · Pinia · Node.js · better-sqlite3 · node-pty · Playwright

中继架构:浏览器和桌面端**都主动拨**到 Worker,Worker 按 `sessionId` 配对转发。Worker 几乎无状态,真实数据全在你桌面端 SQLite 里。

```
 ┌──────────┐   WSS    ┌───────────────────────┐   WSS   ┌──────────┐
 │ 浏览器    │────────▶│ Cloudflare Worker      │◀────────│ 桌面端    │
 │  Vue 3   │          │  · DO + Hibernation    │         │  Node   │
 │  xterm   │◀────────│  · 单设备独占 / 锁定     │────────▶│ node-pty │
 └──────────┘          └───────────────────────┘          │Playwright│
                                                         └──────────┘
```

## 🚀 自己部署一份

需要:**Cloudflare 账号**、**Node 20+**、**家里一台开机的电脑**(macOS / Linux / WSL)

### 1️⃣ 部署 Worker(中继层)

```bash
git clone https://github.com/valueriver/roam
cd roam/worker && npm install

# 复制配置模板,填 account_id(routes 可选,不绑域名就删掉)
cp wrangler.example.jsonc wrangler.jsonc
# 改 account_id;要绑域名的话先把域名托管进 Cloudflare 再填 routes

npm run deploy
```

输出里会给你 `https://roam.<你的子域>.workers.dev` 或自定义域名。

### 2️⃣ 桌面端(你家那台机器)

```bash
cd ../desktop && npm install

# 设环境变量(也可写到 .env,desktop 自动读)
export ROAM_URL=https://roam.<你的子域>.workers.dev
export SESSION_PASSWORD=自己定一个        # 留空就是免密

npm start
```

控制台会打印一条访问链接 + 密码:

```
🔗 访问链接:
   https://roam.<你的子域>.workers.dev/guard?session=<uuid>
🔐 访问密码: <你设的>
```

任何浏览器打开,输密码进去就是你本机。

### 3️⃣ 配 Agent 模型(首次进入 `/agent` 标签)

空态会有表单,填 OpenAI 兼容接口的 `API URL` / `API Key` / `Model`,保存即可。配置写到 `~/.roam/roam.db`,下次启动还在。

## 🔐 安全模型

- **密码** HMAC-SHA256 challenge/response —— 原文**不出浏览器**,后端 `timingSafeEqual` 比对
- **token** 成功后颁发 30 天免登录 token,存 localStorage,下次 WS 自动放行
- **暴力防护** 累计 10 次失败 → 全局锁 30 分钟 + 清空所有 token
- **独占** 新设备认证通过 → Worker 主动 `ws.close(4001)` 顶替旧会话

进门后所有消息明文 over WSS —— TLS 到 CF 边缘,再 TLS 到你桌面端。CF 内部理论可见,信不信看你对 Cloudflare 的信任度。

## 📁 项目结构

```
roam/
├── worker/         # Cloudflare Worker:中继 + SPA 静态服务
│   ├── server/     #   DO 实现(WebSocket Hibernation)
│   └── src/        #   前端(Vue 3 + Pinia + xterm)
└── desktop/        # 桌面端 Node.js 服务:认证 / pty / fs / agent
    ├── guard/      #   认证(challenge/submit/lockout)
    ├── terminal/   #   pty 终端
    ├── files/      #   文件管理
    └── agent/      #   AI agent + 工具(shell / browser)
```

按 feature 划分,每个目录自闭合:`index.js` 出 `handle(msg)`、`core/` 存模块状态、`commands/` 存动作。

## 💰 成本

Cloudflare Workers 付费计划 **$5 / 月**。用了 Hibernation API,DO 挂 WebSocket 时不计 duration —— 日常几乎全在免费额度内。

## 📜 License

[MIT](./LICENSE) —— 拿去改、拿去用,觉得有用记得给个 ⭐
