'use strict';
const { EmbedBuilder } = require('discord.js');

const cut = (s, n) => {
  const str = String(s ?? '');
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
};

const COLORS = { info: 0x5865f2, ok: 0x57f287, warn: 0xfee75c, danger: 0xed4245 };

// Mọi embed đi qua hàm này để không vượt giới hạn Discord (lỗi 50035).
function safeEmbed({ title, description, fields = [], color = COLORS.info, footer }) {
  const e = new EmbedBuilder().setColor(color).setTimestamp();
  if (title) e.setTitle(cut(title, 256));
  if (description) e.setDescription(cut(description, 4096));
  if (footer) e.setFooter({ text: cut(footer, 2048) });
  for (const f of fields.slice(0, 25)) {
    e.addFields({ name: cut(f.name || '-', 256), value: cut(f.value || '-', 1024), inline: Boolean(f.inline) });
  }
  return e;
}

module.exports = { safeEmbed, cut, COLORS };
