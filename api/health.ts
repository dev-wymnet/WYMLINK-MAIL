import type { VercelRequest, VercelResponse } from "@vercel/node";
import { configured } from "../lib/relay.js";

// GET /api/health: is the service up, and are its settings in place? (No values shown.)
export default function health(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, configured: configured() });
}
