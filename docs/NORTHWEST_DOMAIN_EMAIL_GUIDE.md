# Setting Up Your Custom Domain Email with Northwest Registered Agent & Vercel

Yes! Because your domain is registered with **Northwest Registered Agent**, you can easily use it for your website's professional email (e.g., `info@yourdomain.com` or `support@yourdomain.com`).

---

## 💡 How It Works (Do I need a third party?)

Domain registrars like **Northwest Registered Agent** manage your **DNS Records** (the control panel that routes traffic). However, to actually **send and receive emails** from your website, you pair Northwest's DNS with an **Email Service Provider**:

1. **For sending automated website emails (Recommended)**: Use **Resend** (Free, 3,000 emails/month). It takes 3 minutes and requires zero credit card.
2. **For a full inbox (to read & reply like Gmail)**: Use **Google Workspace** ($6/mo) or **Zoho Mail** (Free forever).

---

## 🚀 Option 1: Resend Setup (Fastest & 100% Free for Website Emails)

Resend handles sending transactional emails from your custom domain (e.g. `notifications@yourdomain.com`) directly through your website on Vercel.

### Step 1: Create a Free Account on Resend
1. Go to [resend.com](https://resend.com) and click **Sign Up** (it takes 30 seconds).
2. Once logged in, click **Domains** on the left menu, then click **Add Domain**.
3. Type your domain name (e.g., `yourdomain.com`) and select your region (e.g., US East).

---

### Step 2: Add DNS Records in Northwest Registered Agent
Resend will show you **3 DNS Records** (usually 1 TXT, 1 MX, and 1 CNAME record).

Now, open a new tab and log into **Northwest Registered Agent**:
1. Log into your account at [northwestregisteredagent.com](https://www.northwestregisteredagent.com/).
2. Click **Domain Names** from your account dashboard.
3. Select your domain name and click **Manage DNS Records** (or **DNS Manager**).
4. Click **Add Record** for each of the 3 records Resend provided:
   - **Record 1 (SPF / Verification)**:
     - **Type**: `TXT`
     - **Host / Name**: `@` (or leave blank depending on interface)
     - **Value / Content**: Copy the string from Resend (starts with `v=spf1...` or `resend-verification=...`)
   - **Record 2 (DKIM)**:
     - **Type**: `CNAME`
     - **Host / Name**: `resend._domainkey`
     - **Value / Content**: Copy the CNAME value from Resend.
   - **Record 3 (Mail Routing)**:
     - **Type**: `MX`
     - **Host / Name**: `send` (or `@`)
     - **Priority**: `10`
     - **Value / Content**: `feedback-smtp.us-east-1.amazonses.com` (or value shown by Resend)
5. Save all records in Northwest Registered Agent.

---

### Step 3: Verify Domain in Resend
1. Return to the **Resend** tab.
2. Click **Verify Domain**. Within 1–2 minutes, it will show a green **Verified** status.
3. Go to **API Keys** in Resend -> Click **Create API Key** -> Copy your new key (starts with `re_...`).

---

### Step 4: Add API Key to Vercel
1. Log into your [Vercel Dashboard](https://vercel.com).
2. Select your project **yorkshire-adoption-home**.
3. Go to **Settings** -> **Environment Variables**.
4. Add the following variables:
   - **Key**: `GMAIL_USER`
     **Value**: `notifications@yourdomain.com` (replace with your domain)
   - **Key**: `GMAIL_APP_PASSWORD`
     **Value**: `re_your_resend_api_key`
5. Click **Save** and trigger a **Redeploy** on Vercel.

---

## 📬 Option 2: Full Inbox Setup (Google Workspace / Zoho Mail)

If you want a full inbox where you can send, receive, and reply to client emails manually:

### Option A: Google Workspace ($6/mo)
1. Go to [workspace.google.com](https://workspace.google.com) and sign up with your domain.
2. Google will give you **MX Records**. Add those MX records into **Northwest Registered Agent** -> **Manage DNS Records**.
3. Enable 2-Step Verification in Google Account -> Create an **App Password**.
4. Use your custom email + App Password in Vercel.

### Option B: Zoho Mail (Free Custom Email Inbox)
1. Go to [zoho.com/mail](https://www.zoho.com/mail/) and choose the **Forever Free Plan**.
2. Add your domain name and follow their instructions to add MX records in **Northwest Registered Agent**.
3. Create your custom email address (e.g. `info@yourdomain.com`).
