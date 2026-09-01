# Email and WhatsApp

This replaces `PROFESSIONAL_EMAIL_SETUP.md`, `NORTHWEST_DOMAIN_EMAIL_GUIDE.md`
and `EMAIL_DELIVERABILITY_DMARC_GUIDE.md`. Those three described options that
were never taken — Google Workspace, Zoho — and documented a Gmail app-password
path that has since been removed for the reason given under *Sending* below.
One of them is also where `inbound.resend.com` came from; no such host exists,
and following that instruction is why mail never arrived.

This document describes what the site actually runs.

---

## Sending

**Resend**, and only Resend. The domain `yorkieadoptionhome.com` is verified
for sending: DKIM at `resend._domainkey`, with `send` and `rsend` CNAMEs giving
Resend a Return-Path under a subdomain it controls.

There used to be a Gmail SMTP fallback. It is gone, and should not come back.
It sent with `From: support@yorkieadoptionhome.com` through Gmail's servers,
which neither Gmail's SPF record nor this domain's DKIM key authorises — so
every message it sent failed DMARC alignment and was a spam-folder candidate.
The fallback also carried a hard-coded app password, which is now in this
repository's history and should be revoked at Google if it has not been.

All outbound mail goes through `api/send-email.ts`. Message bodies are never
written as inline HTML at the call site: each one is an `EmailDocument`
rendered by `server/branding.ts`, which produces the HTML *and* the plain-text
alternative from the same object so the two cannot drift.

| Type                   | To        | Archived in `emails` |
| ---------------------- | --------- | -------------------- |
| `new_message`          | staff     | no                   |
| `new_application`      | staff     | no                   |
| `application_approved` | applicant | yes                  |
| `admin_reply`          | client    | yes                  |
| `direct_email`         | client    | yes                  |

### Why the templates look the way they do

Email clients are not browsers. Outlook still renders with Word's engine: no
flexbox, no grid, no `border-radius` on a `div`. Everything is tables and
inline styles, the display face is a serif *stack* that degrades to Georgia,
and every document carries a preheader — without one, clients scrape the first
body text into the inbox preview.

---

## Receiving

This was broken for a structural reason before it was ever a code one: the
Resend domain had `receiving: disabled`, so mail was refused whatever the DNS
said. Enabling it makes Resend issue a regional inbound MX host. It is enabled
now, and the domain reports `sending: enabled, receiving: enabled` with all
four records verified.

Three things must all be true.

### 1. One MX record, and only one

The zone used to carry two at the same priority:

```
10  inbound.resend.com                  <- does not exist
10  mailserver.businessidentity.llc     <- Northwest's mail server
```

Equal priority means a sender picks at random, so roughly half of all mail went
to Northwest — where nothing in this app can see it — and the other half to a
hostname that does not resolve. That is the whole reason replies vanished
rather than merely arriving late. Both are gone. What is there now, and the
only MX record that may be on the apex:

| Type | Host | Value                                  | Priority |
| ---- | ---- | -------------------------------------- | -------- |
| MX   | `@`  | `inbound-smtp.eu-west-1.amazonaws.com` | 10       |

The host is region-specific. If the Resend domain is ever recreated in another
region, read the new value from Resend rather than copying this one.

### 2. A webhook on `email.received`

```
https://www.yorkieadoptionhome.com/api/inbound-email
```

`api/inbound-email.ts` files the message into `public.emails` and alerts staff.

It runs on the **edge runtime**. That is deliberate: Svix signs the exact
request bytes, and only the edge runtime hands the handler a `Request` whose
`text()` is those bytes. Vercel's Node runtime parses the body before the
handler is called, and a re-serialised `req.body` will not verify.

The endpoint is subscribed to every Resend event, which is useful — delivery,
bounce and complaint events move the *outgoing* row's status along, which is
what the reader pane shows next to a sent message. Only `email.received`
creates an inbound row.

> The earlier version acted on all of them. Its guard was
> `type === "email.received" || payload.data`, and `data` is present on every
> event, so each outgoing email came straight back as a fake *incoming* row and
> alerted both staff inboxes. If the Email Center is full of copies of its own
> sent mail, that is where they came from.

### 3. `RESEND_WEBHOOK_SECRET`

From Resend → Webhooks → the endpoint → signing secret. Until it is set the
handler logs a warning and accepts unsigned requests, so anyone who knows the
URL can file mail into the dashboard and make the site send email. Set it.

### DMARC

The zone used to carry **two** DMARC records:

```
v=DMARC1; p=none;                                    <- removed
v=DMARC1; p=quarantine; rua=mailto:bounce@dmarc...   <- kept
```

RFC 7489 says a domain publishing more than one DMARC record has no valid
policy at all, so neither was being applied. The surviving record is the
`p=quarantine` one, which also carries reporting. Never add a second.

Alignment passes because Resend signs with `d=yorkieadoptionhome.com`, which
matches the From: domain exactly — the apex SPF record does not need to list
Resend, since the Return-Path sits under the `send.` subdomain.

---

## How receiving actually works

### The webhook does not contain the body

This is the single most confusing thing about Resend inbound, and it cost a
round of debugging. The `email.received` event carries **metadata only**:

```
id  from  to  cc  bcc  reply_to  subject  message_id  attachments  created_at
```

No `text`, no `html`. The body must be fetched separately:

```
GET https://api.resend.com/emails/receiving/{id}     -> text, html, raw, headers
GET https://api.resend.com/emails/receiving          -> list of received messages
```

Neither endpoint appears under `/emails/{id}`, which is for *sent* mail and
answers `404 Email not found` for a received id. `api/inbound-email.ts` fetches
the body whenever the event arrives without one.

The symptom, if this ever regresses, is exact: mail appears in the Email Center
with the correct sender and subject and nothing to read.

### Archiving needs no read privilege

`archive()` inserts without `.select()`. Migration 0011 leaves the publishable
key INSERT-only, and asking for the inserted row back needs SELECT as well, so
`.insert().select()` is refused with `42501` — and because archiving swallows
its own errors to avoid failing a delivered email, that refusal was silent and
every received message was dropped. Deduplication therefore rides on the unique
index over `provider_id`, catching `23505`, rather than on a lookup.

Confirm the privilege boundary directly if in doubt:

```bash
# 42501 permission denied
curl -X POST -H "apikey: $ANON" -H "Prefer: return=representation" ...
# 201 created
curl -X POST -H "apikey: $ANON" -H "Prefer: return=minimal" ...
```

Delivery and bounce events are an `UPDATE`, which the publishable key is not
granted and should not be. Those statuses stay at `sent` until
`SUPABASE_SERVICE_ROLE_KEY` is set.

### Self-addressed mail is dropped

Inbound mail whose sender is `FROM_EMAIL` is neither archived nor alerted on.
It is only ever a pipeline test, and with an auto-responder on the far end it is
the beginning of a loop.

---

## WhatsApp

### The platform rule, first

WhatsApp does not let a business send arbitrary text to someone who has not
messaged it in the last 24 hours. Outside that window only a **pre-approved
template** is accepted; Meta rejects free-form text with error `131047`. No
provider can get around this — it is enforced by WhatsApp, not by the gateway.

So "send automatically with no human intervention" needs a WhatsApp Business
account with an approved template. Once you have one, set
`WHATSAPP_TEMPLATE_NAME` and delivery works at any time. Without it, delivery
works only for clients who have messaged you recently.

### What the code does

`server/whatsapp.ts` drives whichever provider is configured, Meta first:

| Provider            | Required variables                                                     |
| ------------------- | ---------------------------------------------------------------------- |
| Meta Cloud API      | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`                    |
| Twilio              | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`    |

With neither set, `/api/send-whatsapp` returns **503 `not_configured`** and the
dashboard says so on the WhatsApp page. It does not pretend to have sent.

> The earlier version built a `wa.me` link, logged the row as `generated` and
> returned `success: true`. Every row in the dashboard was then badged "Auto
> Sent" with a green tick. Nothing had been sent; a human was expected to open
> WhatsApp and press send. Migration 0011 relabels those old rows `failed`.

`GET /api/send-whatsapp` reports which provider it has credentials for — the
quickest way to check whether the variables actually reached the deployment.

### Which channel fires

The application form has always asked how the applicant wants to be contacted,
and stored it as `applications.notification_preference`. Approval dispatch now
honours it:

| Preference  | Email | WhatsApp |
| ----------- | ----- | -------- |
| `email`     | yes   | no       |
| `whatsapp`  | no    | yes      |
| `both`      | yes   | yes      |

Both sends are awaited, and the reviewer sees a per-channel receipt in the
application drawer. They used to be `void fetch(...)`, so a refused send looked
exactly like a delivered one.

### Phone numbers

Applicants routinely type a national number with no country code.
`DEFAULT_COUNTRY_CODE` (default `1`) decides what a bare ten-digit number
means. Without it, WhatsApp treats the digits as an unknown number and the send
fails with nothing useful in the log.

---

## Environment variables

Set in Vercel, for Production and Preview both. See `.env.example`.

| Variable                   | Required | Notes                                             |
| -------------------------- | -------- | ------------------------------------------------- |
| `RESEND_API_KEY`           | yes      | Sending. Without it every send returns 503.       |
| `FROM_EMAIL`               | yes      | `support@yorkieadoptionhome.com`                  |
| `RESEND_WEBHOOK_SECRET`    | yes      | Or the webhook is unauthenticated.                |
| `ADMIN_NOTIFY_EMAILS`      | no       | Comma separated. Never `FROM_EMAIL`; that loops.  |
| `PUBLIC_SITE_URL`          | no       | Keeps per-deploy `VERCEL_URL` out of client mail. |
| `WHATSAPP_*` / `TWILIO_*`  | no       | Nothing delivers until one set is present.        |
| `DEFAULT_COUNTRY_CODE`     | no       | Defaults to `1`.                                  |
| `SUPABASE_SERVICE_ROLE_KEY`| no       | Lets the functions log without relying on RLS.    |

`VITE_`-prefixed variables are inlined into the browser bundle at build time,
so changing one needs a redeploy, not a restart. Nothing above may ever take a
`VITE_` prefix.

---

## Data protection

`public.emails` and `public.whatsapp_logs` hold client email bodies and phone
numbers. Migration 0010 granted `anon` select, update and delete on both — and
the publishable key ships in the browser bundle by design, so the entire client
archive was readable and deletable by anyone who opened DevTools. Note that
Supabase gives anonymous sign-ins the `authenticated` role as well, so
`to authenticated` would not have helped.

Migration 0011 makes both tables write-only for `anon` (the functions insert
with the publishable key; a write-only policy cannot read anything back) and
staff-only to read, behind the same `public.is_staff()` predicate as the rest of
the schema. Setting `SUPABASE_SERVICE_ROLE_KEY` closes the insert too.

The reader pane renders message bodies in a `sandbox` iframe with no tokens.
It previously used `dangerouslySetInnerHTML` on inbound HTML, which executes a
stranger's markup inside the authenticated admin session — an `<img onerror>`
in a client reply was enough to take the dashboard over.

---

## Checking it works

```bash
# Which provider has credentials?
curl https://www.yorkieadoptionhome.com/api/send-whatsapp

# Is the webhook reachable, and is it verifying signatures?
curl https://www.yorkieadoptionhome.com/api/inbound-email

# Is receiving enabled, and has the MX record been seen?
curl -H "Authorization: Bearer $RESEND_API_KEY" \
     https://api.resend.com/domains

# What does the world see for MX? Expect exactly one line.
dig +short MX yorkieadoptionhome.com
```

Then send a real email to `support@yorkieadoptionhome.com` and watch it appear
under Email Center → Inbox. That is the only test that exercises the whole
path. Allow up to a minute: Resend accepts the message within seconds but the
webhook can lag well behind that.

## Repairing the inbox

```bash
npm run db:repair-inbox                       # report, changes nothing
node scripts/repair-inbox.mjs --apply         # act
node scripts/repair-inbox.mjs --show "subject" # print a stored body
```

It deletes rows that are really the site's own outgoing mail, and re-reads
genuine received messages from Resend to fill in bodies the old handler never
fetched. Run against production once already: of 77 stored incoming rows, 76
were the site emailing itself — 24 application alerts, 20 messenger alerts, 16
approval emails, 12 support replies, 2 with the literal sender
`Unknown Sender`, and one row from the removed test button.

`--show` is the part worth remembering. A row existing proves the webhook
fired; only its body proves the fetch worked.
