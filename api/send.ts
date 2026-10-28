import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handle } from "../lib/relay.js";

// POST /api/send  (Authorization: Bearer <MAIL_RELAY_SECRET>)
// { "to": "...", "subject": "...", "text": "...", "html": "..." }
export default async function send(req: VercelRequest, res: VercelResponse) {
  const r = await handle(req.method, req.headers.authorization, req.body);
  res.setHeader("Cache-Control", "no-store");
  res.status(r.status).json(r.body);
}
