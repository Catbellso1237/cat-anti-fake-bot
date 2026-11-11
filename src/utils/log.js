'use strict';
const { safeEmbed, COLORS } = require('./embed');
const { sendWebhook } = require('./webhook');
const { getConfig } = require('../config');

// Ghi vào kênh mod-log. Với sự kiện raid (alert=true) gửi thêm qua webhook.
async function sendModLog(guild, { title, description, user, action, color = COLORS.warn, alert = false, fields = [] }) {
  const cfg = getConfig(guild.id);
  const embed = safeEmbed({
    title,
    description,
    color,
    fields: [
      ...(user ? [{ name: 'Người dùng', value: `${user.tag ?? user.username} (${user.id})`, inline: true }] : []),
      ...(action ? [{ name: 'Hành động', value: action, inline: true }] : []),
      { name: 'Chế độ', value: cfg.mode === 'act' ? 'act (xử lý thật)' : 'log (chỉ ghi log)', inline: true },
      ...fields,
    ],
    footer: guild.name,
  });

  if (cfg.logChannelId) {
    const ch = await guild.channels.fetch(cfg.logChannelId).catch(() => null);
    if (ch?.isTextBased()) await ch.send({ embeds: [embed] }).catch((e) => console.warn('Gửi mod-log lỗi:', e.message));
  }
  if (alert) {
    const url = cfg.webhookUrl || process.env.RAID_WEBHOOK_URL;
    if (url) await sendWebhook(url, { embeds: [embed] });
  }
}

module.exports = { sendModLog };
