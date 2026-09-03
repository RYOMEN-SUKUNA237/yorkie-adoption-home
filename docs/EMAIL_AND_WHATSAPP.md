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
template** is accepted. No provider gets around this — it is enforced by
WhatsApp, not by the gateway — so the two error codes below mean the same
thing:

```
63016   Twilio    "Failed to send freeform message ... outside the allowed window"
131047  Meta      "Re-engagement message"
```

An approval notice goes out days after the applicant filled in the form, so it
is essentially always outside the window. **A template is required, not
optional.** With one, delivery is automatic at any time; without one, delivery
works only for the rare client who happened to message you that day.

### Setting it up with Twilio

Twilio is the easier of the two routes and the one these steps follow: the
credentials exist the moment you sign up, and Twilio submits the template to
Meta on your behalf instead of leaving you to drive Meta's console. Meta direct
is cheaper at volume — see below — but costs more setup.

**1. Account.** Sign up at twilio.com. The console home page shows
`Account SID` and `Auth Token`.

**2. Sender.** Messaging → Senders → WhatsApp senders → *New sender*, and
register **+1 (858) 798-6768**. Twilio's wizard creates or links the Meta
Business account and asks for business details; the number must be able to
receive the verification code, and it must not already be registered to a
personal or Business-app WhatsApp account. If it is, delete that account in
the WhatsApp app first and wait for the deregistration to take effect.

**3. Template.** Messaging → Content Template Builder → *Create new*, type
**WhatsApp Template**, category **Utility** (not Marketing — Utility approves
faster and carries no opt-in requirement). Body:

```
Hello {{1}} — your adoption application {{2}} for {{3}} has been approved.

Your certificate of approval: {{4}}

Reply here or open the support chat on our website to arrange collection.
```

Submit it for WhatsApp approval. Utility templates usually clear within a few
hours. When it is approved, copy its **ContentSid** — it starts `HX`.

**4. Variables.** The four placeholders are filled in this order, and the
order is fixed by `src/services/applications.ts`:

| Placeholder | Value                 |
| ----------- | --------------------- |
| `{{1}}`     | applicant name        |
| `{{2}}`     | application reference |
| `{{3}}`     | puppy name            |
| `{{4}}`     | certificate URL       |

Change the template's wording freely, but keep the placeholders in that order
or the message will read as nonsense.

**5. Vercel.** Project → Settings → Environment Variables, Production and
Preview both:

```
TWILIO_ACCOUNT_SID     ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN      (from the console)
TWILIO_WHATSAPP_NUMBER +18587986768
TWILIO_CONTENT_SID     HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Redeploy. Then open `https://www.yorkieadoptionhome.com/api/send-whatsapp` in
a browser: it should answer `"provider":"twilio","automatic":true,
"templated":true`. Anything less and the WhatsApp page in the dashboard says
which piece is missing.

> The sandbox is not a shortcut. Twilio's shared sandbox number requires each
> recipient to text it a join code first, which is precisely the human step
> this exists to remove. Use it to smoke-test the plumbing if you like, never
> for clients.

### Setting it up with Meta instead

Same shape, different console: create a Meta app with the WhatsApp product,
register the number, generate a System User token that does not expire, get a
template approved in WhatsApp Manager, then set `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_TEMPLATE_NAME`. It is free for the first
1000 service conversations a month and cheaper after that; the cost is doing
business verification and token management yourself.

### What the code does

`server/whatsapp.ts` drives whichever provider is configured:

| Provider       | Required variables                                                  | Template variable        |
| -------------- | ------------------------------------------------------------------- | ------------------------ |
| Twilio         | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` | `TWILIO_CONTENT_SID`     |
| Meta Cloud API | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`                 | `WHATSAPP_TEMPLATE_NAME` |

When the template variable is set and the caller passed `templateParams`, the
template is sent; otherwise plain text goes out, which only lands inside an
open window. On the Twilio path `Body` is deliberately *omitted* when
`ContentSid` is present — sending both makes Twilio take the free-form path and
fail with 63016 despite the template being right there.

With neither provider set, `/api/send-whatsapp` returns **503 `not_configured`**
and the dashboard says so. It does not pretend to have sent.

> The earlier version built a `wa.me` link, logged the row as `generated` and
> returned `success: true`. Every row in the dashboard was then badged "Auto
> Sent" with a green tick. Nothing had been sent; a human was expected to open
> WhatsApp and press send. Migration 0011 relabels those old rows `failed`.

`GET /api/send-whatsapp` reports the provider **and** whether a template is
configured, because credentials alone are the state that looks working and is
not.

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
| `TWILIO_*`                 | no       | Nothing delivers until one provider set is there. |
| `TWILIO_CONTENT_SID`       | no       | Without it, sends fail outside the 24h window.    |
| `WHATSAPP_*`               | no       | The Meta alternative to the `TWILIO_*` set.       |
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
