# Anti-Spam & Email Deliverability Guide (SPF, DKIM & DMARC)

To guarantee that support messages and approval emails from **Yorkshire Adoption Home** reach your clients' **Inbox** and never get sent to the **Spam / Junk folder**, follow this deliverability guide.

---

## 🛡️ The 3 Pillars of Email Deliverability

Email providers (like Gmail, Yahoo, Outlook, and Apple Mail) check 3 authentication records in your **Northwest Registered Agent DNS settings** before placing an email in the inbox:

1. **SPF (Sender Policy Framework)**: Proves that Vercel/Resend/Gmail is authorized to send emails on behalf of your domain.
2. **DKIM (DomainKeys Identified Mail)**: Adds a cryptographic digital signature to every email so receivers know it wasn't tampered with.
3. **DMARC (Domain-based Message Authentication)**: Tells recipient servers what to do if an email fails SPF/DKIM checks (protects your domain from spoofing).

---

## 📋 Step-by-Step DNS Records for Northwest Registered Agent

Log into **[Northwest Registered Agent](https://www.northwestregisteredagent.com/)** -> Go to **Domain Names** -> Select your domain -> Click **Manage DNS Records**.

### 1. Add SPF Record (TXT)
- **Type**: `TXT`
- **Host / Name**: `@` (or leave blank depending on interface)
- **Value**:
  - *If using Resend*: `v=spf1 include:amazonses.com ~all`
  - *If using Gmail / Google Workspace*: `v=spf1 include:_spf.google.com ~all`
  - *If using both*: `v=spf1 include:_spf.google.com include:amazonses.com ~all`

### 2. Add DKIM Record (CNAME / TXT)
- **Type**: `CNAME` (or `TXT` if provided by your email provider)
- **Host / Name**: `resend._domainkey` (or string provided by Google Workspace)
- **Value**: *(Copy the unique DKIM string generated in your Resend / Google Workspace dashboard)*

### 3. Add DMARC Record (TXT) — Crucial for Gmail & Yahoo Compliance
Starting in 2024, Gmail & Yahoo **require** a valid DMARC record for all sender domains.

- **Type**: `TXT`
- **Host / Name**: `_dmarc`
- **TTL**: `3600` (or Default)
- **Value / Content**:
  ```text
  v=DMARC1; p=none; pct=100; fo=1;
  ```
  *(Once you confirm emails are delivering cleanly, you can update `p=none` to `p=quarantine` for stricter protection).*

---

## 💻 Measures Already Built Into Your Web App Code

We have built-in anti-spam best practices directly into your website's serverless mail system ([`api/send-email.ts`](file:///c:/Users/yanni/Desktop/yorkshire-adoption-home/api/send-email.ts)):

1. **Dual Format (HTML + Plain Text Fallback)**:
   Every outgoing email automatically sends both a styled HTML version AND a clean plain-text version (`text: ...`). Email filters penalize HTML-only emails; sending both lowers your spam score to near zero.
2. **Proper Headers & Reply-To**:
   - `From`: Registered domain email address.
   - `Reply-To`: Directly set to your support address so client replies go straight to your inbox.
3. **Clean HTML & Inline CSS**:
   No external JavaScript, iframe embeds, or spam trigger keywords.
