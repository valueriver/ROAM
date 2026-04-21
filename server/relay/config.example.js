// Copy this file to `config.js` (which is gitignored) and fill in.
// If `config.js` is absent, the relay falls back to ROAM_RELAY_WS /
// ROAM_RELAY_TOKEN / ROAM_DEVICE_ID env vars.

export default {
  // Worker 的 device 握手 URL
  wsUrl: "wss://relay.example.com/ws/device",

  // 明文 token, Worker 后端用 SHA-256 比对 D1 里的 token_hash
  token: "your-secret-token",

  // 你在 D1 devices 表里注册的 device_id
  deviceId: "dev-1",

  // (可选) 转发目标 main 端口, 默认 9507
  // mainPort: 9507,

  // (可选) 转发目标 main 主机, 默认 127.0.0.1
  // mainHost: "127.0.0.1",
};
