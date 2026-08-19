import { Bot, InlineKeyboard } from 'grammy';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'megavault.db');
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://megawallah.dpdns.org';

if (!BOT_TOKEN) {
  console.error('❌ Error: BOT_TOKEN is missing in environment variables.');
  process.exit(1);
}

// ─── DATABASE INITIALIZATION ───
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS access_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    bound_ip TEXT,
    plan_type TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    payment_type TEXT NOT NULL,
    telegram_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_access_tokens_token ON access_tokens(token);
`);

// ─── TOKEN GENERATOR (High-Entropy: MV-xxxx-xxxx-xxxx-xxxx) ───
function generateSecureToken(): string {
  const bytes = crypto.randomBytes(12);
  const hex = bytes.toString('hex').toUpperCase(); // 24 chars
  return `MV-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}`;
}

function createTokenInDb(params: {
  planType: string;
  durationDays: number;
  paymentType: string;
  telegramId: string;
}): string {
  const token = generateSecureToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.durationDays * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = now.toISOString();

  const stmt = db.prepare(`
    INSERT INTO access_tokens (token, bound_ip, plan_type, expires_at, is_active, created_at, payment_type, telegram_id)
    VALUES (?, NULL, ?, ?, 1, ?, ?, ?)
  `);

  stmt.run(token, params.planType, expiresAt, createdAt, params.paymentType, params.telegramId);
  return token;
}

// ─── TELEGRAM BOT INITIALIZATION ───
const bot = new Bot(BOT_TOKEN);

// User State for Gift Card Submissions
const userStates = new Map<number, { action: string; planType?: string }>();

// ─── MAIN MENU ───
function getMainKeyboard() {
  return new InlineKeyboard()
    .text('⭐️ Pay with Telegram Stars (Instant)', 'pay_stars')
    .row()
    .text('🎁 Pay with Amazon Gift Card (UPI)', 'pay_amazon')
    .row()
    .text('❓ Help & FAQs', 'show_help');
}

bot.command('start', async (ctx) => {
  const welcomeText =
    `🔒 *Welcome to MegaVault Access Bot*\n\n` +
    `Get instant, private access passwords for **MegaVault**.\n\n` +
    `*Pricing Plans:*\n` +
    `• ⚡ *1-Day Access*: ₹30 (25 Stars)\n` +
    `• 🚀 *7-Day Access*: ₹200 (175 Stars)\n` +
    `• 👑 *30-Day Access*: ₹400 (350 Stars)\n\n` +
    `*Features:*\n` +
    `✅ 100% Anonymous & Secure\n` +
    `✅ Session-bound IP Lock (prevents password sharing)\n` +
    `✅ Instant automated delivery\n\n` +
    `Choose your payment method below:`;

  await ctx.reply(welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: getMainKeyboard(),
  });
});

// ─── STARS PAYMENT FLOW ───
bot.callbackQuery('pay_stars', async (ctx) => {
  await ctx.answerCallbackQuery();
  const keyboard = new InlineKeyboard()
    .text('⚡ 1-Day Access (25 Stars)', 'stars_plan_1day')
    .row()
    .text('🚀 7-Day Access (175 Stars)', 'stars_plan_7day')
    .row()
    .text('👑 30-Day Access (350 Stars)', 'stars_plan_30day')
    .row()
    .text('⬅️ Back to Main Menu', 'main_menu');

  await ctx.editMessageText(`⭐️ *Select your Telegram Stars Plan:*\n\nPay natively using your Telegram app with UPI/Google Play:`, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});

const STARS_PLANS: Record<string, { title: string; stars: number; days: number }> = {
  stars_plan_1day: { title: 'MegaVault 1-Day Access Pass', stars: 25, days: 1 },
  stars_plan_7day: { title: 'MegaVault 7-Day Access Pass', stars: 175, days: 7 },
  stars_plan_30day: { title: 'MegaVault 30-Day Access Pass', stars: 350, days: 30 },
};

Object.keys(STARS_PLANS).forEach((planKey) => {
  bot.callbackQuery(planKey, async (ctx) => {
    await ctx.answerCallbackQuery();
    const plan = STARS_PLANS[planKey];

    await ctx.replyWithInvoice(
      plan.title,
      `Unlocks full access to MegaVault for ${plan.days} day(s). IP-locked on first login.`,
      planKey, // Payload
      'XTR',   // Telegram Stars currency code
      [{ label: plan.title, amount: plan.stars }]
    );
  });
});

// Answer pre-checkout query (required by Telegram Payments 2.0 API)
bot.on('pre_checkout_query', async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

// Successful Stars Payment Handler
bot.on('message:successful_payment', async (ctx) => {
  const payment = ctx.message.successful_payment;
  const payload = payment.invoice_payload;
  const plan = STARS_PLANS[payload] || { title: 'Access Pass', days: 1 };

  const telegramId = ctx.from?.id.toString() || 'unknown';
  const token = createTokenInDb({
    planType: payload,
    durationDays: plan.days,
    paymentType: 'stars',
    telegramId,
  });

  const successMessage =
    `🎉 *Payment Successful!*\n\n` +
    `Your high-entropy access password is:\n` +
    `\`${token}\`\n\n` +
    `*Instructions:*\n` +
    `1. Go to [MegaVault Login](${WEBSITE_URL}/login)\n` +
    `2. Paste the access password above.\n` +
    `3. Your password will bind to your IP address on first login for maximum security.\n\n` +
    `*Pass Duration:* ${plan.days} Day(s)`;

  await ctx.reply(successMessage, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
});

// ─── AMAZON GIFT CARD PAYMENT FLOW ───
bot.callbackQuery('pay_amazon', async (ctx) => {
  await ctx.answerCallbackQuery();
  userStates.set(ctx.from.id, { action: 'awaiting_amazon_gc' });

  const instructions =
    `🎁 *Pay with Amazon Pay Gift Card (UPI)*\n\n` +
    `*How to Buy Code via UPI:*\n` +
    `1. Open Amazon / PhonePe / Paytm app.\n` +
    `2. Search **"Amazon Pay Gift Card"**.\n` +
    `3. Buy a code for your desired plan:\n` +
    `   • ⚡ *1-Day Access*: ₹30\n` +
    `   • 🚀 *7-Day Access*: ₹200\n` +
    `   • 👑 *30-Day Access*: ₹400\n\n` +
    `4. Copy the 16-character Gift Card Claim Code (e.g., \`GIFT-XXXX-XXXX-XXXX\`).\n\n` +
    `👇 *Send your 16-character Gift Card Code in chat now:*`;

  await ctx.reply(instructions, { parse_mode: 'Markdown' });
});

// Handle incoming messages for Gift Card codes
bot.on('message:text', async (ctx, next) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (state?.action === 'awaiting_amazon_gc') {
    const code = ctx.message.text.trim();
    userStates.delete(userId);

    await ctx.reply(`⏳ *Gift Card Received!* Verifying your code... You will receive your access password shortly.`, {
      parse_mode: 'Markdown',
    });

    // Notify Admin Chat if configured
    if (ADMIN_TELEGRAM_ID) {
      const adminKeyboard = new InlineKeyboard()
        .text('Approve 1-Day (₹30)', `approve_${userId}_1day`)
        .text('Approve 7-Day (₹200)', `approve_${userId}_7day`)
        .row()
        .text('Approve 30-Day (₹400)', `approve_${userId}_30day`)
        .text('❌ Reject', `reject_${userId}`);

      await bot.api.sendMessage(
        ADMIN_TELEGRAM_ID,
        `🚨 *New Amazon Gift Card Claim*\n\n` +
        `👤 *User ID:* \`${userId}\`\n` +
        `🎟 *Code:* \`${code}\`\n\n` +
        `Select plan duration to approve and issue password:`,
        {
          parse_mode: 'Markdown',
          reply_markup: adminKeyboard,
        }
      );
    } else {
      console.log(`[MegaVault Bot] Gift card claim received from User ${userId}: ${code}`);
    }
    return;
  }

  await next();
});

// Admin Approval Handler
bot.on('callback_query:data', async (ctx, next) => {
  const data = ctx.callbackQuery.data;

  if (data.startsWith('approve_') || data.startsWith('reject_')) {
    const parts = data.split('_');
    const action = parts[0];
    const targetUserId = parts[1];
    const planType = parts[2] || '1day';

    if (action === 'reject') {
      await ctx.answerCallbackQuery('Claim Rejected');
      await ctx.editMessageText(`❌ Claim for User \`${targetUserId}\` was *Rejected*.`, { parse_mode: 'Markdown' });
      await bot.api.sendMessage(targetUserId, `❌ Your Gift Card verification was not successful. Please contact support if this was an error.`);
      return;
    }

    const durationDays = planType === '30day' ? 30 : planType === '7day' ? 7 : 1;
    const token = createTokenInDb({
      planType: `amazon_${planType}`,
      durationDays,
      paymentType: 'amazon_gc',
      telegramId: targetUserId,
    });

    await ctx.answerCallbackQuery('Approved & Issued!');
    await ctx.editMessageText(`✅ Approved ${durationDays}-day pass for User \`${targetUserId}\`!\nPassword: \`${token}\``, {
      parse_mode: 'Markdown',
    });

    const userMsg =
      `🎉 *Gift Card Verified & Approved!*\n\n` +
      `Your high-entropy access password is:\n` +
      `\`${token}\`\n\n` +
      `*Instructions:*\n` +
      `1. Go to [MegaVault Login](${WEBSITE_URL}/login)\n` +
      `2. Paste the access password above.\n` +
      `3. Your password will bind to your IP address on first login for maximum security.\n\n` +
      `*Pass Duration:* ${durationDays} Day(s)`;

    await bot.api.sendMessage(targetUserId, userMsg, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
    return;
  }

  if (data === 'main_menu') {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`🔒 *MegaVault Access Bot Main Menu*`, {
      parse_mode: 'Markdown',
      reply_markup: getMainKeyboard(),
    });
    return;
  }

  if (data === 'show_help') {
    await ctx.answerCallbackQuery();
    const helpText =
      `❓ *Help & FAQs*\n\n` +
      `**Q: How does the password work?**\n` +
      `A: Enter the password at \`${WEBSITE_URL}/login\`. On your first login, it binds to your IP address to prevent account sharing.\n\n` +
      `**Q: Can I use it on mobile and PC?**\n` +
      `A: Yes! Once logged in, your session cookie stays active on that device for the full pass duration.\n\n` +
      `**Q: Are payments anonymous?**\n` +
      `A: Yes. Telegram Stars and Amazon Gift Cards do not reveal your identity or personal info to us.`;

    await ctx.editMessageText(helpText, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('⬅️ Back to Main Menu', 'main_menu'),
    });
    return;
  }

  await next();
});

// ─── START BOT ───
console.log('🤖 MegaVault Telegram Access Bot is starting...');
bot.start({
  onStart: (info) => {
    console.log(`✅ Bot @${info.username} is live and listening for payments!`);
  },
});
