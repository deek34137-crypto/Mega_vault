# 🤖 MegaVault Telegram Access Bot

Automated, zero-trace dual-payment Telegram bot for selling IP-locked access passwords for MegaVault.

---

## ⚡ Setup Guide

### 1. Get Your Bot Token from @BotFather
1. Open Telegram and search for **`@BotFather`**.
2. Send command `/newbot`.
3. Give your bot a name (e.g. `MegaVault Access Bot`) and username (e.g. `megawallah_access_bot`).
4. Copy the HTTP API **Bot Token** provided.

### 2. Get Your Telegram User ID (For Admin Approvals)
1. Open Telegram and search for **`@userinfobot`**.
2. Send `/start` — it will reply with your numeric **User ID** (e.g., `123456789`).

### 3. Configure `.env`
Create a `.env` file inside the `bot/` folder:

```env
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_TELEGRAM_ID=123456789
WEBSITE_URL=https://megawallah.dpdns.org
DB_PATH=../megavault.db
```

---

## 🚀 Running the Bot

### Local Development:
```bash
cd bot
npm install
npm run dev
```

### Production Deployment (Free on Railway / Render):
1. Push project to a private GitHub repo.
2. Deploy `bot/` as a Background Worker or Web Service on Railway.app / Render.com.
3. Set environment variables (`BOT_TOKEN`, `ADMIN_TELEGRAM_ID`, `WEBSITE_URL`).

---

## 💡 How It Works

1. **Telegram Stars (Instant)**:
   - User pays natively in Telegram using Stars (purchased via GPay/UPI/App Store).
   - Bot automatically generates a high-entropy password (`MV-XXXX-XXXX-XXXX-XXXX`) and inserts it into `megavault.db`.

2. **Amazon Gift Cards (UPI)**:
   - User buys Amazon Pay Gift Card via PhonePe/GPay/Paytm and submits the 16-character code.
   - Bot sends an instant alert to your Telegram Admin Chat (`ADMIN_TELEGRAM_ID`) with 1-click `[Approve]` buttons.
   - Clicking `Approve` automatically issues the password to the user.

3. **IP Locking**:
   - On the user's first login at `https://megawallah.dpdns.org/login`, the website binds their IP address to the token.
   - Access attempts from other IP addresses are blocked.
