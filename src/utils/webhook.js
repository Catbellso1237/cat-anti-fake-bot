'use strict';
// Gửi cảnh báo raid qua Discord webhook. Chỉ chấp nhận URL webhook của Discord
// để tránh bị lợi dụng gọi tới địa chỉ khác.
const WEBHOOK_RE = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

const lastSent = new Map(); // url -> timestamp, tránh spam webhook khi raid kéo dài
const MIN_INTERVAL_MS = 2_000;

function isValidWebhookUrl(url) {
  return typeof url === 'string' && WEBHOOK_RE.test(url);
}

function maskWebhook(url) {
  return isValidWebhookUrl(url) ? url.replace(/\/[\w-]+$/, '/••••••') : '(chưa đặt)';
}

async function sendWebhook(url, { embeds, content } = {}) {
  if (!isValidWebhookUrl(url)) return false;
  const now = Date.now();
  if (now - (lastSent.get(url) ?? 0) < MIN_INTERVAL_MS) return false;
  lastSent.set(url, now);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Cat Anti Fake Bot',
        content: content?.slice(0, 2000),
        embeds: embeds?.map((e) => (typeof e.toJSON === 'function' ? e.toJSON() : e)).slice(0, 10),
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) console.warn(`Webhook trả về ${res.status}`);
    return res.ok;
  } catch (err) {
    console.warn('Gửi webhook lỗi:', err.message);
    return false;
  }
}

module.exports = { sendWebhook, isValidWebhookUrl, maskWebhook };
