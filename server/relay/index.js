import { RelayClient } from "./client.js";
import { Forwarder } from "./forwarder.js";

let fileConfig = {};
try {
  const mod = await import("./config.js");
  fileConfig = mod.default || mod.config || {};
} catch {
  // 没有 config.js 就只看环境变量
}

const wsUrl    = fileConfig.wsUrl    || process.env.ROAM_RELAY_WS    || "";
const token    = fileConfig.token    || process.env.ROAM_RELAY_TOKEN || "";
const deviceId = fileConfig.deviceId || process.env.ROAM_DEVICE_ID   || "";
const mainPort = Number(fileConfig.mainPort || process.env.ROAM_MAIN_PORT || 9507);
const localHost = fileConfig.mainHost || process.env.ROAM_MAIN_HOST || "127.0.0.1";

if (!wsUrl || !token || !deviceId) {
  console.error("[relay] config incomplete.");
  console.error("  Fill in server/relay/config.js (wsUrl / token / deviceId)");
  console.error("  or set ROAM_RELAY_WS / ROAM_RELAY_TOKEN / ROAM_DEVICE_ID env vars.");
  process.exit(1);
}

let forwarder;
const client = new RelayClient({
  wsUrl,
  token,
  deviceId,
  onStateChange: (state, meta) => {
    const detail = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`[relay] ${state}${detail}`);
  },
  onFrame: (frame) => forwarder?.handle(frame)
});

forwarder = new Forwarder({
  localHost,
  mainPort,
  send: (frame) => client.send(frame)
});

const shutdown = () => {
  client.close();
  forwarder.shutdown();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`[relay] dialing ${wsUrl} as device=${deviceId}, forwarding to ${localHost}:${mainPort}`);
client.connect();
