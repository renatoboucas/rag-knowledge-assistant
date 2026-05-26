import { createServer } from "node:http";
import { parse } from "node:url";

import next from "next";

import { attachRealtimeServer } from "@/lib/realtime/socket-server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url ?? "/", true);
  void handle(req, res, parsedUrl);
});

await attachRealtimeServer(server);

server.listen(port, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
  console.log("> Realtime socket mounted at /api/realtime/socket.io");
});
