# How to Set Up a Professional Domain Email for Yorkshire Adoption Home

A professional email address (e.g., `contact@yorkshireadoptionhome.com` or `support@yourdomain.com`) improves trust, brand credibility, and email deliverability (preventing emails from ending up in spam).

This guide walks you through setting up a professional email address and connecting it to your website on Vercel.

---

## Option 1: Resend (Recommended for Website Emails)

**Best for**: Sending automated website notifications & approval emails.
**Cost**: Free (up to 3,000 emails/month).

### Steps:
1. Go to [Resend.com](https://resend.com) and create an account.
2. Add your custom domain (e.g., `yorkshireadoptionhome.com`).
3. Copy the DNS records provided by Resend (MX, TXT, CNAME) and add them to your domain registrar (Namecheap, GoDaddy, Vercel Domains, or Cloudflare).
4. Create an API Key in Resend under **API Keys**.
5. Update your Vercel Environment Variables:
   - `RESEND_API_KEY`: `re_123456...`
   - `FROM_EMAIL`: `contact@yorkshireadoptionhome.com`

---

## Option 2: Google Workspace (Gmail for Custom Domain)

**Best for**: Having full inbox management inside Gmail while using your custom domain.
**Cost**: ~$6 USD / month per user.

### Steps:
1. Sign up at [Google Workspace](https://workspace.google.com).
2. Enter your custom domain name during setup.
3. Verify domain ownership by adding the TXT record to your DNS settings.
4. Create your primary inbox (e.g., `info@yorkshireadoptionhome.com`).
5. Enable 2-Step Verification on your new Workspace account.
6. Generate an **App Password**:
   - Go to Google Account -> **Security** -> **2-Step Verification** -> **App Passwords**.
   - Select **Other (Custom name)**, type `Vercel Web App`, and click **Generate**.
7. Update your Vercel Environment Variables:
   - `GMAIL_USER`: `info@yorkshireadoptionhome.com`
   - `GMAIL_APP_PASSWORD`: `your 16-character app password`

---

## Option 3: Zoho Mail (Free Custom Email Inbox)

**Best for**: Free custom domain inbox.
**Cost**: Free (up to 5 users).

### Steps:
1. Sign up at [Zoho Mail Forever Free Plan](https://www.zoho.com/mail/).
2. Add your domain and add the verification TXT records to your DNS settings.
3. Create your custom email address (e.g., `hello@yorkshireadoptionhome.com`).
4. Generate an App Password under Zoho Security settings.
5. In your site's Vercel Environment Variables, set SMTP host to `smtp.zoho.com` and port to `465` or `587`.

---

## Updating Environment Variables on Vercel

Once you have set up your professional email credentials:
1. Log into your [Vercel Dashboard](https://vercel.com).
2. Select your project (**yorkshire-adoption-home**).
3. Go to **Settings** -> **Environment Variables**.
4. Add / Update:
   - `GMAIL_USER`: `your-professional-email@yourdomain.com`
   - `GMAIL_APP_PASSWORD`: `your-app-password`
5. Click **Save** and trigger a new **Redeploy** on Vercel for the changes to take effect.
