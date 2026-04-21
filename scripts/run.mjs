#!/usr/bin/env node
// 一条命令同时起 main + apps 两个进程。Ctrl+C 全部关掉。

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);

const procs = [];

const start = (name, args, env = {}) => {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["inherit", "pipe", "pipe"]
  });
  const prefix = `[${name}] `;
  const forward = (stream, target) => {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) target.write(prefix + line + "\n");
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  child.on("exit", (code, signal) => {
    process.stderr.write(`${prefix}exited (code=${code}, signal=${signal})\n`);
    shutdown(1);
  });
  procs.push(child);
  return child;
};

let shuttingDown = false;
const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) {
    try { p.kill("SIGINT"); } catch {}
  }
  setTimeout(() => process.exit(code), 200);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("main", [join(ROOT, "server/main/index.js"), "--port=9507"], {
  ROAM_APPS_PORT: "9508"
});
start("apps", [join(ROOT, "server/apps/index.js"), "--port=9508"], {
  ROAM_MAIN_PORT: "9507"
});

if (process.env.ROAM_RELAY_WS && process.env.ROAM_RELAY_TOKEN && process.env.ROAM_DEVICE_ID) {
  start("relay", [join(ROOT, "server/relay/index.js")], {
    ROAM_MAIN_PORT: "9507"
  });
}
