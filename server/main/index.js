import { httpServer } from "./system/http.js";
import { setupWebSocket } from "./system/ws.js";
import { initSystemDirs } from "./system/dir.js";
import { initDatabase } from "./repository/init.js";

const portArg = process.argv.find((arg) => arg.startsWith("--port="));
if (portArg && !/^\-\-port=\d+$/.test(portArg)) {
  throw new Error("Invalid port argument");
}
const PORT = portArg ? Number(portArg.slice("--port=".length)) : 9507;

initSystemDirs();
initDatabase();
setupWebSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log("");
  console.log("  Roam v4 is running");
  console.log("");
  console.log(`  > local: http://localhost:${PORT}`);
  console.log("");
});
