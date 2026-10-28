# Wymlink Mail

Sends Wymlink's emails (sign-in and reset codes, PIN resets, staff security alerts) for the
backend. The backend runs on Render, which blocks outgoing email ports, so it hands each
email to this service over HTTPS and this service sends it through the Wymlink mailbox.

- `POST /api/send` with `Authorization: Bearer <MAIL_RELAY_SECRET>` and a JSON body
  `{ "to", "subject", "text", "html" }` (one recipient; `text` and/or `html`).
- `GET /api/health`: `{ ok, configured }`.

Only callers holding the secret can send, every email goes out from `SMTP_FROM`, and each
request is checked (one recipient, one-line subject, size limits).

## Deploy (Vercel)

1. Import this repository (no build settings needed).
2. Add the environment variables from `.env.example`:
   - `MAIL_RELAY_SECRET`: a long random value (`openssl rand -hex 32`), the same one set on the backend
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: the mailbox
3. Deploy, then open `https://<your-project>.vercel.app/api/health`. It should say `"configured": true`.
4. On the backend (Render), set:
   - `MAIL_RELAY_URL` = `https://<your-project>.vercel.app/api/send`
   - `MAIL_RELAY_SECRET` = the same secret

## Run locally

```bash
npm install
cp .env.example .env   # fill in
node --env-file=.env scripts/dev-server.mjs   # http://localhost:4600
```
