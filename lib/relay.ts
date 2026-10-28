import { timingSafeEqual } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";

// The whole service: check the caller, check the message, send it through the Wymlink
// mailbox. Only the backend holds MAIL_RELAY_SECRET; every email goes out from SMTP_FROM,
// so a leaked secret could not send mail as anyone else.

export type Message = { to: string; subject: string; text?: string; html?: string };
export type Result = { status: number; body: Record<string, unknown> };

const env = (k: string) => process.env[k] ?? "";
const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
const MAX_BODY = 100_000;

let transporter: Transporter | null = null;
const transport = () =>
  (transporter ??= nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT") || 465),
    // TLS-on-connect follows SMTP_SECURE when set, otherwise the port (465 = TLS, 587 = STARTTLS).
    secure: env("SMTP_SECURE") ? env("SMTP_SECURE") === "true" : Number(env("SMTP_PORT") || 465) === 465,
    auth: env("SMTP_USER") ? { user: env("SMTP_USER"), pass: env("SMTP_PASS") } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
  }));

export const configured = () => Boolean(env("MAIL_RELAY_SECRET").length >= 32 && env("SMTP_HOST") && env("SMTP_FROM"));

export function authorised(header: string | undefined) {
  const secret = env("MAIL_RELAY_SECRET");
  const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (secret.length < 32 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Exactly one plain recipient, a subject without line breaks, and a body of reasonable size.
export function validate(input: unknown): Message | string {
  if (!input || typeof input !== "object") return "Send a JSON body";
  const m = input as Record<string, unknown>;
  if (typeof m.to !== "string" || m.to.length > 254 || !EMAIL.test(m.to.trim())) return "`to` must be one email address";
  if (typeof m.subject !== "string" || !m.subject.trim() || m.subject.length > 200 || /[\r\n]/.test(m.subject)) return "`subject` must be one line, up to 200 characters";
  if (m.text !== undefined && (typeof m.text !== "string" || m.text.length > MAX_BODY)) return "`text` is too long";
  if (m.html !== undefined && (typeof m.html !== "string" || m.html.length > MAX_BODY)) return "`html` is too long";
  if (!m.text && !m.html) return "Send `text` or `html`";
  return { to: m.to.trim(), subject: m.subject.trim(), text: m.text as string | undefined, html: m.html as string | undefined };
}

export async function handle(method: string | undefined, authHeader: string | undefined, body: unknown): Promise<Result> {
  if (method !== "POST") return { status: 405, body: { error: "Use POST" } };
  if (!configured()) return { status: 503, body: { error: "Mail relay is not configured" } };
  if (!authorised(authHeader)) return { status: 401, body: { error: "Unauthorized" } };
  const msg = validate(body);
  if (typeof msg === "string") return { status: 400, body: { error: msg } };
  try {
    const info = await transport().sendMail({ from: env("SMTP_FROM"), to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
    return { status: 200, body: { sent: true, id: info.messageId } };
  } catch (err) {
    // The SMTP error code only: never the message (it can echo addresses or credentials).
    console.error("send_failed", (err as { code?: string }).code ?? "unknown");
    return { status: 502, body: { error: "The mail server refused or didn't answer", code: (err as { code?: string }).code ?? null } };
  }
}
