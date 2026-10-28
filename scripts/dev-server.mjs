// Local stand-in for Vercel: serves /api/send and /api/health on PORT (default 4600).
// Node 22.18+ runs the TypeScript directly. With the settings in a .env file:
//   node --env-file=.env scripts/dev-server.mjs
import http from "node:http";
import { configured, handle } from "../lib/relay.ts";

http
  .createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.url === "/api/health") return reply(200, { ok: true, configured: configured() });
    if (req.url !== "/api/send") return reply(404, { error: "Not found" });
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      return reply(400, { error: "Send a JSON body" });
    }
    const r = await handle(req.method, req.headers.authorization, body);
    reply(r.status, r.body);
  })
  .listen(Number(process.env.PORT || 4600), () => console.log(`mail relay on ${process.env.PORT || 4600}`));
