import { RelayClient } from "./client.js";
import { Forwarder } from "./forwarder.js";

const wsUrl = process.env.ROAM_RELAY_WS;
const token = process.env.ROAM_RELAY_TOKEN;
const deviceId = process.env.ROAM_DEVICE_ID;
const mainPort = Number(process.env.ROAM_MAIN_PORT || 9507);
const localHost = process.env.ROAM_MAIN_HOST || "127.0.0.1";

if (!wsUrl || !token || !deviceId) {
  console.error("[relay] required env missing: ROAM_RELAY_WS / ROAM_RELAY_TOKEN / ROAM_DEVICE_ID");
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
