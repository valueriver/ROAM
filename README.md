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

# Roam · 漫游

**把 [AIOS](https://github.com/valueriver/AIOS) 装到家里电脑,浏览器即入口。**

AI 时代的远程桌面 —— 不是 SSH + 聊天框,是一整套 AI 原生操作系统。

</div>

---

## 🚨 老版本用户请看

> **Roam v2 (Cloudflare Worker 版) 已归档为 [`ROAM-v2.zip`](./ROAM-v2.zip)**
>
> 这个仓库的 `main` 分支现在是全新的 v4 架构。如果你之前在用 v2 —— 桌面端和浏览器都通过 Cloudflare Worker + Durable Object 做中继的版本,
> **继续使用 v2 的方法**:
>
> 1. 从本仓库根目录下载 [`ROAM-v2.zip`](./ROAM-v2.zip)
> 2. 解压,按包内 README 配置 Cloudflare Worker
>
> v4 不再依赖 Cloudflare。公网穿透自己挑工具 (ngrok / Cloudflare Tunnel / Tailscale / 局域网裸跑),Roam 只负责家里电脑这一头。

---

## v4 最大的变化: **Roam 跑在 AIOS 之上**

v2/v3 是一个"把三件死功能(Agent / Shell / Files)通过 Cloudflare 暴露到浏览器"的工具。
v4 把整个东西重写到 [**AIOS**](https://github.com/valueriver/AIOS) —— AI 时代的操作系统 —— 之上。
**这不是功能迭代,是范式切换**。

### AIOS 的四个核心论点

> (摘自 AIOS README, 详见 [原文](https://github.com/valueriver/AIOS))

**1. 对话,新的人机交互范式**

自然语言是最简单、高效、个性化的表达方式。AIOS 里你直接告诉计算机要干什么,不再翻菜单、点按钮、写命令。

**2. 界面,依然不可或缺**

对话擅长表达意图,不擅长承载结果。日历、账本、笔记、画板 —— 每个确定的需求都需要一个形态。**形态即是功能,形态即是价值**。AIOS 不是只有聊天框,是对话与 GUI 应用并存。

**3. 每个人都可以拥有专属的软件**

几乎所有代码即将由 AI 完成。你不用学编程、不用雇开发者、不用等产品路线图 —— 只需要向 AI 描述你的需要。软件将真正属于使用它的人,没有广告、没有订阅、数据归你所有。

**4. AI 与应用的双向调用**

AI 可以理解并操作应用(因为应用本身由 AI 生成,结构透明);应用也可以反向把任务交给 AI(比如"互动小说"应用直接派发"生成下一章"的 task,AI 引擎自主接管上下文整合)。
这种双向关系,是传统应用永远做不到的。

---

### Roam 是什么角色

**Roam = AIOS 的远程形态**。

家里的 Mac / Linux 跑一份 AIOS,浏览器就是入口。你在咖啡馆、飞机上、手机上打开,操作的是家里那台机器的 AIOS —— 它的 agent、它的应用、它的文件系统、它的终端。

AIOS 本体是通用的,不关心 shell 和文件。Roam 只是把它的能力通过本地 HTTP/WS 暴露出来,配合你自带的隧道工具(ngrok / Cloudflare Tunnel / Tailscale)远程可达。

---

## 预装应用

v4 开箱带三个基本应用。将来你可以让 agent 自己生成新的应用 —— AIOS 的核心能力之一就是"让每个人拥有专属软件"。

| | |
|--|--|
| 💬 **Agent** | AIOS 的对话入口。天然的 OS 控制器 —— 说"把 ~/Downloads 里本周的 dmg 全删了",它真的去执行 |
| 🖥 **Shell**  | xterm 多标签终端。你用的和 agent 用的是同一个 pty,协作无缝 |
| 📂 **Files** | 浏览、预览、上传、下载、重命名、搜索。文件系统对你和 agent 同样开放 |

界面风格 Linear 冷中性色,支持明暗双主题。

---

## 启动

要求:Node.js 20+,macOS / Linux (Windows 理论可但未测)。

```bash
git clone https://github.com/valueriver/ROAM.git roam
cd roam
npm install          # 会自动 chmod node-pty 的 spawn-helper
npm run build        # 构建前端到 gui/dist
npm start            # 起 main + apps 两个进程
```

打开 <http://localhost:9507>,右上角齿轮配模型,开始用。

- `npm run start:main` — 只起内核进程
- `npm run start:apps` — 只起应用进程
- `npm run dev` — main + apps + vite dev server

---

## 暴露到公网(可选)

v4 默认只绑 `127.0.0.1`。想远程用,挑一个隧道:

### ngrok(最省事)
```bash
ngrok http 9507
```

### Cloudflare Tunnel(长期域名)
```bash
brew install cloudflared
cloudflared tunnel create roam
cloudflared tunnel route dns roam roam.你的域.com
cloudflared tunnel --url http://localhost:9507 run roam
```
配合 Cloudflare Zero Trust Access 锁定访问。

### Tailscale Serve
```bash
tailscale serve --bg 9507
```
只有 tailnet 成员可访问。

### 自建 Cloudflare Worker 中继 (进阶)

如果你有自己的域名 + Cloudflare 账号,仓库里 [`roam-relay-worker/`](./roam-relay-worker) 提供了一个可部署的 Worker,给每台设备一个固定的 `https://<slug>.roam.<your-domain>/`,家里电脑只需要 *outbound* WebSocket,不用对外开端口。

两端都在本仓库里:
- **Worker 端** (公网): [`roam-relay-worker/`](./roam-relay-worker) — `wrangler deploy` 自己的 CF 账号
- **本地端** (家里机器): [`server/relay/`](./server/relay) — 第三个进程, 拨 Worker 挂住, 把请求转发回 localhost:9507

编辑 [`server/relay/config.js`](./server/relay/config.js) 填三项即可(此文件已 gitignore,本地独占):

```js
export default {
  wsUrl: "wss://relay.你的域名/ws/device",
  token: "你的设备 token",
  deviceId: "你在 D1 里注册的 device_id",
};
```

保存后 `npm start` 自动多起一个 `relay` 子进程 (main + apps + relay 三进程)。
字段留空就不启动 relay,和直接 ngrok / Tunnel 用法一致。

(也支持 `ROAM_RELAY_WS` / `ROAM_RELAY_TOKEN` / `ROAM_DEVICE_ID` 环境变量,方便 CI / 容器部署。)

(这是 v2 架构的简化重生版 —— 只是它不再是默认,也不强制。想要就装。)

---

## 架构

AIOS 是双进程内核,Roam 继承了这套:

```
┌─────────────────────────────────────┐
│ main 进程 (9507) — 稳定内核         │
│ · HTTP + WebSocket                  │
│ · Agent + LLM 流式                  │
│ · 系统服务: pty / 文件 / 任务管理    │
│ · 对话连接不中断                    │
├─────────────────────────────────────┤
│ apps 进程 (9508) — 应用运行时       │
│ · 每个应用独立模块 + 独立 DB        │
│ · 可独立热重启,不影响 main          │
│ · 为"agent 现场生成新应用"预留      │
├─────────────────────────────────────┤
│ relay 进程 (可选) — 对外长连接      │
│ · 仅 outbound, 无监听端口           │
│ · 拨 Worker 挂住, 转发请求到 main   │
│ · 不设 ROAM_RELAY_* 则不启动        │
└─────────────────────────────────────┘
```

apps 可以被热重启是故意的:将来 agent 生成一个新应用时,重启 apps 进程就能加载,你正在对话的 agent / 终端 / 任务都不会断。

目录结构大体:

```
roam-v4/
├── server/
│   ├── main/                 # 稳定内核
│   │   ├── agent/            # 对话循环 + 工具编排
│   │   ├── llm/              # OpenAI 兼容流式
│   │   ├── prompt/           # 系统提示词组装
│   │   ├── chat/             # 会话持久化
│   │   ├── terminal/         # pty + WS
│   │   ├── api/              # REST 分发
│   │   ├── service/          # auth / settings / files / system
│   │   ├── task/             # AI 任务队列
│   │   ├── repository/       # SQLite 读写
│   │   └── system/           # http / ws / 目录初始化
│   ├── apps/                 # 应用进程(空 registry 预留)
│   │   ├── index.js
│   │   ├── registry.js
│   │   └── app_shared/       # 给应用派发 AI 任务的工具
│   ├── relay/                # 可选 relay 拨号进程
│   │   ├── index.js          # 入口: 读 env, 启动
│   │   ├── client.js         # 拨 Worker + 认证 + 断线重连
│   │   └── forwarder.js      # proxy_request / ws_* 帧处理
│   └── shared/               # main + apps 共用
├── gui/
│   └── src/
│       ├── apps/
│       │   ├── chat/         # Agent UI
│       │   ├── shell/        # 终端 UI
│       │   ├── files/        # 文件 UI
│       │   └── settings/     # 模型配置
│       └── components/       # 全局壳(Header / Drawer / Task 等)
```

---

## 和 v2 的差异

| | v2 | v4 |
|--|--|--|
| 定位 | 远程工具,三个死功能 | **AIOS 的远程形态**,预装三个应用,可扩展 |
| 部署 | 桌面和浏览器都拨 Cloudflare Worker + DO 中继 | 桌面端本地 HTTP/WS,公网穿透自带工具 |
| 依赖 | CF 账号 / wrangler / Workers 付费计划 | 零外部依赖,全本地 |
| 后端进程 | 单进程 | 双进程(main 稳定 + apps 可热重启) |
| 应用模型 | 三个功能写死在代码里 | 插件式注册表,为 AI 生成应用预留接口 |
| Agent 角色 | 调几个工具的聊天框 | AIOS 内核的对话入口,系统服务对它开放 |
| 前端 | Vue 3 + Pinia | 同上,换 Linear 风格设计系统,明暗双主题 |
| 认证 | Cloudflare Access / 密码门 | 本地默认无认证,公网穿透时建议套 CF Access / Tailscale |

---

## 致谢

- **[AIOS](https://github.com/valueriver/AIOS)** —— 提供内核、agent/llm/prompt/task 子系统、以及"AI 原生操作系统"的全部设计思路。Roam 站在它肩膀上。
- [xterm.js](https://xtermjs.org/) · [node-pty](https://github.com/microsoft/node-pty) · [Vue](https://vuejs.org/) · [Tailwind](https://tailwindcss.com/)

## License

MIT
